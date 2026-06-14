from fastapi import APIRouter, Depends, HTTPException, status
from uuid import uuid4
from bson import ObjectId
from app.database import db
from app.models_entity.teams import TeamCreateRequest, TeamCode, JoinTeamRequest
from app.services.users import generate_unique_code
from app.routes.auth import get_current_user

router = APIRouter()

# ────────────────────────────────────────────────────────────────
@router.post("/create")
async def create_team(request: TeamCreateRequest, current_user: dict = Depends(get_current_user)):
    try:
        # Generar código único
        existing_codes_cursor = db["teams"].find({}, {"code": 1})
        existing_codes_list = await existing_codes_cursor.to_list(length=None)
        existing_codes = {team["code"] for team in existing_codes_list}

        code = generate_unique_code(existing_codes)

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


        insert_result = await db["teams"].insert_one(team.dict())
        previous_code = current_user.get("teamCode")

        # Si tenía equipo anterior
        if previous_code:
            old_team = await db["teams"].find_one({"code": previous_code})
            if old_team:
                updated_members = old_team["currentMembers"] - 1
                if updated_members <= 0:
                    try:
                        await db["teams"].delete_one({"code": previous_code})
                    except:
                        pass
                else:
                    await db["teams"].update_one(
                        {"code": previous_code},
                        {"$set": {"currentMembers": updated_members}}
                    )

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
        # Buscar equipo
        team = await db["teams"].find_one({"code": request.teamCode})
        if not team:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")

        if team["currentMembers"] >= team["maxMembers"]:
            raise HTTPException(status_code=400, detail="El equipo ya está completo")

        # Actualizar usuario con el nuevo teamCode
        update_user = await db["users"].update_one(
            {"username": current_user["username"]},
            {"$set": {"teamCode": request.teamCode}}
        )
        if update_user.modified_count == 0:
            raise HTTPException(status_code=400, detail="No se pudo actualizar el usuario")

        # Incrementar miembros del equipo
        await db["teams"].update_one(
            {"code": request.teamCode},
            {"$inc": {"currentMembers": 1}}
        )

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
            old_team = await db["teams"].find_one({"code": previous_code})
            if old_team:
                updated_members = old_team["currentMembers"] - 1
                if updated_members <= 0:
                    await db["teams"].delete_one({"code": previous_code})
                else:
                    await db["teams"].update_one(
                        {"code": previous_code},
                        {"$set": {"currentMembers": updated_members}}
                    )

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

