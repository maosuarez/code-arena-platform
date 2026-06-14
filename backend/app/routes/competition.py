from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, status
from app.models_entity.competition import Competition, RequestCompetition
from app.database import db
import uuid

from app.models_entity.teams import Submission
from app.routes.auth import get_current_user
from app.services.users import validate_competition_date

router = APIRouter()

@router.post("/create")
async def create_competition(req: RequestCompetition):
    # Validación de campos obligatorios
    required_fields = ["title", "date", "status"]
    missing = [field for field in required_fields if not getattr(req, field, None)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Faltan campos: {', '.join(missing)}")

    dict_req = req.dict()
    dict_req['id'] = str(uuid.uuid4())  # Asegúrate de convertirlo a string si el modelo espera str

    # Validar y transformar el modelo
    try:
        comp = Competition.model_validate(dict_req, strict=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando el Competition: {str(e)}")


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")

    return {
        "message": "Competición creada exitosamente",
        "id": comp.title,
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

            competitions.append(comp)

        return {"list": competitions}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener competiciones: {str(e)}")


@router.post("/join")
async def join_team_to_competition(
    teamCode: str = Body(...),
    competitionId: str = Body(...)
):
    competition = await db["competition"].find_one({'id': competitionId})
    if not competition:
        raise HTTPException(status_code=404, detail="Competición no encontrada para ese usuario")

    teams = competition.get("teams", [])
    if teamCode in teams:
        raise HTTPException(status_code=400, detail="El equipo ya está registrado")

    teams.append(teamCode)

    try:
        await db["competition"].update_one(
            {"id": competitionId},
            {"$set": {"teams": teams}}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar equipos: {str(e)}")

    return {
        "message": "Equipo registrado exitosamente",
        "username": competitionId,
        "teamCode": teamCode,
        "totalTeams": len(teams)
    }

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
                    "leetcode": member.get("leetcode")
                }
                async for member in members_cursor
            ]

            # 🏆 Equipos en competencia
            team_codes = competition.get("teams", [])
            all_teams = []

            for code in team_codes:
                team = await db["teams"].find_one({"code": code})
                if team:
                    all_teams.append({
                        "code": team.get("code"),
                        "points": team.get("points", 0)
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
                    "name": team.get("teamName"),
                    "members": members,
                    "submissions": team.get("submissions", []),
                    "points": team.get("points", 0),
                    "ranking": position,
                    "totalTeams": len(sorted_teams),
                    'avatar': team.get('avatar', '')
                }
            }

    # 📤 Respuesta final
    return {
        "competition": competition,
        "team": team_data
    }


@router.post("/submission/{competitionId}/{problemId}")
async def create_submission(
    competitionId: str,
    problemId: str,
    user: dict = Depends(get_current_user)
):
    try:
        # 👤 Validar usuario autenticado
        username = user.get("username")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no autenticado")

        # 🔍 Buscar competencia
        competition = await db["competition"].find_one({"id": competitionId})
        if not competition:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competencia no encontrada")

        # 🔍 Validar problema dentro de la competencia
        problem_data = next((p for p in competition.get('problems', []) if str(p.get('id', '')) == problemId), None)
        if not problem_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problema no encontrado en la competencia")

        # 🧮 Calcular puntos
        difficulty = problem_data.get("difficulty")
        points = competition.get("scoring", {}).get(difficulty, 0)

        # ⏱️ Validar y calcular tiempo desde inicio
        start_time = validate_competition_date(competition.get("date"))
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        elapsed_seconds = int((now - start_time).total_seconds())

        # 🔎 Buscar usuario y equipo
        user_data = await db["users"].find_one({"username": username})
        if not user_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

        team_code = user_data.get("teamCode")
        if not team_code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario no tiene equipo asignado")

        team = await db["teams"].find_one({"code": team_code})
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipo no encontrado")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"{e}")

    # ➕ Actualizar puntos del equipo
    try:
        await db["teams"].update_one(
            {"code": team_code},
            {
                "$set": {"points": team.get("points", 0) + points},
                "$push": {"submissions": Submission.model_validate(
                    {'problem':problemId,
                    'status':"AC",
                    'time':elapsed_seconds,
                    'member':username,
                    'points':points}, strict=False
                ).dict()}
            }
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al actualizar equipo: {str(e)}")

    return {
        "submission": {
            "problem": problemId,
            "status": "AC",
            "time": elapsed_seconds,
            "member": username,
            "points": points
        }
    }

