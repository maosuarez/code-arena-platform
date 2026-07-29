import os
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, status
from pydantic import BaseModel
from app.models_entity.competition import Competition, RequestCompetition, Problem, CompetitionUpdate
from app.database import db
import uuid

from app.models_entity.teams import Submission
from app.routes.auth import get_current_user, require_admin
from app.services.users import validate_competition_date
from app.services.websocket_manager import manager
from app.services.judge0 import judge_submission
from app.services.competition_lifecycle import sync_competition_status, compute_effective_status

logger = logging.getLogger(__name__)

MAX_SOURCE_CODE_BYTES = 65536  # 64 KB


router = APIRouter()


async def _resolve_bank_problems(bank_ids: list[str]) -> list[dict]:
    """Fetch problems referenced by id from the shared problem bank, preserving order."""
    if not bank_ids:
        return []
    bank_docs = await db["problems"].find({"id": {"$in": bank_ids}}, {"_id": 0}).to_list(length=len(bank_ids))
    bank_by_id = {d["id"]: d for d in bank_docs}
    missing = [bid for bid in bank_ids if bid not in bank_by_id]
    if missing:
        raise HTTPException(status_code=400, detail=f"Problemas no encontrados en el banco: {', '.join(missing)}")
    return [bank_by_id[bid] for bid in bank_ids]


@router.post("/create")
async def create_competition(req: RequestCompetition, _user: dict = Depends(require_admin)):
    # Validación de campos obligatorios
    required_fields = ["title", "date", "status"]
    missing = [field for field in required_fields if not getattr(req, field, None)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Faltan campos: {', '.join(missing)}")

    dict_req = req.dict()
    dict_req['id'] = str(uuid.uuid4())

    # Problemas inline: separar testCases (se persisten aparte) y asegurar id
    # (Problem.id es obligatorio; ProblemCreate.id es opcional).
    inline_test_cases: dict[str, list] = {}
    for orig, p in zip(req.problems, dict_req.get("problems", [])):
        test_cases = p.pop("testCases", None)
        if not p.get("id"):
            p["id"] = str(uuid.uuid4())
        if orig.testCases:
            inline_test_cases[p["id"]] = [tc.dict() for tc in orig.testCases]

    # Problemas referenciados del banco (`problem_ids`): sus test cases ya viven
    # en la colección `testcases` bajo el mismo id, no hay nada que copiar.
    bank_ids = dict_req.pop("problem_ids", []) or []
    bank_problems = await _resolve_bank_problems(bank_ids)

    dict_req["problems"] = bank_problems + dict_req.get("problems", [])

    # Validar y transformar el modelo
    try:
        comp = Competition.model_validate(dict_req, strict=False)
    except Exception:
        logger.exception("Error validando el modelo Competition")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


    # Verificar si ya existe una competición con ese título
    existing = await db["competition"].find_one({"id": comp.id})
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una competición")

    # Serializar para MongoDB
    comp_doc = comp.model_dump(mode="json")
    for problem in comp_doc.get("problems", []):
        if not problem.get("id"):
            problem["id"] = str(uuid.uuid4())

    # Insertar en la base de datos
    try:
        await db["competition"].insert_one(comp_doc)
    except Exception:
        logger.exception("Error al guardar la competición en la base de datos")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

    # Guardar los test cases de los problemas inline en colección separada (nunca
    # expuestos al cliente). Los problemas de banco ya tienen sus casos guardados
    # bajo el mismo id, no hace falta volver a escribirlos.
    for prob_id, cases in inline_test_cases.items():
        await db["testcases"].replace_one(
            {"problemId": prob_id},
            {"problemId": prob_id, "cases": cases},
            upsert=True,
        )

    return {
        "message": "Competición creada exitosamente",
        "id": comp_doc["id"],
        "title": comp.title,
        "status": comp.status
    }


@router.get("/all")
async def get_all_competitions():
    try:
        raw_comps = await db["competition"].find().to_list(length=100)

        competitions = []
        for comp in raw_comps:
            comp.pop("_id")

            # Convertir fechas a datetime si están como string
            if "date" in comp and isinstance(comp["date"], str):
                try:
                    comp["date"] = datetime.fromisoformat(comp["date"])
                except Exception:
                    pass  # Si falla, se deja como está

            # Si hay fechas anidadas, como en problems
            if "problems" in comp:
                for p in comp["problems"]:
                    if "_id" in p:
                        p["id"] = str(p.pop("_id"))

            comp = await sync_competition_status(comp)
            competitions.append(comp)

        return {"list": competitions}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error al obtener competiciones")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@router.post("/join")
async def join_team_to_competition(
    teamCode: str = Body(...),
    competitionId: str = Body(...),
    user: dict = Depends(get_current_user),
):
    # Autorización: solo puedes inscribir tu propio equipo (o ser admin).
    if not user.get("is_admin", False) and user.get("teamCode") != teamCode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes inscribir el equipo al que perteneces",
        )

    competition = await db["competition"].find_one({'id': competitionId})
    if not competition:
        raise HTTPException(status_code=404, detail="Competición no encontrada para ese usuario")

    try:
        result = await db["competition"].update_one(
            {"id": competitionId, "teams": {"$ne": teamCode}},
            {"$addToSet": {"teams": teamCode}}
        )
    except Exception:
        logger.exception("Error al actualizar equipos en la competición")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="El equipo ya está registrado en esta competencia")

    competition_updated = await db["competition"].find_one({"id": competitionId})

    # Avisa al resto del equipo (vía su propio topic) que ya quedaron inscritos,
    # para que la UI se actualice sola y nadie intente unirse de nuevo sin querer.
    await manager.broadcast_team(teamCode, {
        "event": "team_joined_competition",
        "data": {"competitionId": competitionId, "teamCode": teamCode},
    })

    return {
        "message": "Equipo registrado exitosamente",
        "competitionId": competitionId,
        "teamCode": teamCode,
        "totalTeams": len(competition_updated.get("teams", []))
    }

class CheerRequest(BaseModel):
    message: str

@router.post("/{competitionId}/cheer")
async def cheer_team(
    competitionId: str,
    req: CheerRequest,
    user: dict = Depends(get_current_user),
):
    team_code = user.get("teamCode")
    if not team_code:
        raise HTTPException(status_code=400, detail="Usuario sin equipo asignado")

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")
    if len(message) > 200:
        raise HTTPException(status_code=400, detail="El mensaje es demasiado largo")

    await manager.broadcast(competitionId, {
        "event": "cheer",
        "data": {
            "teamCode": team_code,
            "member": user.get("username"),
            "message": message,
        },
    })
    return {"message": "Ánimo enviado"}


@router.get("/problem-stats")
async def get_problem_stats():
    pipeline = [
        {"$unwind": "$problems"},
        {"$group": {"_id": "$problems.difficulty", "count": {"$sum": 1}}}
    ]
    results = await db["competition"].aggregate(pipeline).to_list(None)
    stats = {r["_id"]: r["count"] for r in results}
    return {"easy": stats.get("easy", 0), "medium": stats.get("medium", 0), "hard": stats.get("hard", 0)}


@router.get("/{competitionId}")
async def get_competition_by_id(competitionId: str):
    competition = await db["competition"].find_one({"id": competitionId})
    if not competition:
        raise HTTPException(status_code=404, detail="Competición no encontrada")

    # Opcional: eliminar '_id' si no quieres exponerlo
    competition.pop("_id", None)

    # Asegurar que 'date' esté como datetime
    if "date" in competition and isinstance(competition["date"], str):
        try:
            competition["date"] = datetime.fromisoformat(competition["date"])
        except Exception:
            pass  # Si ya es datetime o falla la conversión, se deja como está

    competition = await sync_competition_status(competition)
    return {"competition": competition}

@router.get("/private/{competitionId}")
async def get_competition_private(
    competitionId: str,
    user: dict = Depends(get_current_user)
):
    # 🔍 Validación de competencia
    competition = await db["competition"].find_one({"id": competitionId})
    if not competition:
        raise HTTPException(status_code=404, detail="Competición no encontrada")

    competition.pop("_id", None)

    # 🗓️ Parseo robusto de fecha
    if isinstance(competition.get("date"), str):
        try:
            competition["date"] = datetime.fromisoformat(competition["date"])
        except ValueError:
            competition["date"] = None  # fallback explícito

    competition = await sync_competition_status(competition)

    # 🔒 La competencia aún no inició: no enviar el contenido de los problemas
    # (statement / hidden_instructions), solo lo necesario para listarlos. Si no
    # se hiciera aquí, el enunciado ya viajaría en este payload aunque el
    # frontend bloquee el diálogo — dando ventaja a quien mire la network tab.
    if competition.get("status") == "upcoming":
        competition["problems"] = [
            {
                "id": p.get("id"),
                "title": p.get("title"),
                "difficulty": p.get("difficulty"),
                "language_ids": p.get("language_ids"),
            }
            for p in competition.get("problems", [])
        ]

    team_data: Optional[dict] = None

    # 🧠 Validación de equipo del usuario
    team_code = user.get("teamCode")
    if team_code:
        team = await db["teams"].find_one({"code": team_code})
        if team:
            team.pop("_id", None)

            # 👥 Miembros del equipo
            members_cursor = db["users"].find({"teamCode": team_code})
            members = [
                {
                    "id": str(member.get("_id")),
                    "username": member.get("username"),
                }
                async for member in members_cursor
            ]

            # 🏆 Equipos en competencia
            team_codes = competition.get("teams", [])
            all_teams = []

            for code in team_codes:
                other_team = await db["teams"].find_one({"code": code})
                if other_team:
                    all_teams.append({
                        "code": other_team.get("code"),
                        "points": other_team.get("points", 0)
                    })

            # 📊 Ranking con empates
            sorted_teams = sorted(all_teams, key=lambda x: x["points"], reverse=True)
            position = None
            last_points = None
            current_rank = 0

            for idx, t in enumerate(sorted_teams):
                if t["points"] != last_points:
                    current_rank = idx + 1
                    last_points = t["points"]
                if t["code"] == team_code:
                    position = current_rank
                    break

            # 📦 Datos del equipo
            team_data = {
                "team": {
                    "code": team.get("code"),
                    "name": team.get("teamName"),
                    "members": members,
                    "submissions": team.get("submissions", []),
                    "points": team.get("points", 0),
                    "ranking": position,
                    "totalTeams": len(sorted_teams),
                    'avatar': team.get('avatar', '')
                }
            }

    # 📤 Respuesta final: hidden_instructions viaja intencionalmente al cliente —
    # es el señuelo anti-copia (se inyecta invisible en el enunciado para
    # envenenar silenciosamente cualquier copy-paste a un asistente de IA).
    return {
        "competition": competition,
        "team": team_data
    }


class SubmissionRequest(BaseModel):
    source_code: str
    language_id: int

class SubmissionRequestFallback(BaseModel):
    source_code: Optional[str] = None
    language_id: Optional[int] = None
    validation_code: Optional[str] = None

@router.post("/submission/{competitionId}/{problemId}")
async def create_submission(
    competitionId: str,
    problemId: str,
    req: SubmissionRequestFallback = Body(...),
    user: dict = Depends(get_current_user)
):
    judge_key = os.getenv("JUDGE0_API_KEY", "")
    fallback_code = os.getenv("VALIDATION_CODE", "")

    if judge_key:
        # Judge0 mode: validate via actual code execution
        if not req.source_code or not req.language_id:
            raise HTTPException(status_code=400, detail="Se requieren source_code y language_id")
        if len(req.source_code.encode("utf-8")) > MAX_SOURCE_CODE_BYTES:
            raise HTTPException(status_code=400, detail="El código fuente excede el tamaño máximo permitido")
    elif fallback_code:
        # Fallback mode: simple validation code
        if req.validation_code != fallback_code:
            raise HTTPException(status_code=403, detail="Código de validación incorrecto")
    else:
        raise HTTPException(status_code=500, detail="El servidor no tiene JUDGE0_API_KEY ni VALIDATION_CODE configurados")

    try:
        # Validar usuario autenticado
        username = user.get("username")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no autenticado")

        # Buscar competencia
        competition = await db["competition"].find_one({"id": competitionId})
        if not competition:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competencia no encontrada")
        # Si el tiempo ya venció, ciérrala con el líder en puntos como ganador
        # antes de evaluar si puede recibir este envío.
        competition = await sync_competition_status(competition)

        # Validar problema dentro de la competencia
        problem_data = next((p for p in competition.get('problems', []) if str(p.get('id', '')) == problemId), None)
        if not problem_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problema no encontrado en la competencia")

        # Validar lenguaje permitido para este problema (Fix HIGH-4)
        if judge_key and req.language_id is not None:
            allowed_languages = problem_data.get("language_ids", list(range(1, 200)))
            if req.language_id not in allowed_languages:
                raise HTTPException(status_code=400, detail="Lenguaje no permitido para este problema")

        # Calcular puntos
        difficulty = problem_data.get("difficulty")
        points = competition.get("scoring", {}).get(difficulty, 0)

        # Validar y calcular tiempo desde inicio
        now = datetime.now(timezone.utc)
        from datetime import timedelta

        # Prefer explicit start_time/end_time; fall back to date + duration
        raw_start = competition.get("start_time") or competition.get("date")
        raw_end = competition.get("end_time")
        start_time = validate_competition_date(raw_start)
        if raw_end:
            end_time = validate_competition_date(raw_end)
        else:
            duration_minutes = competition.get("duration", 0)
            end_time = start_time + timedelta(minutes=duration_minutes)

        elapsed_seconds = int((now - start_time).total_seconds())

        # Verificar que la competencia esté activa
        comp_status = competition.get("status")
        if comp_status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La competencia no está activa (estado actual: {comp_status})"
            )

        # Verificar que la competencia haya comenzado
        if now < start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La competencia aún no ha comenzado"
            )

        # Verificar que no haya terminado el tiempo
        if now > end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El tiempo de la competencia ha terminado"
            )

        # Buscar usuario y equipo
        user_data = await db["users"].find_one({"username": username})
        if not user_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

        team_code = user_data.get("teamCode")
        if not team_code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario no tiene equipo asignado")

        team = await db["teams"].find_one({"code": team_code})
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipo no encontrado")

        # Verificar que el equipo esté inscrito en esta competencia
        competition_teams = competition.get("teams", [])
        if team_code not in competition_teams:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu equipo no está inscrito en esta competencia"
            )

        # Verificar doble submission
        existing_submissions = team.get("submissions", [])
        already_solved = any(str(s.get("problem", "")) == problemId for s in existing_submissions)
        if already_solved:
            raise HTTPException(status_code=400, detail="Este problema ya fue validado por tu equipo")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error inesperado en create_submission")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor")

    # Judge0 validation (only if API key is configured and source_code was provided)
    if judge_key and req.source_code:
        tc_doc = await db["testcases"].find_one({"problemId": problemId})
        test_cases = tc_doc.get("cases", []) if tc_doc else []
        passed, error_msg = await judge_submission(
            source_code=req.source_code,
            language_id=req.language_id,
            test_cases=test_cases,
            time_limit=problem_data.get("time_limit", 2.0),
            memory_limit=problem_data.get("memory_limit", 256),
        )
        if not passed:
            raise HTTPException(status_code=400, detail=error_msg or "Solución incorrecta")

    # Actualizar puntos con $inc atómico (evita race condition)
    try:
        await db["teams"].update_one(
            {"code": team_code},
            {
                "$inc": {"points": points},
                "$push": {"submissions": Submission.model_validate(
                    {'problem': problemId,
                     'status': "AC",
                     'time': elapsed_seconds,
                     'member': username,
                     'points': points}, strict=False
                ).dict()}
            }
        )
    except Exception:
        logger.exception("Error al actualizar puntos del equipo tras submission")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor")

    # WebSocket broadcast para ranking en tiempo real.
    # Los campos coinciden 1:1 con Submission para que el equipo no note diferencia
    # entre lo que llega por socket y lo que se obtiene al recargar.
    await manager.broadcast(competitionId, {
        "event": "new_submission",
        "data": {
            "problem": problemId,
            "status": "AC",
            "member": username,
            "points": points,
            "teamCode": team_code,
            "time": elapsed_seconds
        }
    })

    return {
        "submission": {
            "problem": problemId,
            "status": "AC",
            "time": elapsed_seconds,
            "member": username,
            "points": points
        }
    }


class TestCaseUpsert(BaseModel):
    cases: list[dict]

@router.put("/problems/{problemId}/testcases")
async def upsert_testcases(
    problemId: str,
    body: TestCaseUpsert,
    _user: dict = Depends(require_admin),
):
    """Admin endpoint to set test cases for a problem."""
    await db["testcases"].replace_one(
        {"problemId": problemId},
        {"problemId": problemId, "cases": body.cases},
        upsert=True,
    )
    return {"message": f"{len(body.cases)} casos de prueba guardados", "problemId": problemId}


@router.get("/problems/{problemId}/testcases")
async def get_testcases(problemId: str, _user: dict = Depends(require_admin)):
    doc = await db["testcases"].find_one({"problemId": problemId}, {"_id": 0})
    if not doc:
        return {"problemId": problemId, "cases": []}
    return doc


@router.patch("/{competitionId}")
async def update_competition(
    competitionId: str,
    update: CompetitionUpdate,
    _user: dict = Depends(require_admin),
):
    """Admin endpoint to partially update a competition."""
    existing = await db["competition"].find_one({"id": competitionId})
    if not existing:
        raise HTTPException(status_code=404, detail="Competición no encontrada")

    # Build update dict — only include fields that were explicitly set
    update_data = update.model_dump(mode="json", exclude_none=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")

    # Handle problems update: strip testCases, upsert them separately, and resolve
    # any bank-referenced problem_ids alongside inline problems.
    if "problems" in update_data or "problem_ids" in update_data:
        raw_problems = update_data.pop("problems", [])
        clean_problems = []
        for p in raw_problems:
            test_cases = p.pop("testCases", [])
            prob_id = p.get("id") or str(uuid.uuid4())
            p["id"] = prob_id
            clean_problems.append(p)
            if test_cases:
                await db["testcases"].replace_one(
                    {"problemId": prob_id},
                    {"problemId": prob_id, "cases": test_cases},
                    upsert=True,
                )

        bank_ids = update_data.pop("problem_ids", []) or []
        bank_problems = await _resolve_bank_problems(bank_ids)

        update_data["problems"] = bank_problems + clean_problems

    # Recompute status from the resulting dates instead of trusting whatever
    # `status` the client sent — the admin dashboard always includes the value
    # that was current when the edit dialog opened, which goes stale the
    # moment start/end time change (e.g. editing an "upcoming" competition to
    # start now doesn't flip its dropdown to "active"). compute_effective_status
    # still honors an explicit "completed"/"inactive" in the payload, so
    # intentional terminal states are preserved.
    merged = {**existing, **update_data}
    update_data["status"] = compute_effective_status(merged)

    try:
        await db["competition"].update_one(
            {"id": competitionId},
            {"$set": update_data},
        )
    except Exception:
        logger.exception("Error al actualizar la competición")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

    return {"message": "Competición actualizada", "id": competitionId}


@router.delete("/{competitionId}")
async def delete_competition(competitionId: str, _user: dict = Depends(require_admin)):
    """Admin endpoint to permanently delete a competition and its maze data."""
    result = await db["competition"].delete_one({"id": competitionId})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Competición no encontrada")

    await db["maze_configs"].delete_one({"competitionId": competitionId})
    await db["maze_progress"].delete_many({"competitionId": competitionId})

    return {"message": "Competición eliminada", "id": competitionId}

