from pydantic import BaseModel
from typing import List

class MazeNode(BaseModel):
    id: str
    label: str
    x: float
    y: float

class MazeDoor(BaseModel):
    id: str
    from_node: str
    to_node: str
    cost: int
    label: str = ""

class MazeConfig(BaseModel):
    competitionId: str = ""
    nodes: List[MazeNode]
    doors: List[MazeDoor]
    startNodeId: str
    goalNodeId: str
