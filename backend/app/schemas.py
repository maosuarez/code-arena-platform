from pydantic import BaseModel
from typing import Optional
from datetime import datetime


from pydantic import BaseModel
from typing import List, Dict, Literal




class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    leetcode_username: Optional[str]

    class Config:
        orm_mode = True

class ContestCreate(BaseModel):
    name: str
    date: datetime

class ContestOut(ContestCreate):
    id: int
    class Config:
        orm_mode = True

class Competition(BaseModel):
    title: str
    description: str
    status: Literal["active", "inactive", "completed"]  # Puedes ajustar los estados válidos
    duration: str  # Ej: "2 horas", podrías normalizarlo a minutos si lo prefieres
    teams: int
    problems: int
    rules: List[str]
    scoring: Dict[str, int]  # Ej: {"easy": 10, "medium": 30, "hard": 50}
