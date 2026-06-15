from datetime import datetime, timezone
from fastapi import HTTPException, status
from passlib.context import CryptContext
import random
import string
from bson import ObjectId

def sanitize_user_dict(db_user: dict) -> dict:
    user_copy = db_user.copy()
    if "_id" in user_copy and isinstance(user_copy["_id"], ObjectId):
        user_copy["_id"] = str(user_copy["_id"])
    return user_copy

def generate_unique_code(existing_codes: set, length: int = 6) -> str:
    while True:
        code = ''.join(random.choices(string.ascii_uppercase, k=length))
        if code not in existing_codes:
            return code

def validate_competition_date(date_str) -> datetime:
    try:
        if isinstance(date_str, datetime):
            parsed = date_str
        else:
            parsed = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fecha de competencia inválida. Debe estar en formato ISO 8601."
        )
    # Normalizar a UTC-aware para evitar restas naive/aware en el cálculo de tiempos
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
