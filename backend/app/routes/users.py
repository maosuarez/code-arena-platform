from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from pymongo.errors import PyMongoError
from app.database import db
from app.models_entity.users import User, RegisterRequest
from app.models_entity.general import Token
from app.routes.auth import (get_current_user, get_password_hash, verify_password, create_access_token, require_admin)

router = APIRouter()


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/register", response_model=Token)
async def register_user(user: RegisterRequest):
    try:
        if await db["users"].find_one({"$or": [{"email": user.email}, {"username": user.username}]}):
            raise HTTPException(status_code=400, detail="Email o nombre de usuario ya registrado")

        new_user = User.model_validate({
            "email": user.email,
            "username": user.username,
            "password": get_password_hash(user.password)
        }, strict=False)

        result = await db["users"].insert_one(new_user.dict())
        user_id = str(result.inserted_id)

        token = create_access_token({"sub": user.email, "id": user_id})
        return {"access_token": token, "token_type": "bearer"}

    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")


@router.get("/me")
async def get_my_info(current_user: dict = Depends(get_current_user)):
    current_user.pop("password", None)
    current_user["id"] = current_user["_id"]
    current_user.pop("_id", None)
    return current_user


@router.put("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.get("password", "")):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    from bson import ObjectId
    await db["users"].update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"password": get_password_hash(body.new_password)}},
    )
    return {"message": "Contraseña actualizada"}


@router.get("/admin/stats")
async def admin_stats(_admin: dict = Depends(require_admin)):
    users_cursor = db["users"].find({}, {"password": 0})
    users_list = []
    async for u in users_cursor:
        u["id"] = str(u.pop("_id"))
        users_list.append(u)

    teams_cursor = db["teams"].find({})
    teams_list = []
    async for t in teams_cursor:
        t["id"] = str(t.pop("_id"))
        teams_list.append(t)

    competitions_cursor = db["competition"].find({})
    competitions_list = []
    async for c in competitions_cursor:
        c.pop("_id", None)
        competitions_list.append(c)

    return {
        "users": users_list,
        "teams": teams_list,
        "competitions": competitions_list,
    }
