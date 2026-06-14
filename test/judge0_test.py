#!/usr/bin/env python3
"""
Test de conectividad y ejecución contra Judge0 self-hosted.
Prueba: health, lenguajes disponibles y un submit por cada lenguaje soportado.

Uso:
    pip install httpx
    python judge0_test.py

Variables de entorno:
    JUDGE0_URL   — https://judge0.maosuarez.com  (default)
    JUDGE0_KEY   — X-Auth-Token (dejar vacío si no configuraste AUTHN_TOKEN)
"""

import httpx
import json
import os
import sys

URL = os.getenv("JUDGE0_URL", "https://judge0.maosuarez.com").rstrip("/")
KEY = os.getenv("JUDGE0_KEY", "")

HEADERS = {"Content-Type": "application/json"}
if KEY:
    HEADERS["X-Auth-Token"] = KEY

# language_id → (nombre, código de prueba, stdin, expected_output)
CASES = {
    71: (
        "Python 3",
        "import sys\nline = sys.stdin.readline().strip()\nprint(f'Hola, {line}!')",
        "Mundo",
        "Hola, Mundo!\n",
    ),
    62: (
        "Java",
        'import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    String s = sc.nextLine();\n    System.out.println("Hola, " + s + "!");\n  }\n}',
        "Mundo",
        "Hola, Mundo!\n",
    ),
    54: (
        "C++",
        '#include<iostream>\n#include<string>\nusing namespace std;\nint main(){\n  string s;\n  getline(cin,s);\n  cout<<"Hola, "<<s<<"!"<<endl;\n  return 0;\n}',
        "Mundo",
        "Hola, Mundo!\n",
    ),
    63: (
        "JavaScript (Node)",
        "const lines = [];\nprocess.stdin.on('data', d => lines.push(d.toString().trim()));\nprocess.stdin.on('end', () => console.log(`Hola, ${lines[0]}!`));",
        "Mundo",
        "Hola, Mundo!\n",
    ),
}

STATUS = {
    1: "En cola",
    2: "Procesando",
    3: "Accepted",
    4: "Wrong Answer",
    5: "Time Limit Exceeded",
    6: "Compilation Error",
    7: "Runtime Error (SIGSEGV)",
    8: "Runtime Error (SIGFPE)",
    9: "Runtime Error (SIGABRT)",
    10: "Runtime Error (NZEC)",
    11: "Runtime Error (Other)",
    12: "Runtime Error (Internal)",
    13: "Exec Format Error",
    14: "Limite de memoria excedido",
}

ok_count = 0
fail_count = 0


def section(title):
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print(f"{'─'*50}")


def check_health(client):
    section("1. Health check")
    try:
        r = client.get(f"{URL}/")
        print(f"[+] Status HTTP: {r.status_code}")
        if r.status_code == 200:
            try:
                data = r.json()
                print(f"[+] Respuesta JSON: {json.dumps(data, indent=2)}")
            except Exception:
                print(f"[+] Respuesta (no-JSON): {r.text[:120] or '(vacío — normal en Judge0)'}")
            # Confirmar con /system_info que el API responde JSON
            r2 = client.get(f"{URL}/system_info", headers=HEADERS)
            if r2.status_code == 200:
                info = r2.json()
                print(f"[+] Judge0 versión : {info.get('judge0_version', '?')}")
                print(f"[+] Workers activos: {info.get('workers_count', '?')}")
            return True
        else:
            print(f"[-] Respuesta inesperada: {r.text[:200]}")
            return False
    except Exception as e:
        print(f"[-] No se pudo conectar: {e}")
        return False


def check_languages(client):
    section("2. Lenguajes disponibles")
    try:
        r = client.get(f"{URL}/languages", headers=HEADERS)
        langs = r.json()
        available = {l["id"]: l["name"] for l in langs}
        print(f"[+] Total lenguajes: {len(available)}")
        for lid in CASES:
            name = available.get(lid, "NO ENCONTRADO")
            icon = "✓" if lid in available else "✗"
            print(f"  {icon} ID {lid}: {name}")
        return available
    except Exception as e:
        print(f"[-] Error al obtener lenguajes: {e}")
        return {}


def submit(client, language_id, source_code, stdin, expected):
    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
        "expected_output": expected,
        "cpu_time_limit": 5,
        "memory_limit": 131072,
    }
    r = client.post(
        f"{URL}/submissions",
        params={"base64_encoded": "false", "wait": "true"},
        json=payload,
        headers=HEADERS,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def check_submissions(client, available):
    global ok_count, fail_count
    section("3. Ejecución de código por lenguaje")

    for lid, (name, code, stdin, expected) in CASES.items():
        if lid not in available:
            print(f"[!] {name} (ID {lid}): lenguaje no instalado en este Judge0, omitiendo")
            continue

        print(f"\n[*] Probando {name} (ID {lid})...")
        try:
            result = submit(client, lid, code, stdin, expected)
            status_id   = result.get("status", {}).get("id")
            status_desc = result.get("status", {}).get("description", "?")
            time_ms     = result.get("time")
            memory_kb   = result.get("memory")
            stdout      = (result.get("stdout") or "").strip()
            stderr      = (result.get("stderr") or "").strip()
            compile_out = (result.get("compile_output") or "").strip()

            if status_id == 3:
                print(f"    [OK] Accepted — tiempo: {time_ms}s  memoria: {memory_kb} KB")
                ok_count += 1
            else:
                print(f"    [FAIL] {status_desc} (id={status_id})")
                if stderr:      print(f"    stderr: {stderr[:200]}")
                if compile_out: print(f"    compile: {compile_out[:200]}")
                if stdout:      print(f"    stdout: {stdout[:200]}")
                fail_count += 1

        except httpx.HTTPStatusError as e:
            print(f"    [FAIL] HTTP {e.response.status_code}: {e.response.text[:200]}")
            fail_count += 1
        except Exception as e:
            print(f"    [FAIL] {e}")
            fail_count += 1


def main():
    print(f"Judge0 URL : {URL}")
    print(f"Auth token : {'configurado' if KEY else 'no configurado (sin auth)'}")

    with httpx.Client() as client:
        if not check_health(client):
            print("\n[FATAL] Judge0 no responde. Verifica que esté corriendo.")
            sys.exit(1)

        available = check_languages(client)
        check_submissions(client, available)

    section("Resumen")
    total = ok_count + fail_count
    print(f"  Passed : {ok_count}/{total}")
    print(f"  Failed : {fail_count}/{total}")
    if fail_count == 0 and ok_count > 0:
        print("\n[OK] Judge0 funcionando correctamente.")
    elif ok_count > 0:
        print("\n[!] Parcialmente funcional.")
    else:
        print("\n[FAIL] Ningún lenguaje pasó.")
    print()


if __name__ == "__main__":
    main()
