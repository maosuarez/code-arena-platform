# Code Arena Unisabana

Plataforma de competencias de programación para equipos universitarios de la Universidad de la Sabana. Los estudiantes resuelven problemas de LeetCode, registran sus soluciones y compiten en un ranking en tiempo real con evaluación automática via Judge0 y actualizaciones via WebSocket (MQTT).

## ¿Qué es Code Arena?

Sistema integral para gestionar competencias de programación. Los equipos se inscriben en competencias, resuelven problemas codificados, y el sistema calcula puntos automáticamente según dificultad. Incluye mecánica de laberinto (maze) con evaluación automática, ranking en tiempo real, y panel de administración.

## Stack Tecnológico

**Backend**: FastAPI + Python, MongoDB (Motor async), JWT HS256, Judge0 sandbox, MQTT  
**Frontend**: Next.js 15 + TypeScript, shadcn/ui, Tailwind CSS v4, MQTT WebSocket  
**Infraestructura**: Docker Compose (local), Azure App Service (backend), Azure Static Web Apps (frontend)

## Estructura

```
code-arena-unisabana/
├── backend/app/
│   ├── main.py                    # FastAPI app, CORS, routers, rate limiting
│   ├── database.py                # Motor MongoDB async
│   ├── limiter.py                 # Rate limiting (slowapi)
│   ├── routes/                    # auth, users, teams, competition, ranking, maze
│   ├── models_entity/             # Pydantic v2 models
│   └── services/                  # judge0.py (código sandbox), users.py, scoring.py
├── frontend/src/
│   ├── app/                       # Next.js pages: /, /competition/[id], /ranking/[id], /admin/*
│   ├── components/                # Auth, Competition, Team, Navbar, shadcn/ui
│   ├── hooks/                     # useAuth, useToken, useCompetitionSocket
│   └── lib/                       # apiRequest (fetch wrapper), types.ts
├── docs/context.md                # Reglas de negocio
├── docker-compose.yml             # Mongo + Backend + Frontend
└── .env.example                   # Variables de entorno
```

## Características principales

- **Autenticación JWT** (120 min, HS256) con bcrypt password hashing
- **Gestión de equipos** con código único y límite de miembros configurable
- **Competencias** con problemas LeetCode, scoring flexible por dificultad
- **Judge0 integrado** para evaluación automática (Python, Java, C++, JavaScript)
- **Maze/Laberinto** con evaluación automática de código
- **Ranking real-time** via MQTT WebSocket sin recargar página
- **Admin dashboard** para crear competencias y validar participantes
- **Rate limiting** contra abuso de solicitudes
- **Seguridad** con HSTS, CSP, CORS, user no-root en Docker

## Reglas de dominio clave

- **Submissions**: Status siempre es `AC` (accepted). Sin validación automática de LeetCode.
- **Scoring**: Puntos según `competition.scoring[difficulty]`. Suma acumulada en `team.points`.
- **Ranking**: Ordena por `points DESC`, luego `totalTime ASC`.
- **Equipos**: Pueden estar en múltiples competencias. Vinculados via `teamCode` en perfil usuario.
- **Competencia privada**: GET `/competition/private/{id}` retorna datos competencia + equipo en una llamada.

## Inicio rápido

### Con Docker Compose (recomendado)

```bash
cp .env.example .env
docker compose up --build
```

Backend: `http://localhost:8000`, Frontend: `http://localhost:3000`

### Desarrollo manual

**Backend**: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`

**Frontend**: `cd frontend && npm install && npm run dev`

## Variables de entorno

Ver `.env.example` para referencia completa. Críticas:
- `MONGO_URL`, `MONGO_DB` — MongoDB
- `SECRET_KEY` — JWT signing
- `JUDGE0_API_URL`, `JUDGE0_API_KEY` — Judge0 sandbox
- `MQTT_HOST`, `MQTT_USERNAME`, `MQTT_PASSWORD` — WebSocket ranking
- `NEXT_PUBLIC_BASE_URL` — Ruta al backend (default: `/backend` modo proxy)

## Despliegue

**→ [Ver DEPLOY.md](./DEPLOY.md) para instrucciones completas de despliegue local, Docker y Azure.**

Incluye requisitos previos, configuración de servicios externos, variables de entorno, y verificación post-despliegue.

## Esquema de datos

```
User: {username, email, password, teamCode, leetcode_username, is_admin}
TeamCode: {code, points, members[], submissions[{problemId, time, difficulty, points}]}
Competition: {name, date, duration, problems[], scoring{easy/medium/hard}, teams[], createdBy}
```

## Licencia

Proyecto de la Universidad de la Sabana. Contacta al equipo de desarrollo para preguntas o contribuciones.

**Última actualización**: Junio 2026
