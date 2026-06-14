# Code Arena Unisabana

Plataforma de competencias de programación en vivo para la **Semana de la Ingeniería de la Universidad de La Sabana**. Los equipos de estudiantes compiten resolviendo problemas de LeetCode, registrando sus soluciones manualmente y compitiendo en un ranking en tiempo real.

## Descripción General

Code Arena Unisabana es una aplicación web full-stack diseñada para facilitar competencias de programación universitarias. Combina un backend robusto con autenticación segura y una interfaz moderna que permite a los estudiantes colaborar en equipos, resolver problemas y ver su posición en el ranking mientras se actualiza en tiempo real.

## Stack Tecnológico

**Backend**: FastAPI, Pydantic v2, Motor (MongoDB asincrónico), JWT con HS256, bcrypt  
**Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui  
**Base de Datos**: MongoDB 7 (autoalojado o externo)  
**Infraestructura**: Docker Compose (local)

## Estructura del Proyecto

```
code-arena-unisabana/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── main.py       # Punto de entrada y configuración
│   │   ├── database.py   # Cliente Motor para MongoDB
│   │   ├── routes/       # Endpoints: auth, usuarios, equipos, competencias
│   │   ├── models_entity/# Esquemas Pydantic
│   │   └── services/     # Lógica de negocio
│   ├── requirements.txt
│   └── dockerfile
│
├── frontend/             # Aplicación Next.js
│   ├── src/
│   │   ├── app/          # App Router (rutas y layouts)
│   │   ├── components/   # Componentes React reutilizables
│   │   ├── hooks/        # Hooks personalizados
│   │   └── lib/          # Utilidades, tipos, cliente API
│   ├── package.json
│   └── dockerfile
│
└── docs/                 # Documentación del dominio

```

## Inicio Rápido

### Requisitos
- Docker y Docker Compose

### Con Docker Compose (recomendado)

```bash
cp .env.example .env  # ajusta las variables si necesitas mongo externo
docker compose up --build
```

El backend estará en `http://localhost:8000` y el frontend en `http://localhost:3000`.

### Desarrollo local (sin Docker)

#### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configura variables de entorno
uvicorn app.main:app --reload
```

La API estará disponible en `http://localhost:8000` y la documentación interactiva en `/docs`.

#### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # Configura NEXT_PUBLIC_BASE_URL
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

## Variables de Entorno

Copia `.env.example` a `.env` en la raíz del proyecto y ajusta los valores:

### Raíz (`.env`) — usado por Docker Compose
- `MONGO_URL`: Cadena de conexión a MongoDB (ej: `mongodb://mongo:27017` para el contenedor local)
- `MONGO_DB`: Nombre de la base de datos
- `SECRET_KEY`: Clave para firmar JWTs
- `NEXT_PUBLIC_BASE_URL`: URL de la API backend (ej: `http://localhost:8000`)

### Backend (`backend/.env`) — usado en desarrollo local sin Docker
- `MONGO_URL`: Cadena de conexión a MongoDB
- `MONGO_DB`: Nombre de la base de datos
- `SECRET_KEY`: Clave para firmar JWTs

### Frontend (`.env.local`)
- `NEXT_PUBLIC_BASE_URL`: URL de la API backend (ej: `http://localhost:8000`)

## Flujo de Uso

1. **Administrador** crea una competencia con problemas de LeetCode y puntuaciones por dificultad
2. **Estudiantes** se registran y crean o se unen a equipos
3. **Durante la competencia**, los miembros registran soluciones aceptadas manualmente
4. **Ranking en tiempo real**: Se ordena por puntos totales (descendente) y luego por tiempo (ascendente)

## Licencia

Proyecto desarrollado para la Semana de la Ingeniería de la Universidad de La Sabana.
