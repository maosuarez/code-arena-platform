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


@router.get("/{competitionId}/state")
async def get_maze_state(competitionId: str):
    config = await db["maze_configs"].find_one({"competitionId": competitionId}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Laberinto no configurado para esta competencia")

    raw_progress = await db["maze_progress"].find(
        {"competitionId": competitionId}, {"_id": 0}
    ).to_list(length=200)

    teams = []
    for p in raw_progress:
        team = await db["teams"].find_one(
            {"code": p["teamCode"]}, {"_id": 0, "teamName": 1, "points": 1, "avatar": 1}
        )
        spent = p.get("spentPoints", 0)
        earned = team.get("points", 0) if team else 0
        teams.append({
            "teamCode": p["teamCode"],
            "teamName": team.get("teamName", p["teamCode"]) if team else p["teamCode"],
            "avatar": team.get("avatar", "") if team else "",
            "currentNodeId": p.get("currentNodeId", config.get("startNodeId")),
            "unlockedDoors": p.get("unlockedDoors", []),
            "spentPoints": spent,
            "earnedPoints": earned,
            "availablePoints": earned - spent,
        })

    return {"config": config, "teams": teams}


class UnlockRequest(BaseModel):
    door_id: str

@router.post("/{competitionId}/unlock")
async def unlock_door(
    competitionId: str,
    req: UnlockRequest,
    user: dict = Depends(get_current_user),
):
    door_id = req.door_id
    config = await db["maze_configs"].find_one({"competitionId": competitionId})
    if not config:
        raise HTTPException(status_code=404, detail="Laberinto no encontrado")

    door = next((d for d in config.get("doors", []) if d["id"] == door_id), None)
    if not door:
        raise HTTPException(status_code=404, detail="Puerta no encontrada")

    user_data = await db["users"].find_one({"username": user.get("username")})
    team_code = user_data.get("teamCode") if user_data else None
    if not team_code:
        raise HTTPException(status_code=400, detail="Usuario sin equipo asignado")

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

    # Atomic: adjacency + not already unlocked + affordable
    result = await db["maze_progress"].update_one(
        {
            "competitionId": competitionId,
            "teamCode": team_code,
            "currentNodeId": door["from_node"],
            "unlockedDoors": {"$ne": door_id},
            "$expr": {"$lte": [{"$add": ["$spentPoints", door["cost"]]}, team_points]},
        },
        {
            "$inc": {"spentPoints": door["cost"]},
            "$addToSet": {"unlockedDoors": door_id},
            "$set": {"currentNodeId": door["to_node"]},
        },
    )

    if result.modified_count == 0:
        progress = await db["maze_progress"].find_one(
            {"competitionId": competitionId, "teamCode": team_code}
        )
        current = progress.get("currentNodeId", config["startNodeId"]) if progress else config["startNodeId"]
        spent = progress.get("spentPoints", 0) if progress else 0
        unlocked = progress.get("unlockedDoors", []) if progress else []

        if door["from_node"] != current:
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
            "newNode": door["to_node"],
            "cost": door["cost"],
        },
    })

    progress = await db["maze_progress"].find_one(
        {"competitionId": competitionId, "teamCode": team_code}, {"_id": 0}
    )
    team = await db["teams"].find_one({"code": team_code}, {"_id": 0, "points": 1})
    spent = progress.get("spentPoints", 0) if progress else 0
    earned = team.get("points", 0) if team else 0

    return {
        "message": "Puerta abierta",
        "newNode": door["to_node"],
        "availablePoints": earned - spent,
    }
