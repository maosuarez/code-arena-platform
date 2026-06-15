# Guía de Despliegue — Code Arena Unisabana

Instrucciones completas para desplegar Code Arena en desarrollo local, producción con Docker, y servicios en la nube (Azure).

## Tabla de contenidos

1. [Requisitos previos](#requisitos-previos)
2. [Despliegue local con Docker Compose](#despliegue-local-con-docker-compose)
3. [Despliegue manual sin Docker](#despliegue-manual-sin-docker)
4. [Configuración de variables de entorno](#configuración-de-variables-de-entorno)
5. [Servicios externos](#servicios-externos)
6. [Despliegue en servidor (Azure)](#despliegue-en-servidor-azure)
7. [Verificación post-despliegue](#verificación-post-despliegue)
8. [Solución de problemas](#solución-de-problemas)

---

## Requisitos previos

### Para desarrollo local (Docker Compose)

- **Docker**: v20.10 o superior
- **Docker Compose**: v1.29 o superior
- **Git**: para clonar el repositorio

Verificar:
```bash
docker --version
docker compose version
```

### Para despliegue manual sin Docker

- **Python**: v3.11 o superior
- **Node.js**: v18 o superior (incluye npm)
- **MongoDB**: Contenedor Docker o instancia externa
- **Git**: para clonar el repositorio

Verificar:
```bash
python --version
node --version
npm --version
```

### Para despliegue en Azure

- Cuenta de Azure con suscripción activa
- Azure CLI (`az`) instalado en tu máquina
- Credenciales de Docker Hub o Azure Container Registry (ACR)

---

## Despliegue local con Docker Compose

**Tiempo estimado**: 5-10 minutos (primera vez, incluye descargas de imágenes).

### Pasos

1. **Clona el repositorio**

   ```bash
   git clone https://github.com/tu-usuario/code-arena-unisabana.git
   cd code-arena-unisabana
   ```

2. **Copia el archivo de variables de entorno**

   ```bash
   cp .env.example .env
   ```

3. **Ajusta las variables de entorno (opcional)**

   Abre `.env` y verifica que los valores por defecto sean adecuados para desarrollo:
   - `MONGO_URL=mongodb://mongo:27017` — Contenedor interno, correcto para desarrollo.
   - `MONGO_DB=code_arena` — Nombre de BD, puede cambiar.
   - `SECRET_KEY=cambia-esta-clave-en-produccion` — Cambiar en producción (ver sección [Seguridad](#seguridad)).
   - `NEXT_PUBLIC_BASE_URL=/backend` — Proxy mode, correcto para desarrollo local.
   - `BACKEND_INTERNAL_URL=http://backend:8000` — Red interna Docker, correcto.

4. **Construye e inicia los servicios**

   ```bash
   docker compose up --build
   ```

   Espera a que veas mensajes como:
   ```
   backend  | Uvicorn running on http://0.0.0.0:8000
   frontend | Local:        http://localhost:3000
   ```

5. **Accede a la aplicación**

   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **Docs API**: http://localhost:8000/docs

6. **Detener los servicios**

   ```bash
   docker compose down
   ```

   Para limpiar volúmenes de datos:
   ```bash
   docker compose down -v
   ```

### Modo proxy vs. modo directo

Por defecto, docker-compose usa **modo proxy**:
- El backend NO está expuesto al host.
- El frontend en `localhost:3000` reescribe `/backend/*` a `http://backend:8000/*` (red interna Docker).
- El navegador nunca llama directo al backend.

Para activar **modo directo** (si necesitas exponer el backend al host):
1. Descomenta la línea `ports: ["8000:8000"]` en `docker-compose.yml` bajo el servicio `backend`.
2. En `.env`, cambia:
   ```
   NEXT_PUBLIC_BASE_URL=http://localhost:8000  # o tu URL pública del backend
   BACKEND_INTERNAL_URL=                        # Deja vacío para desactivar el proxy
   ```
3. Reconstruye: `docker compose up --build`

---

## Despliegue manual sin Docker

**Para desarrollo local sin contenedores.**

### Backend

1. **Inicia MongoDB** (con Docker, alternativa a instancia local)

   ```bash
   docker run -d \
     -p 27017:27017 \
     -v mongo-data:/data/db \
     --name code-arena-mongo \
     mongo:7
   ```

   O si tienes MongoDB instalado localmente, inicia el servicio:
   ```bash
   # Linux/macOS
   mongod --dbpath /path/to/data

   # Windows
   mongod --dbpath C:\data\db
   ```

2. **Crea un archivo `.env` en la raíz o en `backend/`**

   ```bash
   cd backend
   # Copia y edita
   cp ../.env.example .env
   ```

   Ajusta:
   ```
   MONGO_URL=mongodb://localhost:27017
   MONGO_DB=code_arena
   SECRET_KEY=tu-clave-secreta-segura
   JUDGE0_API_URL=https://judge0.maosuarez.com
   JUDGE0_API_KEY=
   ```

3. **Instala dependencias de Python**

   ```bash
   cd backend
   python -m venv venv

   # Activa el virtualenv
   # Linux/macOS:
   source venv/bin/activate
   # Windows:
   venv\Scripts\activate

   pip install -r requirements.txt
   ```

4. **Inicia el servidor backend**

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   Deberías ver:
   ```
   Uvicorn running on http://0.0.0.0:8000
   ```

5. **Verifica la API**

   Abre http://localhost:8000/docs en tu navegador.

### Frontend

En otra terminal:

1. **Navega a frontend**

   ```bash
   cd frontend
   ```

2. **Instala dependencias de Node**

   ```bash
   npm install
   ```

3. **Crea archivo `.env.local`**

   ```bash
   # En frontend/
   echo "NEXT_PUBLIC_BASE_URL=http://localhost:8000" > .env.local
   echo "NEXT_PUBLIC_MQTT_WS_URL=wss://mqtt.tudominio.com/mqtt" >> .env.local
   echo "NEXT_PUBLIC_MQTT_TOPIC_PREFIX=code-arena" >> .env.local
   ```

4. **Inicia el servidor frontend**

   ```bash
   npm run dev
   ```

   Deberías ver:
   ```
   ▲ Next.js 15.5.2
   - Local: http://localhost:3000
   ```

5. **Accede a la aplicación**

   http://localhost:3000

---

## Configuración de variables de entorno

### Backend (raíz `.env`)

Requeridas:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGO_URL` | Cadena de conexión MongoDB | `mongodb://localhost:27017` o `mongodb+srv://user:pass@cluster.mongodb.net` |
| `MONGO_DB` | Nombre de la base de datos | `code_arena` |
| `SECRET_KEY` | Clave para firmar JWTs (40+ caracteres, aleatorio) | `$(python -c 'import secrets; print(secrets.token_urlsafe(32))')` |

Opcionales (integración con servicios externos):

| Variable | Descripción | Ejemplo | Default |
|----------|-------------|---------|---------|
| `JUDGE0_API_URL` | URL del API Judge0 | `https://judge0.maosuarez.com` | (requerido para validar código) |
| `JUDGE0_API_KEY` | Token de autenticación Judge0 | `your-api-key` | (dejar en blanco si no autenticado) |
| `JUDGE0_ALLOWED_HOSTS` | Hosts permitidos para Judge0 (seguridad) | `judge0.maosuarez.com,judge0.otro.com` | `judge0.maosuarez.com` |
| `MQTT_HOST` | Host del broker MQTT | `mqtt.tudominio.com` | (requerido para ranking real-time) |
| `MQTT_WS_PORT` | Puerto WebSocket MQTT | `443` | `443` |
| `MQTT_WS_PATH` | Path WebSocket MQTT | `/mqtt` | `/mqtt` |
| `MQTT_USERNAME` | Usuario MQTT | `code-arena-backend` | (requerido si broker exige auth) |
| `MQTT_PASSWORD` | Password MQTT | `tu-password` | (requerido si broker exige auth) |
| `MQTT_TOPIC_PREFIX` | Prefijo de tópicos MQTT | `code-arena` | `code-arena` |
| `CORS_ORIGINS` | Orígenes CORS permitidos (coma-separados) | `https://mi-frontend.com,https://admin.com` | Vacío = modo proxy |
| `ADMIN_INITIAL_PASSWORD` | Password inicial para admin@codearena.local | `admin123!` | (opcional, para primer despliegue) |
| `VALIDATION_CODE` | Código secreto para validar participantes | `secret-code-123` | (opcional) |

### Frontend (variables baked en build)

En `docker-compose.yml` bajo `frontend.build.args`, o en `.env.local` para desarrollo local:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NEXT_PUBLIC_BASE_URL` | URL base del backend | `/backend` (proxy local) o `https://api.miapp.com` |
| `NEXT_PUBLIC_MQTT_WS_URL` | URL WebSocket MQTT | `wss://mqtt.tudominio.com/mqtt` |
| `NEXT_PUBLIC_MQTT_TOPIC_PREFIX` | Prefijo de tópicos | `code-arena` |
| `NEXT_PUBLIC_MQTT_USERNAME` | Usuario MQTT (navegador) | `frontend-client` |
| `NEXT_PUBLIC_MQTT_PASSWORD` | Password MQTT (navegador) | (dejar vacío si posible) |

**Nota**: Variables `NEXT_PUBLIC_*` se inyectan en tiempo de build y no se pueden cambiar en runtime sin reconstruir.

### Ejemplo `.env` para desarrollo local

```bash
# MongoDB
MONGO_URL=mongodb://localhost:27017
MONGO_DB=code_arena

# Backend
SECRET_KEY=desarrollo-clave-segura-40-caracteres-minimo-123456
VALIDATION_CODE=codigo-secreto-del-organizador
CORS_ORIGINS=

# Frontend proxy mode
NEXT_PUBLIC_BASE_URL=/backend
BACKEND_INTERNAL_URL=http://backend:8000
FRONTEND_PORT=3000

# MQTT
MQTT_HOST=mqtt.tudominio.com
MQTT_WS_PORT=443
MQTT_WS_PATH=/mqtt
MQTT_USERNAME=code-arena-backend
MQTT_PASSWORD=tu-password-mqtt
MQTT_TOPIC_PREFIX=code-arena
NEXT_PUBLIC_MQTT_WS_URL=wss://mqtt.tudominio.com/mqtt
NEXT_PUBLIC_MQTT_TOPIC_PREFIX=code-arena
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=

# Judge0
JUDGE0_API_URL=https://judge0.maosuarez.com
JUDGE0_API_KEY=
```

---

## Servicios externos

### MongoDB

**Desarrollo local con Docker**:

```bash
docker run -d \
  -p 27017:27017 \
  -v mongo-data:/data/db \
  --name code-arena-mongo \
  mongo:7
```

**En producción (opciones)**:

1. **MongoDB Atlas** (cloud gratuito hasta 5GB):
   - Crea un cluster en https://www.mongodb.com/cloud/atlas
   - Obtén la cadena de conexión: `mongodb+srv://user:pass@cluster.mongodb.net/dbname`
   - Establece `MONGO_URL` a esa cadena.

2. **Azure Cosmos DB** (API MongoDB):
   - En Azure Portal, crea un Cosmos DB con API MongoDB.
   - Copia la cadena de conexión primaria.
   - Establece `MONGO_URL`.

3. **Servidor propio** con MongoDB instalado.

**Verificar conexión**:

```bash
# Instala mongosh o usa mongo client
mongosh "mongodb://localhost:27017/code_arena"
```

### Judge0

**Para validar soluciones de código automáticamente.**

#### Opción 1: Instancia pública (rápido, limitado)

Usa la instancia pública: `https://judge0.maosuarez.com`

```
JUDGE0_API_URL=https://judge0.maosuarez.com
JUDGE0_API_KEY=  # Dejar en blanco si no requiere autenticación
```

**Limitaciones**: Límite de rate, sin garantía de disponibilidad.

#### Opción 2: Self-hosted (controlado, recomendado para producción)

Despliega Judge0 en tu servidor o en Azure Container Instances.

**Pasos básicos** (en servidor Ubuntu):

```bash
git clone https://github.com/judge0/judge0.git
cd judge0
cp .env.example .env
# Edita .env para configurar redis, postgres, autenticación
docker compose up -d
```

Luego configura:
```
JUDGE0_API_URL=https://tu-judge0.com
JUDGE0_API_KEY=tu-api-key  # Si lo configuraste con AUTHN_TOKEN en judge0.conf
```

**Documentación**: https://judge0.com/

### MQTT (Ranking real-time)

**Para actualizaciones de ranking en tiempo real sin recargar página.**

#### Opción 1: EMQX Cloud (managed)

1. Crea una cuenta en https://www.emqx.com/
2. Crear un deployment (free tier disponible)
3. Obtén credenciales y endpoint WebSocket
4. Configura:

```
MQTT_HOST=your-instance.emqx.cloud
MQTT_WS_PORT=443
MQTT_WS_PATH=/mqtt
MQTT_USERNAME=user
MQTT_PASSWORD=password
NEXT_PUBLIC_MQTT_WS_URL=wss://your-instance.emqx.cloud/mqtt
```

#### Opción 2: Self-hosted EMQX (en Docker)

```bash
docker run -d \
  -p 1883:1883 \
  -p 8883:8883 \
  -p 8083:8083 \
  -p 8084:8084 \
  --name emqx \
  emqx/emqx:latest
```

Configura en `.env`:

```
MQTT_HOST=localhost  # o IP pública del servidor
MQTT_WS_PORT=8083
MQTT_WS_PATH=/mqtt
```

#### Opción 3: Mosquitto (simple, self-hosted)

```bash
docker run -d \
  -p 1883:1883 \
  -p 9001:9001 \
  --name mosquitto \
  eclipse-mosquitto:latest
```

### Verificar conexiones

**MongoDB**:
```bash
mongosh "mongodb://localhost:27017/code_arena" --eval "db.ping()"
```

**Judge0**:
```bash
curl https://judge0.maosuarez.com/api/statuses
```

**MQTT**:
```bash
npm install -g mqtt-cli
mqtt-cli pub -h mqtt.tudominio.com -p 1883 -t test/topic -m "hello"
```

---

## Despliegue en servidor (Azure)

### Arquitectura objetivo

```
Azure Static Web Apps (Frontend)
    ↓ (reescribe /api/* a backend)
Azure App Service (Backend FastAPI)
    ↓
Azure Database for MongoDB (o MongoDB Atlas)
```

### Fase 1: Preparar repositorio

1. **Push a GitHub** (requerido para Azure Static Web Apps)

   ```bash
   git remote add origin https://github.com/tu-usuario/code-arena-unisabana.git
   git push -u origin main
   ```

2. **Variables de entorno en GitHub Secrets** (para CI/CD)

   Abre tu repo en GitHub → Settings → Secrets and variables → Actions → New repository secret

   Agrega:
   - `AZURE_SUBSCRIPTION_ID`
   - `AZURE_RESOURCE_GROUP`
   - `DOCKER_USERNAME` (Docker Hub)
   - `DOCKER_PASSWORD`

### Fase 2: Desplegar backend en Azure App Service

1. **Crea Azure App Service** (si no existe)

   ```bash
   az login
   az group create --name code-arena-rg --location eastus2
   az appservice plan create \
     --name code-arena-plan \
     --resource-group code-arena-rg \
     --sku B1 \
     --is-linux
   az webapp create \
     --resource-group code-arena-rg \
     --plan code-arena-plan \
     --name api-code-arena \
     --deployment-container-image-name nginx
   ```

2. **Construye e sube imagen Docker**

   ```bash
   docker build -t tu-docker-user/code-arena-backend:latest ./backend
   docker push tu-docker-user/code-arena-backend:latest
   ```

3. **Configura App Service para usar imagen**

   ```bash
   az webapp config container set \
     --name api-code-arena \
     --resource-group code-arena-rg \
     --docker-custom-image-name tu-docker-user/code-arena-backend:latest \
     --docker-registry-server-url https://index.docker.io \
     --docker-registry-server-user tu-docker-user \
     --docker-registry-server-password tu-docker-password
   ```

4. **Configura variables de entorno**

   ```bash
   az webapp config appsettings set \
     --resource-group code-arena-rg \
     --name api-code-arena \
     --settings \
       MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net" \
       MONGO_DB="code_arena" \
       SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')" \
       JUDGE0_API_URL="https://judge0.maosuarez.com" \
       MQTT_HOST="mqtt.tudominio.com" \
       MQTT_USERNAME="code-arena" \
       MQTT_PASSWORD="tu-password"
   ```

5. **Habilita logs**

   ```bash
   az webapp log config \
     --name api-code-arena \
     --resource-group code-arena-rg \
     --docker-container-logging filesystem
   az webapp log show \
     --name api-code-arena \
     --resource-group code-arena-rg
   ```

### Fase 3: Desplegar frontend en Azure Static Web Apps

1. **Crea Static Web App**

   ```bash
   az staticwebapp create \
     --resource-group code-arena-rg \
     --name code-arena-web \
     --source https://github.com/tu-usuario/code-arena-unisabana \
     --location eastus2 \
     --branch main \
     --app-location "frontend" \
     --output-location ".next"
   ```

   Azure genera un workflow en `.github/workflows/` automáticamente.

2. **Configura variables de entorno** en el workflow YAML o en Azure Portal

   En `.github/workflows/azure-static-web-apps-*.yml`:

   ```yaml
   - name: Build
     run: |
       cd frontend
       npm install
       npm run build
     env:
       NEXT_PUBLIC_BASE_URL: "https://api-code-arena.azurewebsites.net"
       NEXT_PUBLIC_MQTT_WS_URL: "wss://mqtt.tudominio.com/mqtt"
       NEXT_PUBLIC_MQTT_TOPIC_PREFIX: "code-arena"
   ```

3. **Configura rewrites API** (Static Web Apps configuration)

   Crea o edita `staticwebapp.config.json` en la raíz del frontend:

   ```json
   {
     "navigationFallback": {
       "rewrite": "/404.html"
     },
     "routes": [
       {
         "route": "/api/*",
         "rewrite": "https://api-code-arena.azurewebsites.net/*"
       }
     ],
     "defaultHostName": "code-arena-web.azurewebsites.net"
   }
   ```

   Luego actualiza `NEXT_PUBLIC_BASE_URL=https://code-arena-web.azurewebsites.net/api` en el workflow.

4. **Push y verifica**

   Cada push a `main` dispara el workflow automáticamente.

   ```bash
   git add .
   git commit -m "chore: Azure Static Web Apps config"
   git push origin main
   ```

   Monitorea en Azure Portal → Static Web App → Deployments.

### Fase 4: SSL/TLS y dominio

1. **Mapea dominio personalizado** (ambos servicios)

   ```bash
   # App Service
   az webapp config hostname add \
     --resource-group code-arena-rg \
     --webapp-name api-code-arena \
     --hostname api.tudominio.com

   # Static Web App
   az staticwebapp custom-domain create \
     --name code-arena-web \
     --resource-group code-arena-rg \
     --domain-name tudominio.com
   ```

2. **Certificados SSL automáticos** (Azure gestiona mediante HTTPS automático)

---

## Verificación post-despliegue

### Health checks

**Backend**:

```bash
curl http://localhost:8000/health
# Response: {"status":"ok"}

curl http://localhost:8000/docs
# Debe abrir Swagger UI
```

**Frontend**:

```bash
curl http://localhost:3000
# Debe retornar HTML de Next.js
```

### Verificación de funcionalidad

1. **Registro e login**

   ```bash
   # Crea usuario
   curl -X POST http://localhost:8000/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","username":"testuser"}'

   # Login
   curl -X POST http://localhost:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

2. **Crear equipo**

   ```bash
   curl -X POST http://localhost:8000/teams/create \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <tu-token>" \
     -d '{"name":"Mi Equipo","maxMembers":5}'
   ```

3. **MongoDB**

   ```bash
   mongosh "mongodb://localhost:27017/code_arena" \
     --eval "db.users.countDocuments()"
   ```

4. **MQTT (si está configurado)**

   ```bash
   npm install -g mqtt-cli
   mqtt-cli pub -h mqtt.tudominio.com -t "code-arena/ranking" -m '{"test":"data"}'
   ```

5. **Judge0 (si está configurado)**

   ```bash
   # Intenta un submission en la UI o:
   curl -X POST https://judge0.maosuarez.com/submissions \
     -H "Content-Type: application/json" \
     -d '{
       "source_code":"print(1+1)",
       "language_id":71,
       "stdin":"",
       "expected_output":"2"
     }'
   ```

### Logs

**Backend (Docker)**:

```bash
docker logs code-arena-unisabana-backend-1
```

**Backend (Azure App Service)**:

```bash
az webapp log tail --name api-code-arena --resource-group code-arena-rg
```

**Frontend (Azure Static Web Apps)**:

```bash
az staticwebapp show \
  --name code-arena-web \
  --resource-group code-arena-rg
```

---

## Solución de problemas

### Backend no conecta a MongoDB

**Síntoma**: `ConnectionFailure` en logs del backend.

**Soluciones**:
1. Verifica que MongoDB está corriendo: `docker ps | grep mongo`
2. Verifica `MONGO_URL` es correcta en `.env`
3. Si usas MongoDB Atlas, verifica whitelist de IP y credenciales.

### Frontend no conecta a backend

**Síntoma**: Errores 404 o `Failed to fetch` en console.

**Soluciones**:
1. Verifica `NEXT_PUBLIC_BASE_URL` apunta al backend correcto.
2. En docker-compose, verifica `BACKEND_INTERNAL_URL` si usas proxy mode.
3. Si en Azure, verifica `staticwebapp.config.json` rewrites.

### Rate limiting bloquea solicitudes

**Síntoma**: Respuestas 429 Too Many Requests.

**Soluciones**:
1. Espera unos minutos.
2. Ajusta límites en `backend/app/limiter.py` si necesario.
3. Verifica que `CORS_ORIGINS` no esté restringido incorrectamente.

### Judge0 falla

**Síntoma**: "Error al conectar con el juez" en la UI.

**Soluciones**:
1. Verifica `JUDGE0_API_URL` es accesible: `curl https://judge0.maosuarez.com/api/statuses`
2. Si self-hosted, verifica que el contenedor Judge0 está corriendo.
3. Si requiere `JUDGE0_API_KEY`, verifica es correcta en `.env`.

### MQTT no actualiza ranking

**Síntoma**: Ranking no se actualiza sin recargar página.

**Soluciones**:
1. Verifica `NEXT_PUBLIC_MQTT_WS_URL` apunta al broker MQTT correcto.
2. Verifica credenciales MQTT: `MQTT_USERNAME`, `MQTT_PASSWORD`.
3. En logs backend, busca errores de `aiomqtt`.
4. Verifica el broker MQTT está corriendo: `docker ps | grep mqtt` o `docker ps | grep emqx`.

### Sesión JWT expira rápido

**Síntoma**: Usuario logeado pero token expira antes de esperado.

**Soluciones**:
1. JWT tiene TTL fijo de 120 minutos por diseño. Ver `backend/app/routes/auth.py`.
2. Para aumentar, modifica `ACCESS_TOKEN_EXPIRE_MINUTES` en código (requiere recompile).

---

## Checklist de despliegue en producción

Antes de hacer deploy a producción:

- [ ] `SECRET_KEY` es único, largo (40+ chars) y aleatorio. **Nunca** uses valor de ejemplo.
- [ ] MongoDB está en instancia segura (Atlas con whitelist, o servidor privado).
- [ ] HTTPS está habilitado en todos los endpoints (Azure maneja automáticamente).
- [ ] CORS_ORIGINS está configurado solo para dominios autorizados (o vacío en proxy mode).
- [ ] Judge0 está disponible y autenticado si requiere.
- [ ] MQTT está disponible y autenticado.
- [ ] Logs están centralizados (Sentry, Application Insights, etc.).
- [ ] Base de datos tiene backups configurados.
- [ ] Rate limiting está ajustado según proyecciones de tráfico.
- [ ] Security headers están activos (HSTS, CSP, X-Frame-Options).
- [ ] Passwords y credenciales está en secrets, no en código.

---

## Referencias

- **FastAPI**: https://fastapi.tiangolo.com/
- **Next.js**: https://nextjs.org/docs
- **MongoDB**: https://www.mongodb.com/docs/
- **Judge0**: https://judge0.com/
- **MQTT (EMQX)**: https://www.emqx.com/
- **Azure App Service**: https://learn.microsoft.com/en-us/azure/app-service/
- **Azure Static Web Apps**: https://learn.microsoft.com/en-us/azure/static-web-apps/
- **Docker**: https://docs.docker.com/

---

**Última actualización**: Junio 2026
