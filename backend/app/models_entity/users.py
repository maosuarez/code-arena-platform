from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional


class User(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    username: str
    email: EmailStr
    teamCode: Optional[str] = None
    leetcode_username: Optional[str] = None
    password: str
    is_admin: bool = False


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v
