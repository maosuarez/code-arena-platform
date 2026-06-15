import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from app.routes import auth, competition, users, teams, ranking, maze
from fastapi.middleware.cors import CORSMiddleware
from app.database import db, ensure_indexes
from app.routes.auth import get_password_hash
from app.limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

logger = logging.getLogger(__name__)

# ─── Security headers injected on every response ──────────────────────────────

_SECURITY_HEADERS = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    # This is a JSON API — no HTML is served, so a tight CSP is safe.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


async def seed_admin():
    admin_password = os.getenv("ADMIN_INITIAL_PASSWORD")
    if not admin_password:
        logger.warning(
            "ADMIN_INITIAL_PASSWORD is not set — skipping admin seed. "
            "Set this env var on first deploy to create the admin account."
        )
        return
    existing = await db["users"].find_one({"email": "admin@codearena.local"})
    if not existing:
        await db["users"].insert_one({
            "username": "admin",
            "email": "admin@codearena.local",
            "password": get_password_hash(admin_password),
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

# ─── Rate limiter ──────────────────────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ─── CORS ─────────────────────────────────────────────────────────────────────

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

# ─── Security headers middleware ───────────────────────────────────────────────

@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response: Response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers[header] = value
    return response

# ─── Routers ──────────────────────────────────────────────────────────────────

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
