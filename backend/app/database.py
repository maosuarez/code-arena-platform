import motor.motor_asyncio
from dotenv import load_dotenv
import os

# Cargar variables del .env
load_dotenv()

MONGO_URI = os.getenv("COSMOS_URL")
MONGO_DB = os.getenv("COSMOS_DB")

required_vars = ["COSMOS_URL", "COSMOS_DB"]
missing = [var for var in required_vars if not os.getenv(var)]
if missing:
    raise RuntimeError(f"Faltan variables de entorno: {', '.join(missing)}")


client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]
