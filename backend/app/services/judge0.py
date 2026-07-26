import base64
import os
import httpx
from typing import List
from urllib.parse import urlparse

JUDGE0_API_URL = os.getenv("JUDGE0_API_URL", "https://judge0.maosuarez.com")
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY", "")

# Validate JUDGE0_API_URL at module load time to catch misconfigurations early.
_DEFAULT_ALLOWED_HOSTS = {"judge0.maosuarez.com"}
_allowed_hosts_env = os.getenv("JUDGE0_ALLOWED_HOSTS", "")
_ALLOWED_HOSTS = (
    {h.strip() for h in _allowed_hosts_env.split(",") if h.strip()}
    if _allowed_hosts_env
    else _DEFAULT_ALLOWED_HOSTS
)

def _validate_judge0_url(url: str) -> None:
    if not url.startswith("https://"):
        raise RuntimeError(
            f"JUDGE0_API_URL must start with 'https://'. Got: {url!r}"
        )
    parsed = urlparse(url)
    if parsed.hostname not in _ALLOWED_HOSTS:
        raise RuntimeError(
            f"JUDGE0_API_URL host '{parsed.hostname}' is not in the allowlist {_ALLOWED_HOSTS}. "
            "Add it via the JUDGE0_ALLOWED_HOSTS env var (comma-separated)."
        )

_validate_judge0_url(JUDGE0_API_URL)

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

    def _b64(text: str) -> str:
        return base64.b64encode(text.encode("utf-8")).decode("ascii")

    def _unb64(text: str | None) -> str:
        if not text:
            return ""
        return base64.b64decode(text).decode("utf-8", errors="replace")

    source_b64 = _b64(source_code)

    async with httpx.AsyncClient() as client:
        for i, case in enumerate(test_cases):
            # base64_encoded=true: compiler diagnostics (e.g. GCC's Unicode
            # smart quotes around identifiers) break Judge0's plain-text mode,
            # which silently drops the real error and returns an opaque
            # "cannot be converted to UTF-8" response instead.
            payload = {
                "source_code": source_b64,
                "language_id": language_id,
                "stdin": _b64(case.get("input", "")),
                "expected_output": _b64(case.get("expected", "")),
                "cpu_time_limit": time_limit,
                "memory_limit": memory_limit * 1024,  # Judge0 expects KB
            }
            try:
                resp = await client.post(
                    f"{JUDGE0_API_URL}/submissions",
                    params={"base64_encoded": "true", "wait": "true"},
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
                    # 6 = Compilation Error — one failure for the whole submission,
                    # not tied to a specific test case, so don't label it "Caso N".
                    if status_id == 6:
                        compile_output = _unb64(result.get("compile_output"))
                        return False, f"Error de compilación:\n{compile_output[:2000]}"
                    stderr = _unb64(result.get("stderr")) or _unb64(result.get("compile_output"))
                    return False, f"Caso {i + 1}: {desc}. {stderr[:300]}"
            except httpx.HTTPError as e:
                return False, f"Error al conectar con el juez: {str(e)}"

    return True, ""
