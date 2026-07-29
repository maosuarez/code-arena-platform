# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with two independent apps, both deployed on Vercel (single `vercel.json` at repo root defines both as services; push to `main` auto-deploys):
- `backend/` — FastAPI + Python, deployed as a Vercel Python function
- `frontend/` — Next.js 15 + TypeScript, deployed as a Vercel Next.js app

Database is MongoDB Atlas (M0 free tier). The FastAPI `lifespan` skips `ensure_indexes()`/`seed_admin()` itself on Vercel since ASGI lifespan events aren't guaranteed to run there (see `backend/app/main.py`), so after any change to `backend/app/database.py`'s `_INDEXES` (or to `seed_admin`), sync it to production manually:

```bash
gh workflow run backend-db-bootstrap.yml
```

This is deliberately `workflow_dispatch`-only, not wired to push — it's idempotent but runs against the real production Atlas cluster, so it needs a human to trigger it, not every commit.

## Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload        # dev server at :8000
```
Requires `.env` with `MONGO_URL` and `MONGO_DB` (local Docker container for dev; MongoDB Atlas M0 in production).

### Frontend
```bash
cd frontend
npm install
npm run dev      # dev server at :3000 (turbopack)
npm run build
npm run lint
```
Requires `NEXT_PUBLIC_BASE_URL` env var pointing to the backend URL.

## Architecture

**Backend** (`backend/app/`):
- `main.py` — FastAPI app, CORS config, router registration
- `database.py` — Motor async MongoDB client via `MONGO_URL`/`MONGO_DB`
- `routes/` — One file per domain: `auth`, `users`, `teams`, `competition`, `ranking`
- `models_entity/` — Pydantic v2 models: `users`, `teams`, `competition`, `general`
- `services/` — `judge0.py` (code evaluation sandbox), `users.py` (helpers), `scoring.py`
- Auth: JWT (HS256, 120 min) via `python-jose`. `get_current_user` dependency in `auth.py` is reused across protected routes.

**Frontend** (`frontend/src/`):
- `lib/api.ts` — Single `apiRequest<T>()` wrapper around `fetch`. Pass `token: true` to inject Bearer from localStorage.
- `lib/types.ts` — Canonical TypeScript interfaces (`User`, `Competition`, `TeamCode`, `Submission`, `Problem`)
- `hooks/` — `useAuth`, `useToken`, `useTeamCode` for auth state
- `app/` — Next.js App Router pages: `/` (home), `/competition/[id]`, `/ranking/[id]`, `/admin/dashboard`, `/admin/create`
- `components/` — Feature components (`auth/`, `competition/`, `team/`) + shadcn/ui in `ui/`

## Key Domain Rules

See `docs/context.md` for full domain logic.

- Submissions are always `AC` (accepted). Points = `competition.scoring[difficulty]`.
- A team's `points` field is the running total; `submissions[]` is append-only.
- Ranking sorts by `points DESC`, then `totalTime ASC`.
- `/competition/private/{id}` is the main competition view — requires auth and returns competition + caller's team data in one call.
