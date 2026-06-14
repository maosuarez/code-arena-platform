from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from typing import Optional
from pydantic import BaseModel

# Modelo de submission
class Submission(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    problem: str
    status: Literal["AC" , "WA" , "TLE"]
    time: int
    member: str
    points: int

class TeamCode(BaseModel):
    id: Optional[str] = None
    code: str
    teamName: str
    avatar: str
    color: str
    maxMembers: int
    currentMembers: int
    points: Optional[int] = 0
    submissions: Optional[List[Submission]] = []

class TeamCreateRequest(BaseModel):
    teamName: str
    maxMembers: int
    avatar: str
    color:str

class JoinTeamRequest(BaseModel):
    teamCode: str