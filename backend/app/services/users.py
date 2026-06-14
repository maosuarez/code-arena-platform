from datetime import datetime
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

def validate_competition_date(date_str: str) -> datetime:
    try:
        normalized = date_str.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fecha de competencia inválida. Debe estar en formato ISO 8601."
        )
