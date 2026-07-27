import logging
from datetime import datetime, timedelta, timezone

from app.database import db
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _resolve_start_time(competition: dict) -> datetime | None:
    return _parse_dt(competition.get("start_time") or competition.get("date"))


def _resolve_end_time(competition: dict) -> datetime | None:
    end_time = _parse_dt(competition.get("end_time"))
    if end_time:
        return end_time
    start_time = _resolve_start_time(competition)
    duration = competition.get("duration") or 0
    if start_time and duration:
        return start_time + timedelta(minutes=duration)
    return None


def compute_effective_status(competition: dict, now: datetime | None = None) -> str:
    """Derives the real-time status from start/end time instead of trusting the
    stored `status`, which is only ever written manually (on create/edit) or by
    the maze-goal / time-expiry finalizers — nothing else keeps it in sync as
    time passes. Explicit terminal/hidden states are always respected."""
    stored = competition.get("status")
    if stored in ("completed", "inactive"):
        return stored

    now = now or datetime.now(timezone.utc)
    start = _resolve_start_time(competition)
    end = _resolve_end_time(competition)

    if end and now > end:
        return "completed"
    if start and now < start:
        return "upcoming"
    if start:
        return "active"
    return stored or "upcoming"


async def finalize_expired_competition(competition: dict) -> dict:
    """If a competition's end time has passed and the podium isn't already full
    (nobody won by reaching the maze goal), crown the points leaders — sorted by
    points DESC then time ASC, per the platform's ranking rule — so there's
    always a winner even if the maze goal was never reached. Any teams that did
    reach the goal before time ran out keep their earned podium spot; only the
    remaining slots (up to 3 total) are filled by points. Idempotent and safe
    under concurrent calls: the update only applies once (status not already
    "completed"), and a losing race just re-reads whatever the winner wrote."""
    if competition.get("status") in ("completed", "inactive"):
        return competition

    end_time = _resolve_end_time(competition)
    if not end_time or datetime.now(timezone.utc) <= end_time:
        return competition

    existing_podium = competition.get("podium") or []
    existing_codes = {p.get("teamCode") for p in existing_podium}

    team_codes = competition.get("teams", [])
    teams = [t async for t in db["teams"].find({"code": {"$in": team_codes}})]

    def _last_submission_time(team: dict) -> int:
        subs = team.get("submissions", [])
        return max((s.get("time", 0) for s in subs), default=0)

    ranked = sorted(
        (t for t in teams if t.get("code") not in existing_codes),
        key=lambda t: (-t.get("points", 0), _last_submission_time(t)),
    )
    slots_left = max(0, 3 - len(existing_podium))
    now_iso = datetime.now(timezone.utc).isoformat()
    fill = [
        {
            "teamCode": t.get("code"),
            "teamName": t.get("teamName", t.get("code")),
            "finished_at": now_iso,
        }
        for t in ranked[:slots_left]
    ]
    podium = existing_podium + fill
    if not podium:
        return competition  # no registered teams at all — nothing to crown

    update_fields = {
        "status": "completed",
        "completed_at": now_iso,
        "podium": podium,
        "winner": podium[0]["teamCode"],
        "winnerName": podium[0]["teamName"],
    }

    result = await db["competition"].update_one(
        {"id": competition["id"], "status": {"$ne": "completed"}},
        {"$set": update_fields},
    )
    if result.modified_count == 1:
        competition = {**competition, **update_fields}
        await manager.broadcast(competition["id"], {
            "event": "game_over",
            "data": {
                "podium": podium,
                "teamCode": podium[0]["teamCode"],
                "teamName": podium[0]["teamName"],
                "reason": "time_expired",
            },
        })
    else:
        # Lost the race (maze-goal path or a concurrent call finalized it
        # first) — reflect whatever actually ended up persisted.
        fresh = await db["competition"].find_one({"id": competition["id"]})
        if fresh:
            competition = fresh
    return competition


async def sync_competition_status(competition: dict) -> dict:
    """One-stop call for read paths: finalizes by time if needed, then stamps
    the returned dict's `status` with the effective value so callers never have
    to re-derive it (and stale "active" past end_time never leaks out)."""
    competition = await finalize_expired_competition(competition)
    competition["status"] = compute_effective_status(competition)
    return competition
