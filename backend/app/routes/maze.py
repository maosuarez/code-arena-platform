from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.database import db
from app.models_entity.maze import MazeConfig
from app.routes.auth import get_current_user, require_admin
from app.services.websocket_manager import manager

router = APIRouter()


@router.post("/{competitionId}")
async def create_or_update_maze(
    competitionId: str,
    config: MazeConfig,
    _user: dict = Depends(require_admin),
):
    config.competitionId = competitionId
    doc = config.model_dump(mode="json")
    await db["maze_configs"].replace_one({"competitionId": competitionId}, doc, upsert=True)
    return {"message": "Laberinto configurado"}


def _visited_nodes(config: dict, current_node_id: str, unlocked_doors: list[str]) -> set[str]:
    """Nodos donde el equipo ya estuvo parado: la salida, su posición actual y
    los extremos de toda puerta que abrió."""
    unlocked = set(unlocked_doors)
    visited = {config["startNodeId"], current_node_id}
    for door in config.get("doors", []):
        if door["id"] in unlocked:
            visited.add(door["from_node"])
            visited.add(door["to_node"])
    return visited


def _visible_ids(config: dict, current_node_id: str, unlocked_doors: list[str]) -> tuple[set[str], set[str]]:
    """Fog-of-war: lo que un equipo ve es su territorio explorado (todos los nodos
    visitados, no solo el actual) más la frontera: las puertas cerradas que tocan
    cualquiera de esos nodos. Así, al avanzar de A a B, no pierde de vista las
    opciones que dejó abiertas en A. El resto del laberinto (incluida la meta)
    sigue oculto hasta explorarlo."""
    doors = config.get("doors", [])
    unlocked = set(unlocked_doors)
    visited = _visited_nodes(config, current_node_id, unlocked_doors)

    visible_door_ids = set(unlocked)
    visible_node_ids = set(visited)

    for door in doors:
        if door["id"] in unlocked:
            continue
        if door["from_node"] in visited or door["to_node"] in visited:
            # Puerta de frontera: se ve, y se ve a dónde lleva, pero el nodo del
            # otro lado no cuenta como visitado (no expande la frontera).
            visible_door_ids.add(door["id"])
            visible_node_ids.add(door["from_node"])
            visible_node_ids.add(door["to_node"])

    return visible_node_ids, visible_door_ids


def _apply_fog_of_war(config: dict, teams: list[dict], my_team_code: str | None) -> tuple[dict, list[dict]]:
    my_team = next((t for t in teams if t["teamCode"] == my_team_code), None)
    current_node_id = my_team["currentNodeId"] if my_team else config["startNodeId"]
    unlocked_doors = my_team["unlockedDoors"] if my_team else []

    visible_node_ids, visible_door_ids = _visible_ids(config, current_node_id, unlocked_doors)

    fogged_config = {
        **config,
        "nodes": [n for n in config.get("nodes", []) if n["id"] in visible_node_ids],
        "doors": [d for d in config.get("doors", []) if d["id"] in visible_door_ids],
        "goalNodeId": config.get("goalNodeId") if config.get("goalNodeId") in visible_node_ids else "",
    }

    fogged_teams = []
    for t in teams:
        if t["teamCode"] == my_team_code:
            fogged_teams.append(t)
            continue
        fogged_teams.append({
            **t,
            "currentNodeId": t["currentNodeId"] if t["currentNodeId"] in visible_node_ids else None,
            "unlockedDoors": [d for d in t["unlockedDoors"] if d in visible_door_ids],
        })

    return fogged_config, fogged_teams


@router.get("/{competitionId}/state")
async def get_maze_state(competitionId: str, user: dict = Depends(get_current_user)):
    config = await db["maze_configs"].find_one({"competitionId": competitionId}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Laberinto no configurado para esta competencia")

    raw_progress = await db["maze_progress"].find(
        {"competitionId": competitionId}, {"_id": 0}
    ).to_list(length=200)
    progress_by_team = {p["teamCode"]: p for p in raw_progress}

    # Un equipo solo obtiene un documento en maze_progress cuando intenta abrir
    # su primera puerta ($setOnInsert en /unlock). Si solo iteramos raw_progress,
    # un equipo recién inscrito que aún no abrió ninguna puerta queda fuera de
    # la lista y el frontend ve availablePoints=0 aunque sí tenga puntos —
    # por eso una puerta que cuesta exactamente lo que el equipo tiene parece
    # "no alcanzarle". Partimos de los equipos inscritos en la competencia para
    # que todos aparezcan desde el principio.
    competition = await db["competition"].find_one({"id": competitionId}, {"_id": 0, "teams": 1})
    registered_team_codes = competition.get("teams", []) if competition else []
    all_team_codes = list(dict.fromkeys([*registered_team_codes, *progress_by_team.keys()]))

    teams = []
    for team_code in all_team_codes:
        p = progress_by_team.get(team_code, {})
        team = await db["teams"].find_one(
            {"code": team_code}, {"_id": 0, "teamName": 1, "points": 1, "avatar": 1}
        )
        spent = p.get("spentPoints", 0)
        earned = team.get("points", 0) if team else 0
        teams.append({
            "teamCode": team_code,
            "teamName": team.get("teamName", team_code) if team else team_code,
            "avatar": team.get("avatar", "") if team else "",
            "currentNodeId": p.get("currentNodeId", config.get("startNodeId")),
            "unlockedDoors": p.get("unlockedDoors", []),
            "spentPoints": spent,
            "earnedPoints": earned,
            "availablePoints": earned - spent,
        })

    if config.get("fogOfWar") and not user.get("is_admin", False):
        user_data = await db["users"].find_one({"username": user.get("username")})
        my_team_code = user_data.get("teamCode") if user_data else None
        config, teams = _apply_fog_of_war(config, teams, my_team_code)

    return {"config": config, "teams": teams}


async def _require_active_competition(competitionId: str) -> dict:
    competition = await db["competition"].find_one({"id": competitionId})
    if not competition:
        raise HTTPException(status_code=404, detail="Competencia no encontrada")
    status = competition.get("status")
    if status != "active":
        if status == "completed":
            raise HTTPException(status_code=400, detail="El juego ya terminó: el podio (top 3) está completo")
        raise HTTPException(status_code=400, detail=f"La competencia no está activa (estado: {status})")
    return competition


async def _register_goal_arrival(
    competitionId: str,
    competition: dict,
    config: dict,
    team_code: str,
    target_node: str | None,
) -> tuple[bool, int | None, bool]:
    """🏁 El equipo pisó el nodo meta. El juego no termina con el primer equipo,
    sino cuando se completa el PODIO (los primeros 3 en llegar).
    Devuelve (llegó, posición_en_podio, podio_completo)."""
    if target_node != config.get("goalNodeId"):
        return False, None, False

    # Cupos del podio: 3, o menos si hay menos equipos inscritos.
    registered = len(competition.get("teams", []))
    podium_target = min(3, registered) if registered else 3

    finisher_team = await db["teams"].find_one({"code": team_code}, {"_id": 0, "teamName": 1})
    finisher_name = finisher_team.get("teamName", team_code) if finisher_team else team_code

    # Inserción atómica en el podio: solo si la competencia sigue activa,
    # este equipo aún no está en el podio y queda cupo (< podium_target).
    added = await db["competition"].update_one(
        {
            "id": competitionId,
            "status": "active",
            "podium.teamCode": {"$ne": team_code},
            "$expr": {"$lt": [{"$size": {"$ifNull": ["$podium", []]}}, podium_target]},
        },
        {"$push": {"podium": {
            "teamCode": team_code,
            "teamName": finisher_name,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }}},
    )

    if added.modified_count != 1:
        return True, None, False

    comp_now = await db["competition"].find_one({"id": competitionId}, {"_id": 0, "podium": 1})
    podium = comp_now.get("podium", []) if comp_now else []
    position = len(podium)  # 1 = oro, 2 = plata, 3 = bronce

    await manager.broadcast(competitionId, {
        "event": "team_finished",
        "data": {
            "teamCode": team_code,
            "teamName": finisher_name,
            "position": position,
            "podiumTarget": podium_target,
        },
    })

    # Podio completo -> termina el juego para todos.
    if position < podium_target:
        return True, position, False

    winner = podium[0]
    await db["competition"].update_one(
        {"id": competitionId, "status": "active"},
        {"$set": {
            "status": "completed",
            "winner": winner.get("teamCode"),
            "winnerName": winner.get("teamName"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    await manager.broadcast(competitionId, {
        "event": "game_over",
        "data": {
            "podium": podium,
            "teamCode": winner.get("teamCode"),
            "teamName": winner.get("teamName"),
            "goalNodeId": config.get("goalNodeId"),
        },
    })
    return True, position, True


async def _team_code_of(user: dict) -> str:
    user_data = await db["users"].find_one({"username": user.get("username")})
    team_code = user_data.get("teamCode") if user_data else None
    if not team_code:
        raise HTTPException(status_code=400, detail="Usuario sin equipo asignado")
    return team_code


class UnlockRequest(BaseModel):
    door_id: str

@router.post("/{competitionId}/unlock")
async def unlock_door(
    competitionId: str,
    req: UnlockRequest,
    user: dict = Depends(get_current_user),
):
    door_id = req.door_id

    # El laberinto solo se puede jugar mientras la competencia esté activa.
    # Esto bloquea movimientos una vez que un equipo ganó (status="completed").
    competition = await _require_active_competition(competitionId)

    config = await db["maze_configs"].find_one({"competitionId": competitionId})
    if not config:
        raise HTTPException(status_code=404, detail="Laberinto no encontrado")

    door = next((d for d in config.get("doors", []) if d["id"] == door_id), None)
    if not door:
        raise HTTPException(status_code=404, detail="Puerta no encontrada")

    team_code = await _team_code_of(user)

    team = await db["teams"].find_one({"code": team_code})
    team_points = team.get("points", 0) if team else 0

    # Ensure progress document exists (first unlock creates it at startNodeId)
    await db["maze_progress"].update_one(
        {"competitionId": competitionId, "teamCode": team_code},
        {
            "$setOnInsert": {
                "competitionId": competitionId,
                "teamCode": team_code,
                "unlockedDoors": [],
                "spentPoints": 0,
                "currentNodeId": config["startNodeId"],
            }
        },
        upsert=True,
    )

    # Puertas sin dirección: se pueden cruzar desde cualquiera de sus dos nodos.
    progress = await db["maze_progress"].find_one(
        {"competitionId": competitionId, "teamCode": team_code}
    )
    current = progress.get("currentNodeId", config["startNodeId"]) if progress else config["startNodeId"]
    if current == door["from_node"]:
        target_node = door["to_node"]
    elif current == door["to_node"]:
        target_node = door["from_node"]
    else:
        target_node = None

    result = None
    if target_node is not None:
        # Atomic: adjacency + not already unlocked + affordable
        result = await db["maze_progress"].update_one(
            {
                "competitionId": competitionId,
                "teamCode": team_code,
                "currentNodeId": current,
                "unlockedDoors": {"$ne": door_id},
                "$expr": {"$lte": [{"$add": ["$spentPoints", door["cost"]]}, team_points]},
            },
            {
                "$inc": {"spentPoints": door["cost"]},
                "$addToSet": {"unlockedDoors": door_id},
                "$set": {"currentNodeId": target_node},
            },
        )

    if result is None or result.modified_count == 0:
        progress = await db["maze_progress"].find_one(
            {"competitionId": competitionId, "teamCode": team_code}
        )
        current = progress.get("currentNodeId", config["startNodeId"]) if progress else config["startNodeId"]
        spent = progress.get("spentPoints", 0) if progress else 0
        unlocked = progress.get("unlockedDoors", []) if progress else []

        if door["from_node"] != current and door["to_node"] != current:
            raise HTTPException(status_code=400, detail="No puedes abrir esa puerta desde tu posición actual")
        if door_id in unlocked:
            raise HTTPException(status_code=400, detail="Esa puerta ya está abierta")
        available = team_points - spent
        raise HTTPException(
            status_code=400,
            detail=f"Puntos insuficientes. Necesitas {door['cost']}, tienes {available} disponibles",
        )

    await manager.broadcast(competitionId, {
        "event": "door_unlocked",
        "data": {
            "teamCode": team_code,
            "doorId": door_id,
            "newNode": target_node,
            "cost": door["cost"],
        },
    })

    won, position, podium_complete = await _register_goal_arrival(
        competitionId, competition, config, team_code, target_node
    )

    progress = await db["maze_progress"].find_one(
        {"competitionId": competitionId, "teamCode": team_code}, {"_id": 0}
    )
    team = await db["teams"].find_one({"code": team_code}, {"_id": 0, "points": 1})
    spent = progress.get("spentPoints", 0) if progress else 0
    earned = team.get("points", 0) if team else 0

    return {
        "message": "Puerta abierta",
        "newNode": target_node,
        "availablePoints": earned - spent,
        "reachedGoal": won,
        "position": position,
        "gameOver": podium_complete,
    }
