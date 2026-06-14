import motor.motor_asyncio
from dotenv import load_dotenv
import os

# Cargar variables del .env
load_dotenv()

MONGO_URI = os.getenv("MONGO_URL")
MONGO_DB = os.getenv("MONGO_DB")

required_vars = ["MONGO_URL", "MONGO_DB"]
missing = [var for var in required_vars if not os.getenv(var)]
if missing:
    raise RuntimeError(f"Faltan variables de entorno: {', '.join(missing)}")


client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]

async def ensure_indexes():
    await db["teams"].create_index("code", unique=True)
    await db["users"].create_index("email", unique=True)
    await db["users"].create_index("username", unique=True)
