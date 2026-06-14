from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Literal
from typing import Optional
from datetime import datetime

class Scoring(BaseModel):
    easy: int
    medium: int
    hard: int

class Problem(BaseModel):
    id: str
    title: str
    difficulty: Literal["easy", "medium", "hard"]
    url: HttpUrl
    slug: str
    isValid: bool
    isValidating: bool

class Competition(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    maxTeamSize: int
    date: datetime
    status: Literal["active", "inactive", "completed", "upcoming"]
    duration: int  # Ej: "2 horas", o puedes normalizarlo a minutos si prefieres
    teams: Optional[List[str]] = []
    problems: List[Problem]
    rules: List[str]
    scoring: Scoring

class RequestCompetition(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    maxTeamSize: int
    date: datetime
    status: Literal["active", "inactive", "completed", "upcoming"]
    duration: int  # Ej: "2 horas", o puedes normalizarlo a minutos si prefieres
    problems: List[Problem]
    rules: List[str]
    scoring: Scoring