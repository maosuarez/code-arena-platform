from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

class Scoring(BaseModel):
    easy: int
    medium: int
    hard: int

class TestCase(BaseModel):
    input: str
    expected: str

class Problem(BaseModel):
    id: str
    title: str
    difficulty: Literal["easy", "medium", "hard"]
    statement: str
    language_ids: List[int] = [71, 62, 54, 63]
    time_limit: float = 2.0
    memory_limit: int = 256
    hidden_instructions: Optional[str] = None

class ProblemCreate(BaseModel):
    id: Optional[str] = None
    title: str
    difficulty: Literal["easy", "medium", "hard"]
    statement: str
    language_ids: List[int] = [71, 62, 54, 63]
    time_limit: float = 2.0
    memory_limit: int = 256
    hidden_instructions: Optional[str] = None
    testCases: List[TestCase] = []

class Competition(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    maxTeamSize: int
    date: datetime
    status: Literal["active", "inactive", "completed", "upcoming"]
    duration: int
    teams: Optional[List[str]] = []
    problems: List[Problem]
    rules: List[str]
    scoring: Scoring
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class RequestCompetition(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    maxTeamSize: int
    date: datetime
    status: Literal["active", "inactive", "completed", "upcoming"]
    duration: int
    problems: List[ProblemCreate]
    rules: List[str]
    scoring: Scoring
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class CompetitionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    maxTeamSize: Optional[int] = None
    date: Optional[datetime] = None
    status: Optional[Literal["active", "inactive", "completed", "upcoming"]] = None
    duration: Optional[int] = None
    rules: Optional[List[str]] = None
    scoring: Optional[Scoring] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    problems: Optional[List[ProblemCreate]] = None