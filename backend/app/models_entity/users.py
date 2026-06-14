from pydantic import BaseModel, EmailStr, Field
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
