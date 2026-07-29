# Domain Context — Code Arena Unisabana

Plataforma de competencias de programación para equipos universitarios.
Los problemas son propios de la plataforma (enunciado + casos de prueba ocultos)
y se evalúan automáticamente vía Judge0.

## Entidades clave

| Entidad | Colección MongoDB | Notas |
|---|---|---|
| User | `users` | Tiene `teamCode` que lo vincula a un equipo |
| TeamCode | `teams` | `code` único, `points` acumulados, `submissions[]` |
| Competition | `competition` | Tiene `teams[]` (códigos), `problems[]`, `scoring`, `podium[]` (si activo laberinto) |
| Problem | embebido en Competition | `difficulty: easy/medium/hard`, `statement`, `testCases[]` (`testcases` collection), `hidden_instructions` (anti-AI) |
| Submission | embebido en TeamCode | `status` siempre `"AC"`, `time` en segundos desde inicio |
| MazeConfig | `maze_configs` | `nodes[]`, `doors[]`, `startNodeId`, `goalNodeId` |
| MazeProgress | `maze_progress` | `currentNodeId`, `unlockedDoors[]`, `spentPoints`, `earnedPoints` por equipo |

## Flujo principal

### Problemas (flujo clásico)

1. Admin crea una competencia (`POST /competition/create`) con problemas y puntuación por dificultad.
2. Un usuario crea o se une a un equipo (`/teams`).
3. El equipo se inscribe en la competencia (`POST /competition/join`).
4. Durante la competencia, cualquier miembro registra un AC (`POST /competition/submission/{competitionId}/{problemId}`).
   - El backend calcula puntos según `competition.scoring[difficulty]`.
   - Suma puntos al equipo (`teams.points += points`).
   - Agrega un documento a `teams.submissions[]` con `time` = segundos desde `competition.date`.
5. El ranking se consulta en tiempo real (`GET /ranking/{competitionId}`).

### Laberinto (modo de juego opcional)

1. Admin crea una configuración de laberinto (`POST /maze/{competitionId}`) con nodos (posiciones en el grafo) y puertas (edges bidireccionales, cada una con un costo en puntos).
2. Equipos inscritos ven el laberinto en la pestaña "Laberinto" con su posición inicial (`startNodeId`).
3. Un equipo gasta puntos ganados de problemas para desbloquear puertas y avanzar entre nodos (`POST /maze/{competitionId}/unlock`).
   - Cada puerta está bidireccional: se puede cruzar desde cualquiera de sus dos nodos.
   - El backend valida de forma atómica: adyacencia, puerta no abierta ya, puntos disponibles.
   - El `maze_progress` del equipo se actualiza: `currentNodeId`, `spentPoints += door.cost`, `unlockedDoors[]`.
4. **Condición de meta**: cuando un equipo llega a `goalNodeId`, entra al podio automáticamente (sin necesidad de completar todos los problemas).
   - El podio tiene capacidad: mínimo(3, número de equipos inscritos).
   - Solo los primeros 3 equipos en alcanzar la meta quedan en el podio.
5. **Fin del juego**: cuando el podio está completo, `competition.status` cambia a `"completed"` y nadie más puede abrir puertas.
   - El equipo ganador es el primero en llegar (`podium[0]`).

## Reglas de negocio

- **Submissions**: El código se valida contra los casos de prueba del problema vía Judge0 (ver "Validación de Submissions" abajo).
- **Puntuación**: `easy/medium/hard` → valores configurables por competencia.
- **Ranking**: `ORDER BY points DESC, totalTime ASC`. `totalTime` = tiempo del último AC del equipo.
- **Equipos**: `maxMembers` definido en el equipo. Un equipo puede estar en múltiples competencias.
- **Auth**: JWT de 120 min almacenado en `localStorage`. El `teamCode` del usuario se incluye en el token y en `/auth/verify`.
- **Competencia privada**: `GET /competition/private/{id}` devuelve datos de la competencia + datos del equipo del usuario autenticado en una sola llamada.

### Validación de Submissions

La plataforma soporta dos modos de validación de código (determinados por variables de entorno):

1. **Modo Judge0** (cuando `JUDGE0_API_KEY` está configurada):
   - El código fuente se ejecuta contra los casos de prueba ocultos almacenados en `testcases` collection.
   - Se valida límites de tiempo (`time_limit`) y memoria (`memory_limit`) del problema.
   - Solo se acepta la submission si todas las pruebas pasan.
   - El cliente envía `source_code` y `language_id`.

2. **Modo fallback** (cuando `VALIDATION_CODE` está configurada, pero NO `JUDGE0_API_KEY`):
   - Validación simplificada: el cliente envía un código secreto (`validation_code`) que debe coincidir exactamente con `VALIDATION_CODE` del servidor.
   - Útil para ambientes de desarrollo, demos, o cuando no se puede integrar Judge0.
   - No ejecuta ni valida el código real del usuario.

En ambos modos, si la validación pasa, la submission se registra como `"AC"` y se suman puntos al equipo. **No se pueden cambiar después**.

### Laberinto

- Las puertas son **bidireccionales**: se pueden cruzar desde cualquiera de sus dos nodos (`from_node` o `to_node`).
- El costo de una puerta es **fijo** y se resta de los `spentPoints` del equipo cuando se desbloquea.
- Los `availablePoints` = `earnedPoints - spentPoints`. Un equipo solo puede gastar puntos que ya tiene.
- Un equipo que aún no ha desbloqueado ninguna puerta no tiene un documento en `maze_progress` hasta intentar abrir la primera (lazy initialization).
- El laberinto **solo se juega mientras la competencia está activa** (`status = "active"`); si la competencia termina (`status = "completed"`), nadie más puede abrir puertas.
- Un equipo **no puede estar dos veces en el podio**: si ya llegó a la meta, el siguiente laberinto no lo cuenta de nuevo.

## Eventos en tiempo real (MQTT)

La comunicación en tiempo real usa **MQTT** con WebSockets como transporte. El servidor publica eventos en dos canales distintos:

### Canal de competencia

**Topic**: `{MQTT_TOPIC_PREFIX}/ranking/{competitionId}` (ej. `code-arena/ranking/comp-123`)

Eventos que afectan a **todos los equipos** en la competencia:

- `new_submission`: Un equipo resolvió un problema.
  ```json
  {
    "event": "new_submission",
    "data": {
      "teamCode": "abc123",
      "problem": "prob-id",
      "points": 100,
      "member": "username",
      "time": 234
    }
  }
  ```

- `door_unlocked`: Un equipo desbloqueó una puerta del laberinto.
  ```json
  {
    "event": "door_unlocked",
    "data": {
      "teamCode": "abc123",
      "doorId": "door-1",
      "newNode": "node-5",
      "cost": 50
    }
  }
  ```

- `team_finished`: Un equipo llegó a la meta y tomó un lugar en el podio (el juego continúa hasta que el podio se completa).
  ```json
  {
    "event": "team_finished",
    "data": {
      "teamCode": "abc123",
      "teamName": "Python Masters",
      "position": 2,
      "podiumTarget": 3
    }
  }
  ```

- `game_over`: El podio se completó (top 3 en laberinto); el juego terminó para todos.
  ```json
  {
    "event": "game_over",
    "data": {
      "teamCode": "winning-team",
      "teamName": "Winners",
      "podium": [
        {"teamCode": "t1", "teamName": "Gold Team"},
        {"teamCode": "t2", "teamName": "Silver Team"},
        {"teamCode": "t3", "teamName": "Bronze Team"}
      ],
      "goalNodeId": "goal"
    }
  }
  ```

- `cheer`: Un miembro de un equipo envió un mensaje de ánimo (visible para todos).
  ```json
  {
    "event": "cheer",
    "data": {
      "teamCode": "abc123",
      "member": "username",
      "message": "¡Vamos que se puede!"
    }
  }
  ```

### Canal de equipo

**Topic**: `{MQTT_TOPIC_PREFIX}/team/{teamCode}` (ej. `code-arena/team/abc123`)

Eventos que afectan **solo a los miembros de un equipo específico**, independientes de cualquier competencia:

- `team_joined_competition`: El equipo se inscribió en una competencia (confirma la inscripción exitosa).
  ```json
  {
    "event": "team_joined_competition",
    "data": {
      "competitionId": "comp-123",
      "teamCode": "abc123"
    }
  }
  ```

### Consumo en el frontend

- `useCompetitionSocket(competitionId, onMessage)`: Suscribe al canal de competencia.
- `useTeamSocket(teamCode, onMessage)`: Suscribe al canal de equipo.

Ambos hooks manejan reconexión automática (10 segundos de retraso) y detectan errores auth fatales (no reintentan si hay error de credenciales).

## Integraciones externas

- **MongoDB**: Motor async. En local se levanta como contenedor Docker (`mongo:7`). En producción puede apuntar a cualquier instancia externa via `MONGO_URL`.
- **MQTT**: Broker MQTT para eventos en tiempo real (ej. Mosquitto o servicio en la nube). Variables de entorno: `MQTT_HOST`, `MQTT_WS_PORT`, `MQTT_WS_PATH`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_TOPIC_PREFIX`.
- **Judge0**: API de ejecución de código (solo si `JUDGE0_API_KEY` está configurada). Si no está disponible, usa modo fallback.
- **Vercel**: backend y frontend en producción (un solo `vercel.json` en la raíz define ambos servicios; deploy automático al hacer push a `main`).
- **MongoDB Atlas**: base de datos en producción (tier M0 gratuito).
