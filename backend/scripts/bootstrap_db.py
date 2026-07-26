"""Prepara una base de datos vacía: crea índices y la cuenta de admin.

El backend hace esto solo en el `lifespan` de arranque, pero en despliegues
serverless (Vercel) los eventos de lifespan de ASGI no siempre se ejecutan.
Este script hace lo mismo desde fuera, contra el `MONGO_URL` que tengas
configurado, y es idempotente: se puede correr las veces que haga falta.

Uso (desde backend/, con el venv activo y el .env apuntando a Atlas):

    python scripts/bootstrap_db.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import client, db, ensure_indexes  # noqa: E402
from app.main import seed_admin  # noqa: E402


async def main() -> None:
    print(f"Conectando a {os.getenv('MONGO_DB')} …")
    await client.admin.command("ping")
    print("  ping OK")

    await ensure_indexes()
    for collection in sorted(await db.list_collection_names()):
        names = [ix["name"] async for ix in db[collection].list_indexes()]
        print(f"  {collection}: {', '.join(names)}")

    if not os.getenv("ADMIN_INITIAL_PASSWORD"):
        print(
            "\nADMIN_INITIAL_PASSWORD no está definida: no se crea el admin.\n"
            "Con una base vacía eso significa que no habrá forma de entrar.",
            file=sys.stderr,
        )
        sys.exit(1)

    await seed_admin()
    admin = await db["users"].find_one({"email": "admin@codearena.local"})
    print(f"\nAdmin listo: username={admin['username']} email={admin['email']}")


if __name__ == "__main__":
    asyncio.run(main())
