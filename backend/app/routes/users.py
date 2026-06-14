from fastapi import APIRouter, HTTPException, Depends
from pymongo.errors import PyMongoError
from app.database import db
from app.models_entity.users import User, RegisterRequest
from app.models_entity.general import Token
from app.routes.auth import (get_current_user, get_password_hash, create_access_token)

router = APIRouter()

@router.post("/register", response_model=Token)
async def register_user(user: RegisterRequest):
    try:
        if await db["users"].find_one({"username": user.email}):
            raise HTTPException(status_code=400, detail="Email ya registrado")

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
    current_user['id'] = current_user['_id']
    current_user.pop('_id', None)
    return current_user
