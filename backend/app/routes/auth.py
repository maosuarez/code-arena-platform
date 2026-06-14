# ─── Importaciones ─────────────────────────────────────────────────────────────
import os
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt, ExpiredSignatureError
from passlib.context import CryptContext
from app.database import db

# ─── Configuración de Seguridad ────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "supersecret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter()

# ─── Utilidades ────────────────────────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ─── Endpoint de Login ─────────────────────────────────────────────────────────

@router.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    user = await db["users"].find_one({"username": username})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    if not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contraseña incorrecta")

    token_data = {
        "sub": user["email"],
        "id": str(user["_id"]),
        "exp": int((datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp())
    }
    access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    return JSONResponse({
        "access_token": access_token,
        "token_type": "bearer",
        "teamCode": user.get("teamCode", None)
    })

# ─── Dependencia para obtener usuario actual ───────────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Id no encontrado",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception

    user["_id"] = str(user["_id"])
    return user

# ---------------------- verify_token ------------------------------------

@router.get("/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    # Retornar datos públicos del usuario
    current_user.pop("password", None)
    return {
        "id": current_user.get("_id"),
        "username": current_user.get("username"),
        "email": current_user.get("email"),
        "teamCode": current_user.get("teamCode", None)
    }

