import logging
import motor.motor_asyncio
from pymongo.errors import OperationFailure
from dotenv import load_dotenv
import os

# Cargar variables del .env
load_dotenv()

logger = logging.getLogger(__name__)

MONGO_URI = os.getenv("MONGO_URL")
MONGO_DB = os.getenv("MONGO_DB")

required_vars = ["MONGO_URL", "MONGO_DB"]
missing = [var for var in required_vars if not os.getenv(var)]
if missing:
    raise RuntimeError(f"Faltan variables de entorno: {', '.join(missing)}")


# Atlas M0 (tier gratuito) tope 500 conexiones y el backend corre serverless:
# cada instancia caliente mantiene su propio pool, así que el pool se deja
# pequeño (5 × ~80 instancias = 400) y las conexiones ociosas se reciclan
# rápido para que las instancias congeladas no acaparen slots del cluster.
client = motor.motor_asyncio.AsyncIOMotorClient(
    MONGO_URI,
    appname="code-arena",
    maxPoolSize=int(os.getenv("MONGO_MAX_POOL_SIZE", "5")),
    minPoolSize=0,
    maxIdleTimeMS=int(os.getenv("MONGO_MAX_IDLE_MS", "30000")),
    serverSelectionTimeoutMS=int(os.getenv("MONGO_TIMEOUT_MS", "10000")),
    retryWrites=True,
)
db = client[MONGO_DB]

# (colección, keys, unique). Sin estos índices, cada lectura por clave de negocio
# es un COLLSCAN — en un cluster compartido M0 eso es lo primero que se cae bajo
# la carga de una competencia en vivo.
_INDEXES: list[tuple[str, list[tuple[str, int]], bool]] = [
    ("teams", [("code", 1)], True),
    ("users", [("email", 1)], True),
    ("users", [("username", 1)], True),
    # Listar los miembros de un equipo (users.find({"teamCode": ...})).
    ("users", [("teamCode", 1)], False),
    # Clave de negocio de la competencia: la lectura más frecuente del sistema.
    ("competition", [("id", 1)], True),
    ("testcases", [("problemId", 1)], True),
    ("maze_configs", [("competitionId", 1)], True),
    # Único además de por velocidad: el avance del laberinto se hace con upsert
    # sobre este par, y sin unicidad dos peticiones simultáneas del mismo equipo
    # pueden insertar dos documentos de progreso.
    ("maze_progress", [("competitionId", 1), ("teamCode", 1)], True),
]


async def ensure_indexes():
    for collection, keys, unique in _INDEXES:
        try:
            await db[collection].create_index(keys, unique=unique)
        except OperationFailure as exc:
            # Datos duplicados preexistentes o un índice con el mismo nombre y
            # otras opciones. No se aborta el arranque: se registra para limpiar.
            logger.error(
                "No se pudo crear el índice %s sobre %s: %s",
                [k for k, _ in keys],
                collection,
                exc,
            )
