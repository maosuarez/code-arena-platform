import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.routes import auth, competition, users, teams, ranking, maze
from fastapi.middleware.cors import CORSMiddleware
from app.database import db, ensure_indexes
from app.routes.auth import get_password_hash

async def seed_admin():
    existing = await db["users"].find_one({"username": "admin"})
    if not existing:
        await db["users"].insert_one({
            "username": "admin",
            "email": "admin@codearena.local",
            "password": get_password_hash("password"),
            "is_admin": True,
            "teamCode": None,
            "leetcode_username": None,
        })

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    await seed_admin()
    yield

app = FastAPI(title="Competencias Universitarias - Backend", lifespan=lifespan)

_cors_env = os.getenv("CORS_ORIGINS", "")
origins = [o.strip() for o in _cors_env.split(",") if o.strip()] or [
    "https://code-arena-cegpgwdrfnfybufp.eastus2-01.azurewebsites.net",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Incluir rutas
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(teams.router, prefix="/teams", tags=["Teams"])
app.include_router(ranking.router, prefix="/ranking", tags=["Ranking"])
app.include_router(competition.router, prefix="/competition", tags=["Competition"])
app.include_router(maze.router, prefix="/maze", tags=["Maze"])

@app.get("/")
def root():
    return {"message": "Bienvenido a la API de Competencias Universitarias"}

@app.get("/health")
async def health():
    return {"status": "ok"}
