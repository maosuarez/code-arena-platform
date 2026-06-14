from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from app.database import db
import random

router = APIRouter()

def format_seconds(seconds: int) -> str:
    return str(timedelta(seconds=seconds))

def get_time_remaining(start_str: str, duration_minutes: int) -> str:
    try:
        # 🕒 Parsear la fecha de inicio
        start_time = datetime.fromisoformat(start_str)
    except ValueError:
        return "Fecha inválida"

    # ⏱️ Calcular tiempo final
    end_time = start_time + timedelta(minutes=duration_minutes)
    now = datetime.utcnow().replace(tzinfo=timezone.utc)

    # 📉 Diferencia en segundos
    remaining_seconds = int((end_time - now).total_seconds())

    if remaining_seconds <= 0:
        return "00:00:00"

    # 🧮 Convertir a HH:MM:SS
    hours = remaining_seconds // 3600
    minutes = (remaining_seconds % 3600) // 60
    seconds = remaining_seconds % 60

    return f"{hours:02}:{minutes:02}:{seconds:02}"


def generate_achievements() -> list[str]:
    logros_divertidos = [
        "💡-mente-brillante",        # Resolvieron con genialidad
        "🐢-pero-seguro",           # Lento pero constante
        "🔥-modo-fuego",            # En racha imparable
        "🧠-cerebros-en-acción",    # Pensaron fuera de la caja
        "🎯-tiro-perfecto",         # Envío sin errores
        "🕵️-detectives-del-bug",   # Encontraron el fallo oculto
        "🚀-despegue-explosivo",    # Primeros en resolver
        "🍕-code-y-comida",         # Codificaron sin soltar la pizza
        "🧃-hidratados-y-eficientes", # No olvidaron el juguito
        "🛠️-debuggers-pro",        # Arreglaron lo imposible
        "😎-nivel-jefe",            # Actitud de campeón
        "🧘-zen-coders",            # Serenidad bajo presión
        "🎉-fiesta-de-submissions", # Enviaron como locos
        "🦾-sin-miedo-al-hard",     # Se enfrentaron al reto más difícil
        "📈-subiendo-como-la-espuma", # Mejora constante
        "🧩-rompecabezas-resuelto", # Problema complejo dominado
        "👑-reyes-del-ranking",     # Lideraron la tabla
        "💪-no-se-rinden",          # Persistencia total
        "🧤-sin-mancharse",         # Cero penalizaciones
        "🎭-drama-y-gloria",        # ¡Qué jornada!
    ]
    return random.sample(logros_divertidos, k=random.randint(0, 2))


@router.get("/{competitionId}")
async def get_competition_ranking(competitionId: str):
    try:
        # 🔍 Obtener competencia
        competition = await db["competition"].find_one({"id": competitionId})
        if not competition:
            raise HTTPException(status_code=404, detail="Competencia no encontrada")

        problems = competition.get("problems", [])
        problem_lookup = {p["id"]: p["title"] for p in problems}
        team_codes = competition.get("teams", [])

        # 🔍 Obtener todos los equipos en una sola pasada
        teams_cursor = db["teams"].find({"code": {"$in": team_codes}})
        teams = [team async for team in teams_cursor]

        # 🔍 Obtener todos los usuarios en una sola pasada
        users_cursor = db["users"].find({"teamCode": {"$in": team_codes}})
        users = [user async for user in users_cursor]

        rankings = []
        solved_problems = 0

        for team in teams:
            code = team.get("code")
            submissions = team.get("submissions", [])
            solved_problems += len(submissions)
            sorted_subs = sorted(submissions, key=lambda s: s.get("time", 0))

            solves = len(submissions)
            total_time = sorted_subs[-1]["time"] if solves else 0
            total_time_str = format_seconds(total_time)

            last_submission = sorted_subs[-1] if solves else None
            second_last_time = sorted_subs[-2]["time"] if solves > 1 else 0
            last_solve_time = format_seconds(last_submission["time"] - second_last_time) if last_submission else "00:00:00"
            last_solve_title = problem_lookup.get(last_submission["problem"], "") if last_submission else ""

            member_names = [
                u["username"]
                for u in users
                if u.get("teamCode") == code
            ]

            rankings.append({
                "id": str(team.get("_id")),
                "name": team.get("teamName", ""),
                "avatar": team.get("avatar", ""),
                "color": team.get("color", "#ccc"),
                "members": member_names,
                "points": team.get("points", 0),
                "solves": solves,
                "totalTime": total_time_str,
                "lastSolve": last_solve_title,
                "lastSolveTime": last_solve_time,
                "isLastSolver": False,  # se marca luego
                "achievements": generate_achievements() 
            })

        # 🏁 Determinar quién fue el último en resolver
        if rankings:
            last_solver = max(rankings, key=lambda r: r["totalTime"])
            for r in rankings:
                r["isLastSolver"] = (r["id"] == last_solver["id"])

        # 📊 Ordenar por puntos descendente, luego por tiempo ascendente
        rankings.sort(key=lambda r: (-r["points"], r["totalTime"]))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")

    return {"ranking": rankings, 'competition': {
        'title': competition.get('title', ''),
        'teams': len(competition.get('teams', [])),
        'totalSolved': solved_problems,
        'resTime': get_time_remaining(competition.get('date', ''), competition.get('duration', 0))
    }}

