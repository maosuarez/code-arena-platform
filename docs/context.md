# Domain Context — Code Arena Unisabana

Plataforma de competencias de programación para equipos universitarios.
Los problemas son de LeetCode; los estudiantes los resuelven fuera de la plataforma
y registran su solución manualmente desde la UI.

## Entidades clave

| Entidad | Colección MongoDB | Notas |
|---|---|---|
| User | `users` | Tiene `teamCode` que lo vincula a un equipo |
| TeamCode | `teams` | `code` único, `points` acumulados, `submissions[]` |
| Competition | `competition` | Tiene `teams[]` (códigos), `problems[]`, `scoring` |
| Problem | embebido en Competition | `difficulty: easy/medium/hard`, `slug` de LeetCode |
| Submission | embebido en TeamCode | `status` siempre `"AC"`, `time` en segundos desde inicio |

## Flujo principal

1. Admin crea una competencia (`POST /competition/create`) con problemas y puntuación por dificultad.
2. Un usuario crea o se une a un equipo (`/teams`).
3. El equipo se inscribe en la competencia (`POST /competition/join`).
4. Durante la competencia, cualquier miembro registra un AC (`POST /competition/submission/{competitionId}/{problemId}`).
   - El backend calcula puntos según `competition.scoring[difficulty]`.
   - Suma puntos al equipo (`teams.points += points`).
   - Agrega un documento a `teams.submissions[]` con `time` = segundos desde `competition.date`.
5. El ranking se consulta en tiempo real (`GET /ranking/{competitionId}`).

## Reglas de negocio

- **Submissions**: La plataforma no valida si el problema realmente fue resuelto en LeetCode; confía en el usuario.
- **Puntuación**: `easy/medium/hard` → valores configurables por competencia.
- **Ranking**: `ORDER BY points DESC, totalTime ASC`. `totalTime` = tiempo del último AC del equipo.
- **Equipos**: `maxMembers` definido en el equipo. Un equipo puede estar en múltiples competencias.
- **Auth**: JWT de 120 min almacenado en `localStorage`. El `teamCode` del usuario se incluye en el token y en `/auth/verify`.
- **Competencia privada**: `GET /competition/private/{id}` devuelve datos de la competencia + datos del equipo del usuario autenticado en una sola llamada.

## Integraciones externas

- **MongoDB**: Motor async. En local se levanta como contenedor Docker (`mongo:7`). En producción puede apuntar a cualquier instancia externa via `MONGO_URL`.
- **LeetCode**: `services/leetcode_api.py` — actualmente vacío; futura validación automática de ACs.
- **Azure App Service**: backend en producción (`api-code-arena.azurewebsites.net`).
- **Azure Static Web Apps**: frontend en producción.
