import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.models_entity.competition import ProblemCreate, ProblemUpdate
from app.database import db
from app.routes.auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


class BulkProblemsCreate(BaseModel):
    problems: List[ProblemCreate]


async def _upsert_problem(p: ProblemCreate) -> str:
    prob_id = p.id or str(uuid.uuid4())
    doc = p.model_dump(mode="json")
    doc["id"] = prob_id
    test_cases = doc.pop("testCases", [])
    await db["problems"].update_one({"id": prob_id}, {"$set": doc}, upsert=True)
    if test_cases:
        await db["testcases"].replace_one(
            {"problemId": prob_id},
            {"problemId": prob_id, "cases": test_cases},
            upsert=True,
        )
    return prob_id


@router.post("/create")
async def create_problem(req: ProblemCreate, _user: dict = Depends(require_admin)):
    if req.id:
        existing = await db["problems"].find_one({"id": req.id})
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe un problema con ese id")
    prob_id = await _upsert_problem(req)
    return {"message": "Problema creado en el banco", "id": prob_id}


@router.post("/bulk")
async def bulk_create_problems(req: BulkProblemsCreate, _user: dict = Depends(require_admin)):
    ids = [await _upsert_problem(p) for p in req.problems]
    return {"message": f"{len(ids)} problemas creados/actualizados en el banco", "ids": ids}


@router.get("/all")
async def list_problems(
    difficulty: Optional[str] = Query(None),
    _user: dict = Depends(require_admin),
):
    query = {"difficulty": difficulty} if difficulty else {}
    raw = await db["problems"].find(query, {"_id": 0}).to_list(length=1000)
    return {"list": raw}


@router.get("/{problemId}")
async def get_problem(problemId: str, _user: dict = Depends(require_admin)):
    doc = await db["problems"].find_one({"id": problemId}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Problema no encontrado en el banco")
    tc_doc = await db["testcases"].find_one({"problemId": problemId}, {"_id": 0})
    doc["testCases"] = tc_doc.get("cases", []) if tc_doc else []
    return doc


@router.patch("/{problemId}")
async def update_problem(problemId: str, update: ProblemUpdate, _user: dict = Depends(require_admin)):
    existing = await db["problems"].find_one({"id": problemId})
    if not existing:
        raise HTTPException(status_code=404, detail="Problema no encontrado en el banco")

    update_data = update.model_dump(mode="json", exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")

    if "testCases" in update_data:
        cases = update_data.pop("testCases")
        await db["testcases"].replace_one(
            {"problemId": problemId},
            {"problemId": problemId, "cases": cases},
            upsert=True,
        )

    if update_data:
        await db["problems"].update_one({"id": problemId}, {"$set": update_data})

    return {"message": "Problema actualizado", "id": problemId}


@router.delete("/{problemId}")
async def delete_problem(problemId: str, _user: dict = Depends(require_admin)):
    result = await db["problems"].delete_one({"id": problemId})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Problema no encontrado en el banco")
    await db["testcases"].delete_one({"problemId": problemId})
    return {"message": "Problema eliminado del banco", "id": problemId}
