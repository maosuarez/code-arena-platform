from fastapi import FastAPI
from app.routes import auth, competition, users, teams, ranking
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Competencias Universitarias - Backend")

# Lista explícita de orígenes permitidos (ajusta según tu frontend)
origins = [
    "https://code-arena-cegpgwdrfnfybufp.eastus2-01.azurewebsites.net",  # Producción
    "http://localhost:3000",    # Desarrollo local
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,              # Orígenes permitidos
    allow_credentials=True,             # Permitir cookies/autenticación
    allow_methods=["*"],                # Métodos HTTP permitidos
    allow_headers=["*"],                # Headers permitidos
)


# Incluir rutas
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(teams.router, prefix="/teams", tags=["Teams"])
app.include_router(ranking.router, prefix="/ranking", tags=["Ranking"])
app.include_router(competition.router, prefix="/competition", tags=["Competition"])

@app.get("/")
def root():
    return {"message": "Bienvenido a la API de Competencias Universitarias"}
