from fastapi import APIRouter, Depends, HTTPException, status
import string
import random
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from app.database import db
from app.models_entity.teams import TeamCreateRequest, TeamCode, JoinTeamRequest
from app.routes.auth import get_current_user

router = APIRouter()

# ────────────────────────────────────────────────────────────────
@router.post("/create")
async def create_team(request: TeamCreateRequest, current_user: dict = Depends(get_current_user)):
    try:
        # Generar código único con retry atómico (evita race condition)
        insert_result = None
        code = None
        for _ in range(10):
            code = ''.join(random.choices(string.ascii_uppercase, k=6))
            try:
                team = TeamCode.model_validate({
                    "code": code,
                    "teamName": request.teamName,
                    "avatar": request.avatar,
                    "color": request.color,
                    "maxMembers": request.maxMembers,
                    "currentMembers": 1,
                }, strict=False)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error creando el TeamCode: {str(e)}")
            try:
                insert_result = await db["teams"].insert_one(team.dict())
                break
            except DuplicateKeyError:
                continue
        else:
            raise HTTPException(status_code=500, detail="No se pudo generar un código único")

        if insert_result is None:
            raise HTTPException(status_code=500, detail="No se pudo generar un código único")
        previous_code = current_user.get("teamCode")

        # Si tenía equipo anterior
        if previous_code:
            result = await db["teams"].update_one(
                {"code": previous_code, "currentMembers": {"$gt": 1}},
                {"$inc": {"currentMembers": -1}}
            )
            if result.modified_count == 0:
                await db["teams"].delete_one({"code": previous_code})

        user = await db["users"].find_one({"username": current_user["username"]})
        if not user:
            raise HTTPException(status_code=404, detail=f"Usuario no encontrado ")
           
        # Asociar nuevo equipo al usuario
        await db["users"].update_one({"username": current_user["username"]}, {"$set": {"teamCode": code}})

        created_team = await db["teams"].find_one({"_id": insert_result.inserted_id})
        created_team["id"] = str(created_team.pop("_id"))  # Renombrar _id a id

        return {"message": "Equipo creado exitosamente", "team": created_team}

    except HTTPException as http_err:
        raise http_err

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al crear el equipo: {str(e)}")

# ────────────────────────────────────────────────────────────────
@router.post("/join")
async def join_team(request: JoinTeamRequest, current_user: dict = Depends(get_current_user)):
    try:
        # Buscar equipo para validar que existe antes del update atómico
        team = await db["teams"].find_one({"code": request.teamCode})
        if not team:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")

        # Incremento atómico: solo actualiza si hay cupo disponible
        updated_team = await db["teams"].find_one_and_update(
            {"code": request.teamCode, "currentMembers": {"$lt": team["maxMembers"]}},
            {"$inc": {"currentMembers": 1}},
        )
        if updated_team is None:
            raise HTTPException(status_code=400, detail="El equipo ya está completo")

        # Actualizar usuario con el nuevo teamCode
        update_user = await db["users"].update_one(
            {"username": current_user["username"]},
            {"$set": {"teamCode": request.teamCode}}
        )
        if update_user.modified_count == 0:
            await db["teams"].update_one(
                {"code": request.teamCode},
                {"$inc": {"currentMembers": -1}}
            )
            raise HTTPException(status_code=400, detail="No se pudo actualizar el usuario")

        return {"message": "Unido al equipo exitosamente", "teamCode": request.teamCode}

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al unirse al equipo: {str(e)}")


# ────────────────────────────────────────────────────────────────
@router.delete("/delete")
async def delete_team(current_user: dict = Depends(get_current_user)):
    try:
        user = await db["users"].find_one({"username": current_user["username"]})
        if not user:
            raise HTTPException(status_code=401, detail="Token inválido")

        previous_code = user.get("teamCode")
        if previous_code:
            result = await db["teams"].update_one(
                {"code": previous_code, "currentMembers": {"$gt": 1}},
                {"$inc": {"currentMembers": -1}}
            )
            if result.modified_count == 0:
                await db["teams"].delete_one({"code": previous_code})

        await db["users"].update_one(
            {"username": current_user["username"]},
            {"$set": {"teamCode": ""}}
        )

        return {"message": "Equipo eliminado o desvinculado"}

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al eliminar el equipo: {str(e)}")


# ────────────────────────────────────────────────────────────────
@router.get("/team/{team_code}")
async def get_team_by_code(team_code: str, current_user: dict = Depends(get_current_user)):
    try:
        team = await db["teams"].find_one({"code": team_code})
        if not team:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")

        members_cursor = db["users"].find({"teamCode": team_code})
        members_list = await members_cursor.to_list(length=None)

        members = [
            {
                "id": str(member["_id"]),
                "username": member["username"],
                "email": member["email"],
            }
            for member in members_list
        ]

        team["id"] = str(team.pop("_id"))  # Renombra _id a id y lo convierte a string

        return {
            "team": TeamCode(**team),
            "members": members
        }

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al obtener el equipo: {str(e)}")

