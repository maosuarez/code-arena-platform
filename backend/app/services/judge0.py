import os
import httpx
from typing import List

JUDGE0_API_URL = os.getenv("JUDGE0_API_URL", "https://judge0.maosuarez.com")
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY", "")

LANGUAGE_NAMES = {
    71: "Python 3",
    62: "Java",
    54: "C++",
    63: "JavaScript",
}

async def judge_submission(
    source_code: str,
    language_id: int,
    test_cases: List[dict],
    time_limit: float = 2.0,
    memory_limit: int = 256,
) -> tuple[bool, str]:
    """
    Run source_code against all test_cases via Judge0.
    Returns (passed: bool, error_message: str).
    """
    if not JUDGE0_API_KEY:
        return False, "JUDGE0_API_KEY no configurado en el servidor"

    if not test_cases:
        return False, "No hay casos de prueba para este problema"

    headers = {"Content-Type": "application/json"}
    if JUDGE0_API_KEY:
        headers["X-Auth-Token"] = JUDGE0_API_KEY

    async with httpx.AsyncClient() as client:
        for i, case in enumerate(test_cases):
            payload = {
                "source_code": source_code,
                "language_id": language_id,
                "stdin": case.get("input", ""),
                "expected_output": case.get("expected", ""),
                "cpu_time_limit": time_limit,
                "memory_limit": memory_limit * 1024,  # Judge0 expects KB
            }
            try:
                resp = await client.post(
                    f"{JUDGE0_API_URL}/submissions",
                    params={"base64_encoded": "false", "wait": "true"},
                    json=payload,
                    headers=headers,
                    timeout=30.0,
                )
                resp.raise_for_status()
                result = resp.json()
                status_id = result.get("status", {}).get("id")
                # 3 = Accepted
                if status_id != 3:
                    desc = result.get("status", {}).get("description", "Error desconocido")
                    stderr = result.get("stderr") or result.get("compile_output") or ""
                    return False, f"Caso {i + 1}: {desc}. {stderr[:300]}"
            except httpx.HTTPError as e:
                return False, f"Error al conectar con el juez: {str(e)}"

    return True, ""
