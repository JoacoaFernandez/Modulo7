# Integración de Analítica (Módulo 7) con los demás grupos de UADEnet

Especificación técnica para implementar. Redactada el 2026-11-05 sobre la rama `feature/db-postgres`. El texto de las secciones 1 a 9 está escrito en futuro ("se crea", "se reescribe", "se borra"): es la spec original, ya implementada (ver la nota siguiente).

> **Implementado el 2026-11-05** (commits `917fcde` Fase A, `8aa6f41` Fase B, `fc0d831` Fase C, `2f026a5` Fase D, `4c8359c` Fase E; la Fase F es la documentación). Para ver qué existe hoy: `backend/EVENTOS.md`, `README.md`, `CONTEXTO-UADENET.md` («Estado de implementación») y `CLAUDE.md`. **Desvíos respecto de esta spec** (lo que dice el código manda sobre el resto del documento):
> - **Tipo de evento aproximado.** G6 no informa `category`: el tipo sale de la clase de precio (Pago / Gratuito) y el tablero de eventos lo avisa con un `warning` (`source: "events"`).
> - **Feeders.** `EVENTS_FEEDERS` suma `backoffice` (`["eventos", "backoffice"]`, por `location.upserted`); `ACADEMIC_FEEDERS` es `["gestion-academica", "backoffice"]` y `FINANCIAL_FEEDERS` `["core", "backoffice", "tienda", "comedor"]`.
> - **Validators tolerantes.** Si Backoffice o Gestión Académica fallan al armar los catálogos, `parseAcademicFilters` y `parseFinancialFilters` aceptan un `sedeId`, `facultad` o `cuatrimestre` bien formado aunque no esté en la lista reducida, y el tablero sale con aviso; con las fuentes sanas un valor desconocido sigue dando `400`.
> - **Seed mínimo eliminado.** `prisma/seed.ts` y `npm run db:seed` se borraron (usaban el contrato viejo): el único seed es el demo (`npm run db:demo`).
> - **Demo.** Son 9 tipos persistidos (no 8), ~34,6 mil envelopes v1 con `eventId` estables (prefijo `de0de0de`), y `wallets-aggregates` de marzo a noviembre de 2026 (nueve meses, no seis). `db:demo` también carga los snapshots de saldo desde los mocks; `db:demo:clear` los borra junto con los eventos del demo.
> - **Respuestas del POST.** Los 400 llevan `code: "INVALID_EVENT"` y `errors[]`; los códigos del POST son `201 STORED`, `200 DUPLICATE`, `202 IGNORED`.
> - **Backfill.** `npm run backfill:core` exige `CORE_MOCK=false`: con el mock no existe `CoreEventsGateway`.
> - **Snapshots.** Un mes sin datos (`walletCount: 0`) no se guarda; el ciclo siempre revisa el mes anterior y, con `WALLET_SNAPSHOT_BACKFILL_MONTHS=N`, los N anteriores.
> - **Mocks.** `core/wallets-aggregates/_empty.json` es opcional y no existe en el repo (sin él, respuesta vacía); los mocks de períodos (ids 3 a 8), sedes (una `INACTIVE`) y cursos son más ricos que los ejemplos de la sección 5.
> - **Tests.** No se agregó `backend/test/` ni el script `test`: sigue sin haber tests automatizados.

**Objetivo.** Pasar de nuestro contrato propio (`sourceModule` + `payload`) al contrato de CORE (envelope v1 y catálogo de eventos), consultar en vivo a los módulos dueños de cada dato y, **mientras los otros grupos no estén listos**, simularlos con una capa de mocks apagable por flag: los eventos de cola con Postman y las respuestas REST con archivos `.json` editables a mano.

**Prioridad de fuentes** (si dos se contradicen manda la de arriba): Novedades CORE 04/11 > Trello y xlsx de los equipos según fecha > CORE v1 > nuestros documentos. Citas: `(CORE v1, §N)`, `(Novedades 04/11, p. N)`, `(Trello, «card», fecha)`, `(xlsx M#, hoja «…»)`, `(CONTEXTO §N)` = `CONTEXTO-UADENET.md`.

**Estados de un evento o endpoint:**
- **CORE oficial**: figura en el catálogo de CORE v1 (§11) o en un acuerdo posterior.
- **Declarado por Gx**: lo declara el equipo en su xlsx o en Trello, sin estar en el catálogo de CORE.
- **Propuesto / pendiente de registrar en CORE**: lo propusimos nosotros (xlsx M7) y nadie lo emite todavía.

## Índice

1. [Arquitectura objetivo](#1-arquitectura-objetivo)
2. [Variables de entorno y flags](#2-variables-de-entorno-y-flags)
3. [Catálogo de eventos que consume Analítica](#3-catálogo-de-eventos-que-consume-analítica)
4. [Endpoints REST que consume Analítica](#4-endpoints-rest-que-consume-analítica)
5. [Layout de mocks](#5-layout-de-mocks)
6. [Mapeo métrica → fuente](#6-mapeo-métrica--fuente)
7. [Cambios en la base](#7-cambios-en-la-base)
8. [Plan de implementación por fases](#8-plan-de-implementación-por-fases)
9. [Preguntas abiertas](#9-preguntas-abiertas)
10. [Objeciones](#10-objeciones)

---

## 1. Arquitectura objetivo

```mermaid
flowchart LR
  subgraph EM["Módulos emisores"]
    G1["Estudiante / Docente"]
    G3["Biblioteca"]
    G4["Comedor"]
    G5["Tienda"]
    G6["Eventos"]
    G8["Backoffice"]
    G9["Gestión Académica"]
  end

  subgraph CORE["CORE (G10)"]
    PUB["POST /internal/v1/events (outbox)"]
    BUS[("exchange uadenet.events.v1")]
    Q[("cola analytics.all-events.v1 (#)")]
    CAUTH["Auth: /api/v1/auth/*, JWKS, service-auth/token"]
    CWAL["GET /internal/v1/wallets/aggregates"]
  end

  subgraph AN["Analítica (backend)"]
    CONS["Consumer RabbitMQ (si hay RABBITMQ_URL)"]
    POST["POST /api/analytics/events (mock, EVENTS_HTTP_INGEST)"]
    REC["RecordEventUseCase: valida envelope + data, inbox idempotente"]
    DB[("Postgres: inbox_events, source_ingestions, wallet_balance_snapshots")]
    JOB["Job de snapshots (outstandingBalance)"]
    GW["Gateways: Core · Backoffice · Académica"]
    HTTP["Impl. HTTP (token de servicio, caché TTL)"]
    MOCK["Impl. mock (lee backend/mocks/**.json en cada llamada)"]
    DASH["Tableros: academic · financial · events · filters · sources"]
    AUTHP["Proxy de login /api/auth/* + verificador JWT (JWKS o mock)"]
  end

  FE["Frontend (React)"]
  PM["Postman (simula la cola)"]
  FILES[("backend/mocks/")]

  EM --> PUB --> BUS --> Q --> CONS --> REC
  PM -.-> POST -.-> REC
  REC --> DB
  CWAL --> HTTP
  G8 -. "REST /internal/v1" .-> HTTP
  G9 -. "REST" .-> HTTP
  HTTP --> GW
  FILES -.-> MOCK -.-> GW
  GW --> JOB --> DB
  DB --> DASH
  GW --> DASH
  CAUTH --> AUTHP
  AUTHP --> FE
  DASH --> FE
```

Líneas punteadas = caminos que existen sólo en modo mock (Postman, archivos) o que dependen de que el otro grupo habilite la ruta.

### 1.1 Decisiones tomadas dentro del margen

| Tema | Decisión | Justificación |
|---|---|---|
| **Eventos de `eventType` desconocido o sin uso** | **Ack y descarte** (no se guardan). Flag `INBOX_STORE_UNKNOWN=true` los guarda con `result='UNKNOWN_TYPE'`. Siempre se actualiza `source_ingestions` (último recibido y contadores) | Con binding `#` llega todo el bus, incluso `backoffice.user.upserted.v1` (mail y permisos), notificaciones y wallet. CORE conserva los eventos y permite releerlos (`GET /internal/v1/events`, `replay`, CORE v1 §9), así que descartar no pierde nada definitivo. Guardar todo sube volumen y datos personales sin que ninguna métrica lo use. Nuestro xlsx M7 ya decía "se ackean y se descartan" |
| **Qué se persiste de los eventos conocidos** | Sólo los que alimentan una métrica (sección 3). Los de efecto lateral (`backoffice.user.*`) se procesan y no se guardan. A cada tipo se le puede declarar `redact` (campos que se borran de `data` antes de guardar, p. ej. `userId`) | Pedido de G5 y nuestro xlsx M7: no guardar `userId` de compras ni de wallet. Mínimo dato personal |
| **Validación de `data`** | Estricta en el tipo de los campos que declaramos; **obligatorios sólo los que una métrica necesita**; campos extra se aceptan y se ignoran | CORE ya valida contra JSON Schema al publicar. Si nos pusiéramos más estrictos que CORE mandaríamos a la DLQ eventos buenos y perderíamos métricas |
| **Errores del consumer** | Schema inválido o `eventType` mal formado: `nack(requeue=false)` → DLQ. Error transitorio (DB): reintento en proceso 3 veces (1 s, 5 s, 30 s) con el mensaje sin ack; si sigue fallando, `nack(requeue=false)` | Las Novedades aclaran que un NACK no activa solo los reintentos demorados de CORE: el reintento lo implementa cada módulo (Trello, «G5→G10 #18», 2026-10-20) |
| **Mocks con parámetros** | Un archivo por clave bajo una carpeta por recurso: `academic/cursos/8.json` es literalmente la respuesta de `?periodoId=8`. Sin archivo: `404 problem+json` para `/{id}`, y respuesta vacía para listados por clave. Los listados completos (sedes, carreras, períodos) son un solo archivo | Es lo más fácil de editar a mano: el contenido del archivo es el body, sin mapas anidados ni DSL. Detalle en la sección 5 |
| **Login del frontend** | **Proxy propio** `/api/auth/*` (login, refresh, logout, me) que habla con CORE (o con el mock) | El refresh token vive en una cookie `HttpOnly; SameSite=Lax; Path=/api/v1/auth` (CORE v1 §3; Trello, «G8→G10 · Dudas del Swagger…», 2026-11-04). Una cookie `Lax` no viaja en un `fetch` cross-site: si el SPA llamara directo a `railway.app`, el refresh no funcionaría. Con proxy la cookie la fija nuestro backend (mismo sitio que el SPA) con `Path=/api/auth`. Además el frontend ya llama a `/api/auth/login`, el mismo código sirve para mock y real, y podemos sumar el nombre desde Backoffice. Costo: la contraseña pasa por nuestro backend (no se loguea) y todos los logins comparten la IP de nuestro servidor para el rate limit de CORE (100/min por IP): aceptable con pocos usuarios |
| **Roles de CORE → secciones** | `ACADEMIC_ADMIN` → `academica` (tablero académico + eventos); `FINANCE_ADMIN` → `financiera`; `ADMIN` → ambas. Si CORE crea `analytics:academic:read` / `analytics:finance:read`, esos permisos otorgan la sección por sí solos | Catálogo vigente de 11 roles (Novedades 04/11, p. 4). No existe ningún permiso `analytics:*` hoy (CONTEXTO §3.2) |
| **Sede sin dato** | Saldo, ingresos, egresos y gastos (CORE) **no se pueden filtrar por sede**: con una sede elegida se muestran los valores institucionales y el tablero devuelve `siteScopeNote` para que el frontend lo avise | `aggregates` no trae `siteId` (CORE v1 §7). No se inventa una apertura por sede |
| **Falla de un gateway** | El tablero responde `200` con el bloque afectado vacío (`value: 0`, `formattedValue: "—"`) y un `warnings[]` con `{source, message}`. Nunca se devuelven números inventados | Un tablero no debe caerse entero porque G9 esté lento |
| **Mock de CORE: tokens** | El mock firma JWT RS256 con un par de claves local (`backend/.mock-keys/`, creado al primer arranque, ignorado por git), mismos claims que CORE. **No hace falta JWKS en el mock**: el verificador mock usa la clave pública local | El middleware tiene una sola interfaz (`AccessTokenVerifier`); el par persistido evita perder la sesión en cada reinicio de `tsx watch` |

---

## 2. Variables de entorno y flags

Se leen una sola vez en `backend/src/shared/config.ts` (objeto `config` tipado y validado al arrancar; falla con mensaje claro si falta una variable obligatoria del modo elegido). `backend/.env` no se versiona.

| Variable | Default | Efecto |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_URL` | — (obligatoria) | Postgres |
| `CORS_ORIGINS` | `http://localhost:5173` | Orígenes permitidos separados por coma. Con cookies de refresh no puede ser `*`: se responde `Access-Control-Allow-Origin` con el origen y `Access-Control-Allow-Credentials: true` |
| `SERVICE_NAME` | `analytics` | Valor de `X-Service-Name` (CORE v1 §2). A confirmar contra el claim `service` del token |
| **Eventos** | | |
| `EVENTS_HTTP_INGEST` | `false` | `true` monta `POST /api/analytics/events` (envelope v1 en el body) y `GET /api/analytics/events` (listado de depuración). Apagado: ambas rutas dan `404` |
| `RABBITMQ_URL` | — | Si existe, arranca el consumer; si no, no hay consumer. Credencial de **sólo lectura** (Trello, «G5→G10 #18») |
| `RABBITMQ_QUEUE` | `analytics.all-events.v1` | Cola creada por CORE (no se declara desde código, CORE v1 §10) |
| `RABBITMQ_PREFETCH` | `20` | Mensajes sin ack en vuelo (CORE v1 §10: 10–50) |
| `RABBITMQ_MAX_ATTEMPTS` | `3` | Intentos por error transitorio antes de mandar a la DLQ |
| `INBOX_STORE_UNKNOWN` | `false` | Guardar también los `eventType` fuera del catálogo (`result='UNKNOWN_TYPE'`) |
| **Mocks por servicio** | | |
| `CORE_MOCK` | `true` | `true`: login, verificación de JWT y `wallets/aggregates` salen de `mocks/core/`. `false`: HTTP real contra CORE |
| `BACKOFFICE_MOCK` | `true` | `true`: sedes y fichas de usuario de `mocks/backoffice/` |
| `ACADEMIC_MOCK` | `true` | `true`: períodos, sedes, catálogo y cursos de `mocks/academic/` |
| `MOCKS_DIR` | `./mocks` | Raíz de los mocks (relativa a `backend/`) |
| **CORE real** (con `CORE_MOCK=false`) | | |
| `CORE_BASE_URL` | — (obligatoria) | `https://core-api-production-e458.up.railway.app` (Novedades 04/11, p. 2) |
| `CORE_CLIENT_ID` | `analytics-service` | `clientId` del token de servicio |
| `CORE_CLIENT_SECRET` | — (obligatoria) | Secreto entregado por CORE. Sólo en entorno, nunca en Git |
| `CORE_JWT_ISSUER` | — (obligatoria) | `iss` esperado: la URL de la API en Railway (Novedades 04/11, p. 2). Sin valor por defecto |
| `CORE_JWT_AUDIENCE` | `uadenet` | `aud` esperado |
| `CORE_JWKS_URL` | `${CORE_BASE_URL}/.well-known/jwks.json` | Claves públicas RS256 |
| **Backoffice / Académica reales** | | |
| `BACKOFFICE_BASE_URL` | — (obligatoria con `BACKOFFICE_MOCK=false`) | Base del backend de G8 (ruta directa, sin gateway) |
| `ACADEMIC_BASE_URL` | — (obligatoria con `ACADEMIC_MOCK=false`) | Base del backend de G9 |
| `GATEWAY_MAX_CONCURRENCY` | `4` | Llamadas simultáneas por servicio (cuida el rate limit de CORE de 100/min por IP) |
| `GATEWAY_TIMEOUT_MS` | `10000` | Timeout por llamada (igual al del gateway de CORE) |
| **Caché (sólo impl. HTTP; el mock nunca cachea)** | | |
| `CACHE_TTL_SECONDS_STATIC` | `3600` | Sedes, períodos, catálogo académico |
| `CACHE_TTL_SECONDS_USERS` | `600` | Nombre de usuario (se invalida con `backoffice.user.*`) |
| `CACHE_TTL_SECONDS_COURSES` | `300` | Cursos del período en curso (los de períodos cerrados usan el estático) |
| `CACHE_TTL_SECONDS_AGGREGATES` | `300` | `aggregates` del mes en curso (los meses cerrados usan 86400, fijo) |
| **Snapshots y tablero** | | |
| `WALLET_SNAPSHOT_ENABLED` | `true` | Job de snapshots de `outstandingBalance` |
| `WALLET_SNAPSHOT_INTERVAL_MIN` | `360` | Frecuencia del job |
| `WALLET_SNAPSHOT_BACKFILL_MONTHS` | `0` | Meses anteriores a reconstruir al arrancar. **Sólo activar con mock o cuando CORE confirme que `to` fija la fecha del saldo** (pregunta 8) |
| `DASHBOARD_FIRST_MONTH` | `2026-03` | Primer mes del filtro de períodos (inicio de 2026-1C) |
| `DINING_REVENUE_NET_OF_ATTENDANCE` | `false` | `true`: la facturación del comedor descuenta también lo restituido por asistencia (pregunta 25) |
| `AUTH_COOKIE_SAMESITE` | `lax` | `none` sólo si SPA y backend quedan en sitios distintos (exige HTTPS) |

### `.env.example` propuesto (`backend/.env.example`, modo demo)

```dotenv
PORT=3000
DATABASE_URL="postgresql://analitica:analitica@localhost:5432/analitica"
CORS_ORIGINS=http://localhost:5173

# Eventos: Postman simula la cola.
EVENTS_HTTP_INGEST=true
# RABBITMQ_URL=amqps://analytics-reader:CAMBIAR@host:5671/uadenet
RABBITMQ_QUEUE=analytics.all-events.v1
RABBITMQ_PREFETCH=20
RABBITMQ_MAX_ATTEMPTS=3
INBOX_STORE_UNKNOWN=false

# Mocks por servicio (true = backend/mocks/<servicio>/*.json).
CORE_MOCK=true
BACKOFFICE_MOCK=true
ACADEMIC_MOCK=true
MOCKS_DIR=./mocks

# CORE real (sólo con CORE_MOCK=false). El secreto va en el entorno, no en Git.
CORE_BASE_URL=https://core-api-production-e458.up.railway.app
CORE_CLIENT_ID=analytics-service
CORE_CLIENT_SECRET=
CORE_JWT_ISSUER=https://core-api-production-e458.up.railway.app
CORE_JWT_AUDIENCE=uadenet

# Backoffice y Gestión Académica reales (sólo con *_MOCK=false).
BACKOFFICE_BASE_URL=
ACADEMIC_BASE_URL=

# Snapshots y tablero.
WALLET_SNAPSHOT_ENABLED=true
WALLET_SNAPSHOT_BACKFILL_MONTHS=6
DASHBOARD_FIRST_MONTH=2026-03
DINING_REVENUE_NET_OF_ATTENDANCE=false
```

`WALLET_SNAPSHOT_BACKFILL_MONTHS=6` es sólo para demo con mocks. `CORE_JWT_ISSUER` se deja con la URL de Railway porque es lo que dicen las Novedades; confirmar contra un JWT real.

---

## 3. Catálogo de eventos que consume Analítica

### 3.1 Envelope (CORE v1, §9)

Es el único formato de entrada, por cola o por el POST mock.

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `specVersion` | string | sí | `"1.0"` |
| `eventId` | uuid | sí | Clave de idempotencia (PK del inbox) |
| `eventType` | string | sí | `{source}.{entidad}.{acción}.v{n}`; el prefijo debe coincidir con `source` |
| `source` | string | sí | Uno de `student, teacher, library, dining, store, events, academic, backoffice, core` |
| `occurredAt` | datetime | sí | ISO 8601 UTC con `Z`. Cuándo pasó el hecho (no el envío) |
| `subject` | string | no | `tipo/id` |
| `correlationId` | uuid | no | Se loguea |
| `causationId` | uuid \| null | no | |
| `actor` | `{type, id}` | no | |
| `data` | objeto | sí | Se valida contra la entrada del catálogo |

Ejemplo (`academic.course-result.published.v1`, **propuesto**):

```json
{
  "specVersion": "1.0",
  "eventId": "7b1f6d20-3a54-4c0e-9d11-4e8a2f6c9b01",
  "eventType": "academic.course-result.published.v1",
  "source": "academic",
  "occurredAt": "2026-09-30T18:12:03.511Z",
  "subject": "course/42",
  "correlationId": "f501201b-00bc-4200-99e0-6883500854f1",
  "causationId": null,
  "actor": { "type": "service", "id": "academic-service" },
  "data": {
    "studentId": "ba310c57-a684-4dbf-a4a4-905fcfbefa08",
    "courseId": "42",
    "subjectId": "15",
    "periodId": "8",
    "siteId": "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90",
    "finalGrade": 8.0,
    "status": "APROBADO",
    "resultDate": "2026-09-30"
  }
}
```

**Mapeo `source` (CORE) → módulo de nuestro dominio**, para no tocar `SourceModule`, `dashboard.config.ts` ni el frontend: `student→portal-estudiante`, `teacher→portal-docente`, `library→biblioteca`, `dining→comedor`, `store→tienda`, `events→eventos`, `academic→gestion-academica`, `backoffice→backoffice`, `core→core`. Va en `domain/entities/event-source.entity.ts` (`SOURCE_BY_CORE`).

Reglas de tipos de campo (se agregan a `FieldType`): `uuid`, `datetime` (ISO 8601 UTC con `Z`), `money` (string decimal, `^\d+\.\d{2}$`, nunca número), `integer`; los `string` que son ids de Gestión Académica (numéricos en su sistema) viajan **como texto** (`"42"`). Fechas de negocio sin hora: `date` `AAAA-MM-DD`. Hora de los tableros: Argentina (`America/Argentina/Buenos_Aires`); `occurredAt` se guarda en UTC.

### 3.2 Eventos que se persisten

Leyenda de `data`: `campo*` = obligatorio para nosotros (lo necesita una métrica); sin `*` = opcional. Los campos que CORE lista y no usamos van como opcionales.

| `eventType` | Emisor | Estado | `data` | Alimenta | Fuente |
|---|---|---|---|---|---|
| `academic.course-result.published.v1` | G9 Gestión Académica | **Propuesto / pendiente de registrar en CORE** | `studentId*` uuid, `courseId*` string, `subjectId*` string, `periodId*` string, `siteId*` uuid (`backofficeSiteId`), `status*` `APROBADO\|DESAPROBADO`, `finalGrade` number 0–10, `resultDate` date | Tasa de aprobación (KPI, por materia, por facultad, por docente) | xlsx M7, hoja «Flujo de Datos», fila `academic.course-result.published.v1`. G9 hoy publica `academica.resultado.publicado` sin `eventId` ni sede (CONTEXTO §6.6): no sirve |
| `events.event.created.v1` | G6 Eventos | **CORE oficial** (CORE v1 §11). G6 lo declara con otro nombre (`evento.creado`) y "todavía no se emite" | `eventId*` uuid, `title` string, `locationId*` uuid, `startAt` datetime, `endAt*` datetime, `capacity*` integer, `price` money\|null, `currency`. **Propuesto (opcional):** `category` string | Frecuencia, ocupación de cupo, tipo de evento | CORE v1 §11; xlsx M6, hoja «Flujo de Datos», fila `evento.creado`; xlsx M7 fila `events.event.created.v1` |
| `events.registration.completed.v1` | G6 | CORE oficial. G6 declara `inscripcion.registrada` sin `amount` | `eventId*` uuid, `registrationId*` uuid, `userId*` uuid, `amount` money, `currency` | Inscriptos, presentismo | CORE v1 §11; xlsx M6 fila `inscripcion.registrada` |
| `events.attendance.recorded.v1` | G6 | CORE oficial. G6 declara `asistencia.confirmada`; sólo emite presentes | `eventId*` uuid, `userId*` uuid, `present*` boolean, `checkedAt` datetime | Concurrencia, presentismo | CORE v1 §11; xlsx M6 fila `asistencia.confirmada` |
| `backoffice.location.upserted.v1` | G8 Backoffice | CORE oficial | `locationId*` uuid, `siteId*` uuid, `name`, `capacity` integer, `status` `ACTIVE\|INACTIVE\|MAINTENANCE`. **Pedido de G8 (opcional):** `type` | Resolver la sede de un evento (`locationId → siteId`) | CORE v1 §11; xlsx M8 fila `backoffice.location.upserted.v1`; Trello, «G8→G10 · Confirmaciones…», 2026-11-05 |
| `dining.reservation.created.v1` | G4 Comedor | CORE oficial; G4 idéntico (xlsx M4) | `reservationId*` uuid, `userId` (**redact**), `siteId*` uuid, `slotAt` datetime, `amount*` money, `currency` | Facturación y tickets por sede | CORE v1 §11 y §12; xlsx M4 fila `dining.reservation.created.v1` |
| `dining.reservation.cancelled.v1` | G4 | CORE oficial | `reservationId*` uuid, `userId` (**redact**), `slotAt`, `cancelledAt` datetime | Descuenta la reserva | CORE v1 §11; xlsx M4 |
| `dining.attendance.recorded.v1` | G4 | CORE oficial | `reservationId*` uuid, `userId` (**redact**), `attendedAt` datetime | Sólo con `DINING_REVENUE_NET_OF_ATTENDANCE=true` | CORE v1 §11; xlsx M4 |
| `store.purchase.completed.v1` | G5 Tienda | CORE oficial para el envelope; **`items[]` sin especificar en v1** y pedido por nosotros (en revisión) | `purchaseId*` uuid, `userId` (**redact**), `total` money, `currency`, `siteId` uuid (opcional), `items*` lista de `{productId* uuid, productName* string (al momento de la compra), category string, quantity* integer, unitPrice money, subtotal* money}` | Productos más vendidos (unidades y facturación) | CORE v1 §11; Trello, «G5→G7 #26–#28», 2026-10-22; xlsx M7 fila `store.purchase.completed.v1` |

Notas:
- **`redact`**: `RecordEventUseCase` borra esos campos de `data` antes de insertar. En eventos de G6 y de resultados se conserva `userId`/`studentId` porque hace falta para contar personas distintas y quedarse con el último resultado.
- **Resultado vigente**: se republica el evento con `eventId` nuevo cuando se corrige la nota; la query toma el último por `(studentId, courseId)` según `occurredAt` (xlsx M7, fila `academic.course-result.published.v1`).
- **Idempotencia**: un `eventId` repetido no inserta ni pisa (sección 7). Mismo `eventId` con otro contenido: se ignora y se loguea `warn` (CORE ya lo rechaza al publicar).

### 3.3 Eventos recibidos que se descartan (con ack)

| `eventType` | Motivo |
|---|---|
| `backoffice.user.upserted.v1`, `backoffice.user.disabled.v1` | **Efecto lateral, no se guardan** (llevan mail y permisos): invalidan el nombre cacheado del `userId` en `BackofficeGateway`. Sólo exige `userId*` uuid. Ojo: el estado inicial vigente es `INVITED`, no `PENDING_ACTIVATION` (Novedades 04/11, pp. 5–6); no lo usamos |
| `core.wallet.transaction-posted.v1`, `…-reversed.v1`, `…-rejected.v1` | Los totales oficiales salen de `aggregates`; usarlos duplicaría. No traen sede. `rejected` ni siquiera se emite (Trello, «G8→G10 · Créditos de sueldos…», 2026-10-20) |
| `library.penalty.applied.v1` | Ningún campo de los tableros lo usa hoy (las multas ya están en el grupo `LIBRARY_FINE` de `aggregates`) |
| `teacher.exam-result.published.v1`, `teacher.attendance.recorded.v1` | Son por examen o por clase, no resultado final de curso; ningún tablero los usa |
| `academic.term-defined.v1` | `termId` es UUID y los períodos de G9 tienen id numérico: no se pueden cruzar. Los cuatrimestres salen de `GET …/periodos` |
| `academic.exam-scheduled.v1`, `backoffice.rate.changed.v1`, `events.reminder.requested.v1`, `core.notification.created.v1` | No son nuestros |
| Cualquier otro | Idem; con `INBOX_STORE_UNKNOWN=true` se guardan |

### 3.4 Forma en código

`backend/src/domain/entities/event-catalog.ts` reemplaza a `event-schemas.ts`:

```ts
export type EventHandling = "persist" | "side-effect" | "ignore";
export type EventOrigin = "core" | "declared" | "proposed";

export interface EventCatalogEntry {
  eventType: string;                 // con sufijo .v1
  source: CoreSource;                // "academic" | "events" | ...
  origin: EventOrigin;
  declaredBy?: string;               // "G6", "G9"...
  handling: EventHandling;
  redact?: readonly string[];        // campos de data que no se guardan
  feeds: string;                     // texto para EVENTOS.md
  fields: readonly FieldSpec[];      // data; FieldSpec gana `example?: unknown` para Postman
}
export function findCatalogEntry(eventType: string): EventCatalogEntry | undefined;
```

`EVENTOS.md` y la colección de Postman se generan de este archivo (`npm run docs`).

---

## 4. Endpoints REST que consume Analítica

Reglas comunes (CORE v1 §2, §4, §13; Trello, «G3→G10 · Endpoint de multa…», 2026-10-20): las consultas backend a backend van por `/internal/v1/...` con **token de servicio** (`Authorization: Bearer`), `X-Correlation-Id` (se propaga el del request o se genera uno), `X-Service-Name`. Errores `application/problem+json` con `{type, title, status, code, detail, instance, correlationId}`: se programa contra `code`. Un `401` renueva el token de servicio y reintenta una vez; en `GET`, `429/502/503/504` reintentan una vez respetando `Retry-After` (máx. 5 s). Un fallo final lanza `GatewayError {service, status, code, correlationId}`.

### 4.1 CORE (G10)

**a) Token de servicio** — `POST {CORE_BASE_URL}/internal/v1/service-auth/token` (CORE v1 §4; Trello, «G8→G10 · Permiso de lectura…», 2026-11-04). Sin auth.

```json
// request
{ "clientId": "analytics-service", "clientSecret": "***" }
// 200
{ "accessToken": "eyJhbGciOiJSUzI1NiIs...", "expiresIn": 900, "tokenType": "Bearer" }
```
Claims del token: `sub: "service:analytics"`, `service`, `clientId`, **`permissions[]`** (no `scopes`), `roles: []`, `iss`, `aud`, `iat`, `exp`, `jti`. Cada cliente recibe sólo los permisos habilitados. Caché en memoria hasta `exp − 60 s` (`service-token.provider.ts`).

**b) Agregados de wallet** — `GET /internal/v1/wallets/aggregates?groupBy=concept&from=YYYY-MM-DD&to=YYYY-MM-DD`. Permiso **`wallet:read:aggregates`** (hoy sólo `FINANCE_ADMIN` lo trae, Novedades 04/11, p. 4; **falta confirmar que `analytics-service` lo tenga**). Sin paginación. Se pide **un mes por llamada** (`from` = día 1, `to` = último día; para el mes en curso `to` = hoy). Fuente: CORE v1 §7; xlsx M7 fila `wallets/aggregates`. **Verificar contra el Swagger** (no lo pudimos leer).

```json
{
  "range": { "from": "2026-10-01", "to": "2026-10-31" },
  "currency": "ARS",
  "outstandingBalance": "8452300.00",
  "walletCount": 1834,
  "groups": [
    { "key": "TOP_UP",             "type": "CREDIT",   "count": 410, "total": "6120000.00" },
    { "key": "PAYROLL",            "type": "CREDIT",   "count": 210, "total": "10080000.00" },
    { "key": "SCHOLARSHIP",        "type": "CREDIT",   "count": 38,  "total": "950000.00" },
    { "key": "STORE_PURCHASE",     "type": "DEBIT",    "count": 942, "total": "1847500.00" },
    { "key": "DINING_RESERVATION", "type": "DEBIT",    "count": 1240,"total": "1860000.00" },
    { "key": "LIBRARY_FINE",       "type": "DEBIT",    "count": 55,  "total": "137500.00" },
    { "key": "EVENT_REGISTRATION", "type": "DEBIT",    "count": 210, "total": "378000.00" },
    { "key": "REFUND",             "type": "REVERSAL", "count": 640, "total": "960000.00" }
  ]
}
```
TTL: mes cerrado 24 h; mes en curso `CACHE_TTL_SECONDS_AGGREGATES`. **Snapshot: sí** (`outstandingBalance`, sección 7): el endpoint da una foto, no una serie. Sin identificadores de personas.

**c) Auth de usuario (proxy)** — nuestro `/api/auth/*` llama a CORE (CORE v1 §3; Novedades 04/11, p. 2):

| Nuestra ruta | Ruta de CORE | Notas |
|---|---|---|
| `POST /api/auth/login` | `POST /api/v1/auth/login` `{email, password}` → `200 {accessToken, expiresIn: 900, user: {id, email, roles, permissions, status}}` + cookie de refresh | Errores: `401 AUTH_INVALID_CREDENTIALS`, `403 AUTH_IDENTITY_SUSPENDED`, `429 RATE_LIMITED` |
| `POST /api/auth/refresh` | `POST /api/v1/auth/refresh` (cookie) → `{accessToken, expiresIn}` + cookie rotada | El refresh rota en cada uso: el frontend serializa las llamadas |
| `POST /api/auth/logout` | `POST /api/v1/auth/logout` → `204` | |
| `GET /api/auth/me` | (se resuelve de los claims del JWT) | |

Cookie: nuestro backend reescribe `Path=/api/v1/auth` → `Path=/api/auth` y conserva `HttpOnly`, `Secure` (en producción) y `Max-Age`; `SameSite` según `AUTH_COOKIE_SAMESITE`. No se reenvía ningún otro header de CORE. Respuesta que ve el frontend (cambia lo mínimo respecto de hoy):

```json
{
  "token": "<JWT>",
  "expiresAt": "2026-11-05T18:15:00.000Z",
  "user": {
    "id": "5d1e7c2a-8f43-4b9e-a6d0-2c7f9e1b3a58",
    "email": "direccion.academica@uade.edu.ar",
    "name": "Marta García",
    "roles": ["academica"],
    "coreRoles": ["ACADEMIC_ADMIN"],
    "permissions": ["wallet:read:self", "wallet:credit:self", "academic:manage"]
  }
}
```
`roles` sigue siendo nuestro `RoleId`. `name` sale de Backoffice (4.2.b); si no está disponible, la parte local del mail. Si CORE autentica pero ningún rol mapea → `403 ANALYTICS_FORBIDDEN` y se cierra la sesión en CORE.

**d) Verificación local del JWT** — `GET /.well-known/jwks.json`. Con `jose` (`createRemoteJWKSet` + `jwtVerify`): `RS256`, `issuer = CORE_JWT_ISSUER`, `audience = CORE_JWT_AUDIENCE`, `exp`. JWKS cacheado; sólo se refresca ante `kid` desconocido. Claims: `sub, sid, email, roles, permissions, careerIds, iss, aud, iat, exp, jti`. Los headers `X-User-*`, `X-Core-Timestamp`, `X-Core-Signature` del gateway son **dato auxiliar** (se loguea `X-Correlation-Id`); la autorización sale del JWT (Trello, «G5→G10 #6», 2026-10-20). No usamos `introspect` (los tableros son de sólo lectura): una baja tarda hasta 15 min en cortar el acceso directo.

**e) Eventos históricos (sólo para `backfill`)** — `GET /internal/v1/events?type=&source=&from=&to=&cursor=&limit=`; permiso `events:read` (Novedades 04/11, p. 7). **La forma de la respuesta no está documentada**: se asume `{ items: [envelope], nextCursor }` (convención de paginación, CORE v1 §2); validar con el Swagger.

### 4.2 Backoffice (G8)

Permiso requerido: **`backoffice:read`** en el token de `analytics-service`. G8 lo aprobó el 04/11; **CORE aún no confirmó que lo agregó** (Trello, «G8→G10 · Permiso de lectura…», 2026-11-04).

**a) Sedes** — `GET {BACKOFFICE_BASE_URL}/internal/v1/sites?status=&cursor=&limit=` (≤ 100). Misma respuesta que `/api/v1/backoffice/sites` (Trello, «G8→G7 · ¿Consumen eventos, pull o ambos?», 2026-10-27; xlsx M8 fila `GET /sites`). Se piden todas y se sigue `nextCursor`. TTL estático. En el filtro de sede entran las `ACTIVE`; las `INACTIVE` sólo resuelven nombres.

```json
{
  "items": [
    { "siteId": "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90", "code": "MONSERRAT", "name": "Sede Monserrat",
      "address": "Lima 775", "city": "CABA", "province": null, "country": "Argentina",
      "timezone": "America/Argentina/Buenos_Aires", "status": "ACTIVE", "updatedAt": "2026-09-10T13:00:00.000Z" }
  ],
  "nextCursor": null
}
```

**b) Ficha de usuario** — `GET /internal/v1/users/{userId}`. Sólo usamos `firstName` y `lastName` (nombre a mostrar del usuario logueado y de los docentes del ranking). **No se copia ni se persiste nada más**; en memoria queda `{userId → "Nombre Apellido"}`. TTL `CACHE_TTL_SECONDS_USERS`, invalidado por `backoffice.user.upserted/disabled`. `404` → se muestra `Docente <primeros 8 caracteres del id>`. Fuente: xlsx M8 fila `GET /users/{userId}`; Trello 2026-11-03 (cada `careers[]` suma `careerCode, careerName, planCode, planName`, aditivo: no nos afecta).

```json
{
  "userId": "5f0a8e21-4c7b-4d19-9a3e-61b2c8d7f034",
  "email": "agomez@uade.edu.ar", "firstName": "Ana", "lastName": "Gómez",
  "documentId": "30111222", "fileNumber": "1001234",
  "roles": ["TEACHER"], "status": "ACTIVE",
  "siteId": "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90",
  "careers": [{ "careerId": "1", "planId": "3", "careerCode": "ISI", "careerName": "Ingeniería en Sistemas de Información", "planCode": "ISI-2026", "planName": "Plan de Estudios 2026" }]
}
```
El mock sólo trae lo que usamos más `userId` y `roles` (no hace falta replicar datos sensibles).

### 4.3 Gestión Académica (G9)

Estado: G9 **no respondió** nada sobre Analítica (CONTEXTO §4.4). Hoy autoriza sólo a `backoffice-service`, los ids son numéricos (Long) y no hay paginación. **Sólo están confirmados** `/internal/v1/carreras`, `/internal/v1/carreras/con-ultimo-plan-activo` y `/internal/v1/carreras/{id}/planes` (Trello, «G8→G9 · Catálogo de carreras…», 2026-10-28). Todo lo demás es **propuesto**: hoy existe como `/api/planificacion/*` y `/api/academica/*` (xlsx M9) y pedimos el alias `/internal/v1/*` y el permiso/`clientId` `analytics-service`. Las rutas viven en un solo archivo, `academic.routes.ts` (`ACADEMIC_ROUTES`), para cambiarlas sin tocar el gateway.

| Recurso | Ruta usada (`ACADEMIC_ROUTES`) | Estado | Respuesta | TTL | Fuente |
|---|---|---|---|---|---|
| Períodos | `GET /internal/v1/periodos` | Propuesto (hoy `/api/planificacion/periodos`) | `[{id, anio, numero, fechaInicio, fechaFin}]` | estático | xlsx M9 fila `GET /periodos` |
| Sedes de G9 | `GET /internal/v1/sedes` | Propuesto; **`backofficeSiteId` no existe** (hoy `{id, nombre, direccion}`) | `[{id, backofficeSiteId, nombre}]` | estático | xlsx M7 fila `/planificacion/sedes` |
| Carreras | `GET /internal/v1/carreras` | **Confirmado** (sólo `backoffice-service`) | `[{id, codigo, nombre, facultad, duracion, titulo, estado}]` | estático | Trello 2026-10-28; xlsx M9 |
| Planes | `GET /internal/v1/carreras/{carreraId}/planes` | **Confirmado** | `[{id, codigo, nombre, vigenciaDesde, cantidadAsignaturas, estado, carreraId}]` (`estado` `ACTIVO\|PLANIFICADO`). Carrera inexistente: `404 RESOURCE_NOT_FOUND` | estático | Trello 2026-10-30 |
| Asignaturas | `GET /internal/v1/planes/{planId}/asignaturas` | Propuesto (hoy `/api/academica/planes/{planId}/asignaturas`) | `[{id, codigo, nombre, anio, creditos, cargaHoraria, estado, planId}]` | estático | xlsx M9 |
| Cursos del período | `GET /internal/v1/cursos?periodoId={id}` | **Propuesto: no figura en el xlsx de G9** | `[{id, codigo, asignaturaId, periodoId, sedeId, sedeNombre, estado, cupoMaximo, inscriptosActivos, docentes?}]`; `estado` `PLANIFICADO\|EN_CURSO\|FINALIZADO\|CANCELADO`; `docentes?: [{docenteId, rol}]` es un pedido opcional para evitar N consultas | período en curso `CACHE_TTL_SECONDS_COURSES`, cerrados estático | xlsx M7 fila `/cursos?periodoId=` |
| Curso con docentes | `GET /internal/v1/cursos/{cursoId}` | **Propuesto** | `{curso: {id, asignatura: {id, codigo, nombre}, periodo: {id, anio, numero}, sedeId, estado}, docentes: [{docenteId: uuid de Backoffice, rol: TITULAR\|ADJUNTO\|AUXILIAR}]}` | 30 min | xlsx M7 fila `/cursos/{cursoId}` |

Paginación: ninguna (G9 lo confirma sólo para carreras/planes). Snapshot: **no** por ahora; hay que confirmar que `/cursos` devuelve también los períodos cerrados (pregunta de G9 más abajo) o se agregaría un snapshot por período (objeción 2).

`AcademicCatalogService` (`application/services/academic-catalog.service.ts`) recorre carreras → planes → asignaturas **una vez por TTL** y arma `{asignaturaId → {codigo, nombre, facultad}}` más la lista de facultades; la materia se agrupa por `codigo` (varios planes repiten asignaturas con ids distintos). El período `AAAA-NC` sale de `anio` + `numero`.

```json
// GET /internal/v1/cursos?periodoId=8
[
  { "id": 42, "codigo": "DDA2-001", "asignaturaId": 15, "periodoId": 8, "sedeId": 1, "sedeNombre": "Sede Monserrat",
    "estado": "EN_CURSO", "cupoMaximo": 45, "inscriptosActivos": 30,
    "docentes": [{ "docenteId": "5f0a8e21-4c7b-4d19-9a3e-61b2c8d7f034", "rol": "TITULAR" }] }
]
```

### 4.4 Otros servicios

Ninguno. Tienda, Comedor, Eventos, Biblioteca y Portales sólo emiten eventos (Trello, «G5→G7 #30», 2026-10-22: sin endpoints de Tienda). Si G6 o G4 piden algo por REST, se agrega otro gateway con el mismo molde.

### 4.5 Rutas propias nuevas

Se montan además bajo `/api/v1` (el gateway reescribe `/api/v1/analytics/*` → `/api/v1/*`, CORE v1 §6) sin quitar `/api/analytics` ni `/api/auth`, que usa el frontend. Se agrega `GET /health/live` y `GET /health/ready` (`{status, checks: {db, broker: "up|down|disabled", core: "mock|http", backoffice: "mock|http", academic: "mock|http"}}`). Los errores pasan a `application/problem+json` (`{type, title, status, code, detail, instance, correlationId}`) **manteniendo** `error: detail` para no romper al frontend actual.

---

## 5. Layout de mocks

Cada servicio con su flag. Con el flag en `true`, la implementación mock lee el archivo **en cada llamada** (sin caché, sin watcher) y devuelve su contenido **tal cual** como body con `200`. La caché de TTL sólo envuelve a la implementación HTTP, así que editar un `.json` se ve en el próximo request.

```
backend/mocks/
├── README.md                          # 15 líneas: reglas de abajo
├── core/
│   ├── users.json                     # usuarios del login mock (roles de CORE)
│   └── wallets-aggregates/
│       ├── 2026-03.json … 2026-11.json   # una por mes (clave = YYYY-MM de `from`)
│       └── _empty.json                # opcional: respuesta para meses sin archivo
├── backoffice/
│   ├── sites.json                     # GET /internal/v1/sites  (lista completa)
│   └── users/<userId>.json            # GET /internal/v1/users/{userId}
└── academic/
    ├── periodos.json                  # GET /periodos
    ├── sedes.json                     # GET /sedes
    ├── carreras.json                  # GET /carreras
    ├── planes/<carreraId>.json        # GET /carreras/{carreraId}/planes
    ├── asignaturas/<planId>.json      # GET /planes/{planId}/asignaturas
    ├── cursos/<periodoId>.json        # GET /cursos?periodoId=
    └── curso-detalle/<cursoId>.json   # GET /cursos/{cursoId}
```

### 5.1 Cómo se resuelven los parámetros

| Endpoint simulado | Archivo | Si el archivo no existe |
|---|---|---|
| `wallets/aggregates?from=2026-10-01&to=…` | `core/wallets-aggregates/2026-10.json` (`from.slice(0,7)`; el archivo se devuelve verbatim, aunque `to` sea parcial) | `_empty.json` si existe; si no, `{range:{from,to}, currency:"ARS", outstandingBalance:"0.00", walletCount:0, groups:[]}` |
| `sites` (con o sin `status`/`cursor`) | `backoffice/sites.json`, siempre completo y con `nextCursor: null` (se ignoran los query) | `500` de configuración con mensaje claro |
| `users/{userId}` | `backoffice/users/<userId>.json` | `404 problem+json` `code: "RESOURCE_NOT_FOUND"` (como el real) |
| `periodos`, `sedes`, `carreras` | archivo único | error de configuración |
| `carreras/{id}/planes` | `academic/planes/<id>.json` | `404 RESOURCE_NOT_FOUND` (como confirma G9) |
| `planes/{id}/asignaturas` | `academic/asignaturas/<id>.json` | `[]` |
| `cursos?periodoId=8` | `academic/cursos/8.json` | `[]` (período sin cursos) |
| `cursos/{id}` | `academic/curso-detalle/<id>.json` | `404 RESOURCE_NOT_FOUND` |

Para simular fallas, un archivo puede ser `{ "__mockStatus": 503, "__mockBody": { ...problem+json... } }`: el mock responde ese status y body (prueba de `warnings[]`). Un JSON mal formado da `500` con la ruta del archivo en el mensaje. Las claves de archivo sólo aceptan `[A-Za-z0-9_-]` (sin `..`).

### 5.2 Ejemplos

`core/users.json` (login mock; mismo `user` que devuelve `POST /api/v1/auth/login`; las contraseñas de este archivo son de demo, **no** se copian credenciales reales de CORE):

```json
[
  { "id": "5d1e7c2a-8f43-4b9e-a6d0-2c7f9e1b3a58", "email": "direccion.academica@uade.edu.ar", "password": "uadenet2026",
    "roles": ["ACADEMIC_ADMIN"], "permissions": ["wallet:read:self", "wallet:credit:self", "academic:manage"],
    "careerIds": [], "status": "ACTIVE" },
  { "id": "9c3e5b71-2d84-4a60-b1f7-0e6a4c8d2f15", "email": "direccion.financiera@uade.edu.ar", "password": "uadenet2026",
    "roles": ["FINANCE_ADMIN"],
    "permissions": ["wallet:read:self", "wallet:credit:self", "wallet:read:any", "wallet:read:aggregates", "wallet:credit:any", "wallet:admin", "backoffice:read", "backoffice:payroll:approve"],
    "careerIds": [], "status": "ACTIVE" },
  { "id": "1a7d4f90-6b23-4c58-8e01-3f9b2a5c7d64", "email": "administrativo.backoffice@uade.edu.ar", "password": "uadenet2026",
    "roles": ["ADMIN"], "permissions": ["wallet:read:self", "wallet:credit:self", "backoffice:manage", "backoffice:read"],
    "careerIds": [], "status": "ACTIVE" },
  { "id": "ba310c57-a684-4dbf-a4a4-905fcfbefa08", "email": "alumno.demo@uade.edu.ar", "password": "uadenet2026",
    "roles": ["STUDENT"], "permissions": ["wallet:read:self", "wallet:credit:self"], "careerIds": ["1"], "status": "ACTIVE" }
]
```
El último usuario sirve para probar el `403 ANALYTICS_FORBIDDEN`. `status: "SUSPENDED"` simula `403 AUTH_IDENTITY_SUSPENDED`. El mock firma el JWT con `iss = "mock-core"`, `aud = "uadenet"`, 15 min, `sub`, `email`, `roles`, `permissions`, `careerIds`, `sid`, `jti`, y fija la cookie de refresh (`HttpOnly`, `Path=/api/auth`) con un id opaco que `refresh` y `logout` reconocen en memoria. El token de servicio del mock es un string fijo sin llamada.

`backoffice/sites.json`: el ejemplo de 4.2.a con dos sedes (`Sede Monserrat`, `Sede Pilar`).

`backoffice/users/5f0a8e21-4c7b-4d19-9a3e-61b2c8d7f034.json`:
```json
{ "userId": "5f0a8e21-4c7b-4d19-9a3e-61b2c8d7f034", "firstName": "Ana", "lastName": "Gómez", "roles": ["TEACHER"], "status": "ACTIVE", "siteId": "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90" }
```

`academic/periodos.json`:
```json
[
  { "id": 6, "anio": 2025, "numero": 2, "fechaInicio": "2025-08-04", "fechaFin": "2025-12-13" },
  { "id": 7, "anio": 2026, "numero": 1, "fechaInicio": "2026-03-09", "fechaFin": "2026-07-11" },
  { "id": 8, "anio": 2026, "numero": 2, "fechaInicio": "2026-08-10", "fechaFin": "2026-12-12" }
]
```

`academic/sedes.json`:
```json
[ { "id": 1, "backofficeSiteId": "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90", "nombre": "Sede Monserrat" },
  { "id": 2, "backofficeSiteId": "7a41c2d8-0b6e-4f53-8d19-5e2a9c0f1b37", "nombre": "Sede Pilar" } ]
```

`academic/curso-detalle/42.json`: el ejemplo de 4.3 (`{curso, docentes}`).

### 5.3 Coherencia entre mocks y eventos de demo

Los ids compartidos (`siteId`, `locationId`, `courseId`, `subjectId`, `periodId`, `studentId`, `teacherId`, `productId`) se definen una vez en `backend/demo/ids.ts`. Los usan el seed de eventos (`prisma/demo-seed.ts`), el generador inicial de mocks (`scripts/generate-demo-mocks.ts`, no pisa archivos existentes salvo `--force`, para no perder ediciones a mano) y el verificador `npm run mocks:check`, que falla si un `siteId`, `courseId`, `subjectId` o `periodId` de los eventos de demo no existe en los mocks, o si un `userId` de curso-detalle no tiene ficha.

---

## 6. Mapeo métrica → fuente

Estado: **completa** = la fuente existe y está confirmada; **parcial** = hay fuente con una limitación o una ruta/evento aún no confirmado; **sin fuente** = nadie provee el dato (no se inventa).

Contrato HTTP hacia el frontend: se mantienen los `*-stats.entity.ts`. Cambios aditivos: `warnings?: {source, message}[]` en los tres tableros, `KpiCard.note?: string`, `FinancialStats.siteScopeNote: string | null` y `MonthlyBalancePoint.balance: number | null` (`formattedBalance: "—"`).

### 6.1 Tablero académico (`GET /api/analytics/dashboard/academic`)

| Métrica / campo | Fuente nueva | Cálculo | Estado | Si falta |
|---|---|---|---|---|
| KPI **Materias en curso** | G9 `cursos?periodoId` + catálogo de asignaturas | Materias distintas (por `codigo`) con `estado ∈ {EN_CURSO, FINALIZADO}` en el período y la sede (curso `sedeId` → `backofficeSiteId` por `sedes`) y la facultad. Delta contra el período anterior (mismo cálculo) | **Parcial**: ruta `/cursos` propuesta; depende de que G9 devuelva períodos cerrados | `value: 0`, `—` y `warnings` |
| KPI **Tasa de aprobación general** | `academic.course-result.published.v1` | Último resultado por `(studentId, courseId)`; `aprobados / total` del período y sede; facultad vía `subjectId` | **Parcial**: evento propuesto, nadie lo emite | `0` y sin datos; **pedir a G9 el evento** (o alternativa pull, objeción 3) |
| KPI **Comisiones activas** | G9 `cursos` | Cantidad de cursos con los estados de arriba (sede y facultad aplicadas) | **Parcial** (igual que Materias) | Idem |
| KPI **Estudiantes con cursada activa** | G9 `cursos.inscriptosActivos` | Σ `inscriptosActivos`. **Cuenta inscripciones, no alumnos distintos**: `note: "Cuenta inscripciones activas, no alumnos distintos"` | **Parcial** (no hay emisor de `inscripcion.*`: G1 sin xlsx) | Pedir a G1/G9 un conteo de alumnos distintos |
| **Aprobación por materia** (`subjectApprovalRates`, serie de 3 cuatrimestres, delta pp) | Resultados + catálogo de asignaturas (`codigo`, `nombre`) + `periodos` | Por `periodId`→`AAAA-NC`, agrupado por `codigo` de asignatura | **Parcial** | Si la asignatura no está en el catálogo: código = `subjectId`, nombre `Asignatura {id}` |
| **Tendencia por facultad** (6 cuatrimestres) | Resultados + facultad de la carrera de la asignatura | Agrupado por `facultad`; asignaturas sin carrera no se atribuyen | **Parcial** | Pedir a G9 `facultad` en `/asignaturas` o en `/cursos` (evita recorrer carreras → planes) |
| **Aprobación por docente** (`teacherApprovalRates`, `totalTeachersCount`) | Resultados + docentes del curso (G9) + nombre (Backoffice `users`) | `courseId` → docente(s) con rol `TITULAR` (si no hay titular, todos); materia del docente = la de más resultados. `totalTeachersCount` cuenta **docentes con resultados**, no docentes con cursos sin resultados | **Parcial** | Pedir a G9 `docentes[]` en `/cursos` |
| `quarter`, `previousQuarter`, `comparedQuarters` | G9 `periodos` | Etiqueta `anio-numeroC` | **Parcial** (ruta propuesta) | — |
| `sourceModules`, `lastIngestionAt` | `source_ingestions` | Último evento recibido de los feeders del tablero | Completa | — |
| Filtro **sede** | Backoffice `sites` | `siteId` UUID + `todas-las-sedes` | Parcial (necesita `backoffice:read`) | Lista con sólo "Todas las sedes" y `warnings` |
| Filtro **cuatrimestre** | G9 `periodos` | Los que ya empezaron; default = el más reciente | Parcial | Idem |
| Filtro **facultad** | G9 `carreras` | `facultad` distintas (id = nombre, como hoy) | Parcial (ruta confirmada, falta permiso) | Lista vacía |

Query de resultados (base de las filas por materia, docente y facultad; se agrega en Node):

```sql
WITH last_result AS (
  SELECT DISTINCT ON (data->>'studentId', data->>'courseId')
    data->>'periodId' AS period_id, data->>'subjectId' AS subject_id,
    data->>'courseId' AS course_id,
    (data->>'status') = 'APROBADO' AS approved
  FROM inbox_events
  WHERE event_type = 'academic.course-result.published.v1'
    AND data->>'periodId' = ANY (${periodIds})
    ${siteId ? Prisma.sql`AND data->>'siteId' = ${siteId}` : Prisma.empty}
  ORDER BY data->>'studentId', data->>'courseId', occurred_at DESC, received_at DESC
)
SELECT period_id, subject_id, course_id,
       COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE approved))::int AS approved
FROM last_result GROUP BY period_id, subject_id, course_id;
```

### 6.2 Tablero financiero (`GET /api/analytics/dashboard/financial`)

Definiciones (en `dashboard.config.ts`, un cambio de una línea; **a validar con el equipo y la cátedra**, pregunta 31): sea `groups` el resultado de `aggregates` de un mes.
- **Ingresos** = Σ `total` de los grupos `DEBIT` con `key ∈ {STORE_PURCHASE, DINING_RESERVATION, LIBRARY_FINE, EVENT_REGISTRATION}` menos Σ `REVERSAL` (`REFUND`, mínimo 0). Es lo que la universidad cobra por sus servicios, neto de devoluciones.
- **Egresos** = Σ `total` de los grupos `CREDIT` con `key ∈ {PAYROLL, SCHOLARSHIP}`.
- **Resultado operativo** = ingresos − egresos; margen = resultado / ingresos (0 sin ingresos). `TOP_UP` y `ADJUSTMENT` no entran (el primero es saldo cargado, no ingreso; el segundo no tiene sentido fijo).
- **Saldo acumulado** = `outstandingBalance` del snapshot del mes.

| Métrica / campo | Fuente nueva | Cálculo | Estado | Si falta |
|---|---|---|---|---|
| KPI **Saldo acumulado** + serie `balance` | `wallet_balance_snapshots` (job sobre `aggregates`) | Snapshot del mes (el del mes en curso se actualiza cada `WALLET_SNAPSHOT_INTERVAL_MIN`); delta contra el mes anterior | **Parcial**: sólo hay historia desde que corre el job; sin sede | Mes sin snapshot: `balance: null`, `formattedBalance: "—"` (el mes en curso cae a una consulta en vivo) |
| KPI **Ingresos / Egresos / Resultado** + barras mensuales (6 meses) | CORE `aggregates` (un llamado por mes de la ventana) | Fórmulas de arriba | **Completa** en dato; definición pendiente; **sin filtro de sede** | Falla de CORE: `0`, `—`, `warnings` |
| **Gastos administrativos** (`administrativeExpenses`) | `aggregates` grupos `PAYROLL` y `SCHOLARSHIP` | Categorías `Sueldos` y `Becas y bonificaciones` con su % sobre la suma; sólo las de total > 0 (se reemplaza la lista fija de 7 categorías de `EXPENSE_CATEGORIES` por `EXPENSE_CONCEPTS = {PAYROLL, SCHOLARSHIP}` con colores) | **Parcial** | **Sin fuente**: separar sueldos docentes y administrativos, y mantenimiento, servicios, licencias (ningún módulo los produce; Trello, «G8→G7 · "Gastos administrativos incl. salarios"…», 2026-10-22). Pedir a G10 un `groupBy` por rol si se quiere el desglose |
| **Productos más vendidos** (por unidades y por facturación) | `store.purchase.completed.v1` | `jsonb_array_elements(data->'items')`, agrupado por `productId` (nombre de la última compra), mes del `occurredAt`; con sede elegida sólo cuentan compras que traen ese `siteId` | **Completa** si G5 confirma `items[]`; sede **parcial** (opcional) | Sin evento: listas vacías. Sin devoluciones (no hay evento): se quita `compra.devuelta` |
| **Comedores por sede** (facturación, tickets, ticket promedio, delta) | `dining.reservation.created/cancelled/attendance.recorded` + Backoffice `sites` | Una fila por sede de Backoffice. Reservas creadas del mes sin `cancelled` (cruce por `reservationId`, sin límite de fecha); con `DINING_REVENUE_NET_OF_ATTENDANCE=true` también sin `attendance`. `hasService` = la sede tiene alguna reserva | **Completa** (definición de "facturación" pendiente) | Sede sin reservas: `hasService: false`, nota actual |
| Filtro **sede** | Backoffice `sites` | Resalta comedores y filtra productos; **no** filtra saldo, ingresos, egresos ni gastos: `siteScopeNote: "Saldo, ingresos, egresos y sueldos son institucionales: CORE no los distingue por sede."` | Parcial | Pedir a G10 `siteId` en wallet (pregunta 7) |
| Filtro **mes** | `DASHBOARD_FIRST_MONTH` hasta el mes actual | Lista continua | Completa | — |
| `sourceModules`, `lastIngestionAt` | `source_ingestions` | Feeders: `core`, `tienda`, `comedor`, `backoffice` | Completa | — |

```sql
-- Facturación de comedor por sede y mes (neta de cancelaciones)
WITH res AS (
  SELECT DISTINCT ON (data->>'reservationId')
    data->>'reservationId' AS reservation_id, data->>'siteId' AS site_id,
    (data->>'amount')::numeric AS amount, occurred_at
  FROM inbox_events
  WHERE event_type = 'dining.reservation.created.v1'
    AND occurred_at >= ${from}::timestamptz AND occurred_at < ${to}::timestamptz
  ORDER BY data->>'reservationId', occurred_at
)
SELECT r.site_id, to_char(r.occurred_at AT TIME ZONE ${ARGENTINA_TZ}, 'YYYY-MM') AS ym,
       COALESCE(SUM(r.amount), 0)::float8 AS revenue, COUNT(*)::int AS tickets
FROM res r
WHERE NOT EXISTS (SELECT 1 FROM inbox_events c
                  WHERE c.event_type = 'dining.reservation.cancelled.v1'
                    AND c.data->>'reservationId' = r.reservation_id)
GROUP BY r.site_id, ym;
```

### 6.3 Estadísticas de eventos (`GET /api/analytics/events/stats`)

| Métrica / campo | Fuente nueva | Cálculo | Estado | Si falta |
|---|---|---|---|---|
| **Eventos realizados** (`totalEvents`, frecuencia mensual) | `events.event.created.v1` + `backoffice.location.upserted.v1` | Último evento por `eventId`, con `endAt` en el mes (hora Argentina) y `endAt < now()`; sede por `locationId → siteId` (último `location.upserted`) | **Parcial**: G6 aún no emite; sin el `location.upserted` histórico el evento no tiene sede y sólo cuenta en "Todas las sedes" | Correr el `backfill` de `location.upserted` (fase B) |
| **Concurrencia total / por evento** (`totalAttendees`) | `events.attendance.recorded.v1` | `userId` distintos con `present = true` por `eventId` | Parcial (G6 sólo emite presentes) | — |
| **Inscriptos** (`totalRegistered`) | `events.registration.completed.v1` | `registrationId` distintos por `eventId` (sin cancelación: fuera del alcance de G6) | Parcial | — |
| **Presentismo promedio** | Asistencia / inscriptos | Por evento y promedio | Parcial | Sin inscriptos: 0 |
| **Ocupación de cupo** | `capacity` del evento | `presentes / capacity` | Parcial | — |
| **Presentismo por tipo, mejor y peor** (`eventTypes`, `bestAttendance`, `worstAttendance`) | `data.category` (propuesto) | Tipo = `category`; mientras no exista, **clase de precio derivada** de `price`: `Pago` (`price > 0`) o `Gratuito` | **Sin fuente de tipo**: lo mostrado es una aproximación declarada | Pedir a G6 `category` opcional en `events.event.created.v1` (pregunta 21) |
| `monthlySeries` (6 meses) | Idem | Mismo cálculo por mes | Parcial | — |

```sql
-- Eventos realizados con sede resuelta
WITH loc AS (
  SELECT DISTINCT ON (data->>'locationId') data->>'locationId' AS location_id, data->>'siteId' AS site_id
  FROM inbox_events WHERE event_type = 'backoffice.location.upserted.v1'
  ORDER BY data->>'locationId', occurred_at DESC
), held AS (
  SELECT DISTINCT ON (e.data->>'eventId')
    e.data->>'eventId' AS event_id, (e.data->>'endAt')::timestamptz AS end_at,
    COALESCE((e.data->>'capacity')::int, 0) AS capacity,
    COALESCE(NULLIF(e.data->>'category', ''),
             CASE WHEN COALESCE((e.data->>'price')::numeric, 0) > 0 THEN 'Pago' ELSE 'Gratuito' END) AS event_type,
    l.site_id
  FROM inbox_events e LEFT JOIN loc l ON l.location_id = e.data->>'locationId'
  WHERE e.event_type = 'events.event.created.v1'
  ORDER BY e.data->>'eventId', e.occurred_at DESC
)
SELECT * FROM held WHERE end_at >= ${from}::timestamptz AND end_at < LEAST(${to}::timestamptz, now())
  ${siteId ? Prisma.sql`AND site_id = ${siteId}` : Prisma.empty};
```
Inscriptos y presentes se obtienen por `eventId` con subconsultas `COUNT(DISTINCT …)` como hoy.

### 6.4 Otros endpoints

| Endpoint | Fuente nueva |
|---|---|
| `GET /api/analytics/filters` | Sedes (Backoffice), cuatrimestres y facultades (G9), meses (`DASHBOARD_FIRST_MONTH`). Los ids de sede pasan de slug a **UUID** (el frontend resuelve contra `/filters` el valor guardado) |
| `GET /api/analytics/sources` | `source_ingestions`: un renglón por módulo, con `lastIngestionAt` (último recibido) aunque el evento se haya descartado |
| `GET /api/analytics/roles` | Sin cambios (`ROLES` se corrige: `academica` ve `academic` y `events`; `financiera` ve `financial`, CONTEXTO §9 punto 30) |

---

## 7. Cambios en la base

Los datos actuales son demo: **se borran**. La migración recrea `inbox_events`.

### 7.1 `backend/prisma/schema.prisma`

```prisma
// Bandeja de entrada: envelope v1 de CORE tal cual llegó. event_id es la clave de idempotencia (CORE v1 §10).
model InboxEvent {
  eventId       String   @id @map("event_id") @db.Uuid
  specVersion   String   @map("spec_version")
  eventType     String   @map("event_type")
  source        String
  occurredAt    DateTime @map("occurred_at") @db.Timestamptz(3)
  subject       String?
  correlationId String?  @map("correlation_id") @db.Uuid
  causationId   String?  @map("causation_id") @db.Uuid
  actor         Json?
  data          Json
  // OK | UNKNOWN_TYPE (sólo con INBOX_STORE_UNKNOWN)
  result        String   @default("OK")
  receivedAt    DateTime @default(now()) @map("received_at") @db.Timestamptz(3)

  @@index([eventType, occurredAt])
  @@index([source, receivedAt])
  @@map("inbox_events")
}

// Un renglón por módulo emisor: alimenta "Fuentes de datos" y el pie de cada tablero, incluso con eventos descartados.
model SourceIngestion {
  source         String    @id
  lastEventAt    DateTime? @map("last_event_at") @db.Timestamptz(3)
  lastReceivedAt DateTime  @map("last_received_at") @db.Timestamptz(3)
  storedCount    Int       @default(0) @map("stored_count")
  ignoredCount   Int       @default(0) @map("ignored_count")

  @@map("source_ingestions")
}

// Foto mensual del saldo vigente de CORE: es lo único que el dueño no puede reconstruir hacia atrás.
model WalletBalanceSnapshot {
  month              String   @id // AAAA-MM
  currency           String   @default("ARS")
  outstandingBalance Decimal  @map("outstanding_balance") @db.Decimal(18, 2)
  walletCount        Int      @map("wallet_count")
  capturedAt         DateTime @map("captured_at") @db.Timestamptz(3)
  // true: tomada con el mes ya cerrado (no se vuelve a pisar).
  isFinal            Boolean  @default(false) @map("is_final")

  @@map("wallet_balance_snapshots")
}
```

`occurred_at` pasa de `timestamp` a `timestamptz`: `argentinaMonth()` en `query-helpers.ts` queda `to_char(occurred_at AT TIME ZONE ${ARGENTINA_TZ}, 'YYYY-MM')` y los parámetros de rango se castean `::timestamptz`.

### 7.2 Migración

`backend/prisma/migrations/<timestamp>_inbox_v1/migration.sql` (la crea `npm run db:migrate -- --name inbox_v1` y se le agrega a mano la parte de índices de expresión, que Prisma no modela, como en `20261104224705_payload_indexes`):

```sql
-- Datos de demo: se descartan. No hay datos reales que migrar.
DROP TABLE IF EXISTS "inbox_events";
-- (CREATE TABLE inbox_events, source_ingestions y wallet_balance_snapshots: lo genera Prisma)

-- Índices de expresión sobre data. Sólo los que usan las queries de la sección 6.
-- Resultado vigente por (alumno, curso) y filtro por período.
CREATE INDEX "inbox_results_idx" ON "inbox_events"
  (("data"->>'studentId'), ("data"->>'courseId'), "occurred_at" DESC)
  WHERE "event_type" = 'academic.course-result.published.v1';
CREATE INDEX "inbox_results_period_idx" ON "inbox_events"
  (("data"->>'periodId'), ("data"->>'siteId'))
  WHERE "event_type" = 'academic.course-result.published.v1';
-- Eventos: unir creación, inscripciones y asistencias por eventId.
CREATE INDEX "inbox_events_event_id_idx" ON "inbox_events"
  ("event_type", ("data"->>'eventId'))
  WHERE "event_type" IN ('events.event.created.v1', 'events.registration.completed.v1', 'events.attendance.recorded.v1');
-- locationId → siteId.
CREATE INDEX "inbox_location_idx" ON "inbox_events" (("data"->>'locationId'), "occurred_at" DESC)
  WHERE "event_type" = 'backoffice.location.upserted.v1';
-- Comedor: cruzar cancelaciones y asistencias con la reserva.
CREATE INDEX "inbox_dining_idx" ON "inbox_events" ("event_type", ("data"->>'reservationId'))
  WHERE "event_type" LIKE 'dining.%';
```

Al ser índices parciales, Postgres sólo los usa si el `WHERE` de la query repite el `event_type` literal: las queries lo hacen. Tienda no necesita índice de expresión (alcanza `(event_type, occurred_at)`).

### 7.3 Inserción idempotente

Una sola sentencia, sin transacción explícita (el efecto es la propia fila):

```sql
INSERT INTO inbox_events (event_id, spec_version, event_type, source, occurred_at, subject,
                          correlation_id, causation_id, actor, data, result)
VALUES (...) ON CONFLICT (event_id) DO NOTHING;   -- 0 filas = duplicado → ack sin repetir efecto
```
Después `INSERT INTO source_ingestions ... ON CONFLICT (source) DO UPDATE SET last_received_at = now(), last_event_at = GREATEST(...), stored_count = stored_count + 1` (o `ignored_count` si se descartó). Los duplicados no cuentan.

### 7.4 Job de snapshots (`infrastructure/jobs/wallet-snapshot.job.ts`)

Al arrancar y cada `WALLET_SNAPSHOT_INTERVAL_MIN` (`setInterval`, sin dependencia nueva; es idempotente, varias instancias no rompen nada): (1) pide `aggregates` del mes en curso (`from` = día 1, `to` = hoy) y hace `upsert` del snapshot del mes con `isFinal=false`; (2) si el mes anterior no tiene snapshot `isFinal=true`, pide su rango completo y lo guarda `isFinal=true`; (3) con `WALLET_SNAPSHOT_BACKFILL_MONTHS=N` repite (2) para los N meses anteriores sin snapshot. Un mes ya cerrado y sin snapshot **no se puede reconstruir** si `aggregates` devuelve el saldo "a hoy": por eso la advertencia en la variable y la pregunta 8.

---

## 8. Plan de implementación por fases

Cada fase deja el sistema arrancando. Dependencias nuevas del backend: `amqplib` + `@types/amqplib` (A), `jose` (B). No hay tests configurados: se propone `backend/test/` con `node:test` (`"test": "tsx --test test/**/*.test.ts"`) para validador, resolución de mocks y mapeo de roles, y actualizar `CLAUDE.md`.

### Fase A · Ingesta v1, migración, consumer y POST mock

1. `backend/prisma/schema.prisma` + migración `inbox_v1` (sección 7). `npm run db:migrate`.
2. `backend/src/shared/config.ts` (nuevo): `config` tipado con los flags de la sección 2.
3. **Dominio.** `domain/entities/event-schema.entity.ts` (`FieldType` += `uuid | datetime | money | integer`; `FieldSpec.example?`). `domain/entities/event-catalog.ts` (nuevo; borra `event-schemas.ts`). `domain/entities/event-source.entity.ts` (`CoreSource`, `SOURCE_BY_CORE`). `domain/entities/inbox-event.entity.ts` (nuevo; borra `institutional-event.entity.ts`). `domain/services/event-envelope-validator.service.ts` (nuevo; reemplaza `event-payload-validator.service.ts`; devuelve `{envelope} | {problems}`). `domain/repositories/inbox.repository.ts` (`insertIfAbsent`, `touchSource`, `list`).
4. **Aplicación.** `application/use-cases/record-event.use-case.ts` reescrito: valida envelope y `data`, busca el catálogo, aplica `handling` y `redact`, inserta; devuelve `"stored" | "duplicate" | "ignored"` o lanza `EventValidationError` (permanente). Se borran `application/services/event-normalizer.service.ts` y `RecordEventDto`. `list-events.use-case.ts` pasa a paginado (`limit`, `cursor`).
5. **Infraestructura.** `infrastructure/repositories/inbox.repository.prisma.ts`. `infrastructure/messaging/rabbitmq-event-consumer.ts` (`amqplib`: `checkQueue`, `prefetch`, `consume` con ack manual, reintentos en proceso, `nack(false,false)` → DLQ, reconexión con backoff hasta 30 s, `close()` para apagado ordenado) y `start-event-consumer.ts`. Si la cola no existe, loguea el error y reintenta: el servidor sigue levantado.
6. **HTTP.** `interfaces/http/controllers/analytics.controller.ts` (`recordEvent` recibe el envelope crudo; `201 {eventId, status: "STORED"}`, `200 DUPLICATE`, `202 IGNORED`, `400` con `errors[]`), `routes/analytics.routes.ts` (monta `POST/GET /events` sólo con `EVENTS_HTTP_INGEST`). `index.ts`: arranque del consumer según `RABBITMQ_URL`, `SIGTERM` → cerrar canal y `prisma.$disconnect()`.
7. `backend/.env.example` (sección 2). `.gitignore`: `.mock-keys/`.
8. **Verificación:** `POST` del ejemplo de 3.1 devuelve `201`; repetido, `200`; con `studentId` mal formado, `400`; con `eventType` desconocido, `202`; `source_ingestions` cuenta los cuatro casos.

### Fase B · Gateways, mocks, flags y auth

1. **Interfaces** en `domain/gateways/`: `core-auth.gateway.ts` (reescribe: `login`, `refresh`, `logout` devuelven también `setCookie`), `access-token-verifier.ts`, `core-wallet.gateway.ts` (`getAggregates(from, to)`), `backoffice.gateway.ts` (`listSites`, `getUserDisplayName`, `invalidateUser`), `academic.gateway.ts` (`listPeriods`, `listSites`, `listCareers`, `listPlans`, `listSubjects`, `listCourses`, `getCourse`), `gateway-error.ts`.
2. **Infraestructura** en `infrastructure/integrations/`: `http/http-client.ts` (headers, timeout, reintento, `problem+json` → `GatewayError`, semáforo `GATEWAY_MAX_CONCURRENCY`, de-duplicación de llamadas en vuelo), `http/service-token.provider.ts`, `cache/ttl-cache.ts`; `core/` (`core-auth.gateway.http.ts`, `core-auth.gateway.mock.ts` reescrito, `jwks-token-verifier.ts`, `mock-token-verifier.ts`, `core-wallet.gateway.http.ts`, `core-wallet.gateway.mock.ts`); `backoffice/` (`.http.ts`, `.mock.ts`); `academic/` (`academic.routes.ts`, `.http.ts`, `.mock.ts`); `mock/mock-file-store.ts` (`read(service, relativePath)`, validación de claves, `__mockStatus`); `gateways.ts` (fábrica por flag; **sólo el HTTP va envuelto en caché**).
3. **Servicios de aplicación:** `application/services/academic-catalog.service.ts`.
4. **Auth.** `domain/entities/role.entity.ts` (mapeo CORE→`RoleId`, corrección de `ROLES`), `interfaces/http/middleware/require-auth.middleware.ts` (usa `AccessTokenVerifier`; `res.locals.user = {id, email, coreRoles, permissions, roles}`), `controllers/auth.controller.ts` y `routes/auth.routes.ts` (`login`, `refresh`, `logout`, `me`, reescritura de cookie), `validators/auth.validator.ts` (mantiene el dominio `@uade.edu.ar`), `application/use-cases/login.use-case.ts` (+ `refresh`, `logout`).
5. **Resto del HTTP:** `interfaces/http/routes/health.routes.ts`, `interfaces/http/problem-json.ts` y su uso en el error handler de `index.ts`, montaje de las rutas también bajo `/api/v1`, CORS con `CORS_ORIGINS` y credenciales (agregar `X-Correlation-Id` a los headers permitidos).
6. `infrastructure/jobs/wallet-snapshot.job.ts` (sección 7.4) y su arranque en `index.ts`.
7. `backend/scripts/backfill-from-core.ts` (`npm run backfill:core -- --type=backoffice.location.upserted.v1 --from=2026-03-01`): pagina `GET /internal/v1/events` y pasa cada envelope por `RecordEventUseCase`. Sirve para la carga histórica y para recuperar sedes de locaciones.
8. `backend/mocks/` mínimo para arrancar (`users.json`, `sites.json`, `periodos.json`; el resto en la fase D).
9. **Verificación:** con `CORE_MOCK=true` el login devuelve JWT y cookie, `/me` responde, un `STUDENT` recibe `403`; editar `mocks/backoffice/sites.json` cambia `/filters` sin reiniciar; con `ACADEMIC_MOCK=true` y un archivo `{"__mockStatus":503,...}` el tablero responde `warnings`.

### Fase C · Tableros reescritos

1. `infrastructure/repositories/analytics.repository.prisma.ts`: el constructor recibe los gateways (interfaces de dominio); `analytics-repository.provider.ts` los cablea.
2. `queries/academic.queries.ts` (sólo la query de resultados de 6.1), `builders/academic-stats.builder.ts` (cruza con `AcademicGateway`, `AcademicCatalogService`, `BackofficeGateway`).
3. `queries/financial.queries.ts` (productos, comedor, snapshots), `builders/financial-stats.builder.ts` (un `aggregates` por mes de la ventana, fórmulas de 6.2, `siteScopeNote`), `infrastructure/config/dashboard.config.ts` (`INCOME_CONCEPTS`, `EXPENSE_CONCEPTS`, feeders; se borran `EXPENSE_CATEGORIES` y `OTHER_EXPENSES_CATEGORY`).
4. `queries/events.queries.ts` + `builders/event-stats.builder.ts` (6.3), `queries/catalog.queries.ts` (módulos desde `source_ingestions`; sedes, períodos y facultades pasan a los gateways), `queries/query-helpers.ts` (`timestamptz`, quitar `facultyFilter`), `domain/services/period-catalog.service.ts` (cuatrimestres desde `periodos`, meses desde `DASHBOARD_FIRST_MONTH`).
5. Entidades: `kpi.value-object.ts` (`note?`), `financial-stats.entity.ts` (`balance: number | null`, `siteScopeNote`), `dashboard-warning.entity.ts` (nuevo) y `warnings?` en los tres `*-stats.entity.ts`.
6. **Verificación:** tableros con eventos de demo y mocks coherentes (fase D); apagar un mock produce `warnings`, no `500`.

### Fase D · Demo en formato v1, mocks coherentes y Postman

1. `backend/demo/ids.ts` (ids compartidos, 5.3). `prisma/demo-seed.ts` reescrito: genera envelopes v1 de los 8 tipos persistidos (incluidos un resultado corregido, una reserva cancelada y un evento sin `location.upserted` para ver el caso sin sede) y los pasa por `RecordEventUseCase`. `npm run db:demo` / `db:demo:clear` se mantienen. `prisma/seed.ts`: revisar (hoy asume el modelo viejo).
2. `scripts/generate-demo-mocks.ts` (genera todos los archivos de la sección 5 desde `ids.ts`; 6 meses de `wallets-aggregates` con `outstandingBalance` creciente) y `scripts/check-mocks.ts` (`npm run mocks:generate`, `npm run mocks:check`).
3. `scripts/generate-postman.ts` y `scripts/generate-payload-docs.ts` adaptados a `event-catalog.ts`: una request por `eventType` persistido (el body es el envelope v1 con `eventId` nuevo y `data` armado con `FieldSpec.example`), más las de descarte y las de error (400/duplicado). Salida: `docs/postman/UADEnet-Analitica.postman_collection.json`.
4. **Verificación:** `npm run db:demo && npm run mocks:check` en limpio; los tres tableros muestran datos y los casos "sin fuente" se ven vacíos con su nota.

### Fase E · Frontend

1. `frontend/src/domain/entities/analytics.entity.ts` (copia a mano: `warnings`, `KpiCard.note`, `siteScopeNote`, `balance: number | null`) y `auth.entity.ts` (`user.id`, `coreRoles`, `permissions`).
2. `infrastructure/api/auth.client.ts`: `fetch(..., { credentials: "include" })`, nuevos `refresh()` y `logout()`. `analytics.client.ts`: ante `401` hace **un** `refresh` (serializado: el refresh rota) y reintenta; si falla, `notifyUnauthorized()`. `auth-token.store.ts` sin cambios.
3. `presentation/context/session.context.tsx`: **no guardar el token en `localStorage`** (CORE lo exige en memoria, CORE v1 §3). Se persisten sólo las preferencias de filtros; al cargar la página se intenta `refresh` para restaurar la sesión. `isAuthSession` sigue exigiendo al menos un rol.
4. Componentes: `dashboard/data-warnings.component.tsx` (nuevo, banner de `warnings` y `siteScopeNote`), `financial-dashboard.component.tsx` (`balance: null` → "—" y hueco en el área), `academic-dashboard.component.tsx` y `stat-card.component.tsx` (mostrar `note`), `data-sources.component.tsx` (sin cambios de contrato).
5. `frontend/.env.example`: `VITE_API_BASE_URL`.
6. **Verificación:** login mock, expirar el token (borrar la cookie o esperar 15 min) y comprobar el refresh silencioso; usuario `STUDENT` ve el mensaje de acceso denegado.

### Fase F · Documentación

1. `backend/EVENTOS.md`: se reescribe para el envelope v1 (tabla de tipos generada por `npm run docs`; se borran "Formatos tolerados" y el texto de "se pierde al reiniciar").
2. `CONTEXTO-UADENET.md`: nueva sección «Estado de implementación» con lo hecho; §6.7 y §7 pasan a "resuelto" o "pendiente de terceros"; §9 se limpia con las respuestas.
3. `README.md`: modos mock/real, variables, cómo simular eventos con Postman, cómo editar mocks, cómo pasar a real (checklist: `RABBITMQ_URL`, `CORE_*`, `*_MOCK=false`).
4. `CLAUDE.md`: estado del proyecto (ya no es "sin base de datos"; menciona `ANALISIS-DISENO.md`, que ya no existe: apuntar a `CONTEXTO-UADENET.md` e `docs/INTEGRACION.md`), estructura (`demo/`, `mocks/`, `messaging/`, `jobs/`), comandos nuevos y tests.
5. `backend/mocks/README.md` (reglas de 5.1).

---

## 9. Preguntas abiertas

Bloquean (B) o condicionan (C) lo que está implementable hoy con mocks. Las numeradas continúan la lista de CONTEXTO §9; se repiten sólo las que cambian el diseño.

**CORE (G10)**
1. (B) ¿Existe la cola `analytics.all-events.v1` (con `#`, DLQ, `maxRetries 3`)? ¿Credencial de **lectura**, URL y entorno? Sin esto el consumer no tiene de dónde leer.
2. (B) ¿`analytics-service` tiene `wallet:read:aggregates`? ¿Cuál es la respuesta exacta del Swagger de `wallets/aggregates`?
3. (C) ¿Crean `analytics:academic:read` y `analytics:finance:read`? Si no, el mapeo por rol queda como está.
4. (C) Identidades de prueba con `ACADEMIC_ADMIN` y `FINANCE_ADMIN` (hoy sólo `ADMIN`, `STUDENT`, `TEACHER`).
7. (C) ¿`siteId` en wallet o en `aggregates`? Sin eso, saldo e ingresos son institucionales.
8. (C) `outstandingBalance` con `to` pasado: ¿saldo al `to` o al momento de la consulta? Define si el backfill de snapshots sirve.
11/e. (C) Forma de la respuesta de `GET /internal/v1/events` y si `analytics-service` tiene `events:read` (carga histórica y locaciones).
32. (C) Valor exacto del claim `service` del token de `analytics-service` (para `X-Service-Name`) y `iss` real de un JWT de Railway.
33. (C) ¿CORS de CORE admite llamadas del navegador? No lo necesitamos con el proxy, pero se confirma.

**Backoffice (G8)**
13. (B) Que CORE haya agregado `backoffice:read` a `analytics-service`.
34. (C) ¿Hay histórico de `backoffice.location.upserted.v1` en CORE para reconstruir locación → sede? Alternativa: ruta interna `GET /internal/v1/locations/{locationId}` (Trello, «G8→G10 · Confirmaciones…», 2026-11-05, la menciona para Comedor).
35. (C) Respuesta nuestra pendiente: no publicamos eventos; consumimos `user.upserted/disabled` sólo para invalidar el nombre cacheado.

**Gestión Académica (G9)**
17. (B) Evento de resultado final de curso: `academic.course-result.published.v1` con los campos de 3.2, `eventId` UUID y publicado por `POST /internal/v1/events`. Es la métrica central del tablero académico.
18. (B) Rutas `/internal/v1/periodos`, `/sedes` (con `backofficeSiteId`), `/planes/{id}/asignaturas`, `/cursos?periodoId=`, `/cursos/{id}` y autorización de `analytics-service`.
36. (C) ¿`/cursos` devuelve períodos cerrados con `estado FINALIZADO` y `inscriptosActivos`? Si no, hace falta un snapshot por período.
37. (C) `docentes[]` dentro de `/cursos` y `facultad` en `/asignaturas` evitan N consultas y el recorrido carreras → planes → asignaturas.
38. (C) Ids numéricos como texto en los eventos (`"42"`): confirmar. ¿`termId` UUID de `academic.term-defined.v1` se corresponde con un `id` numérico de período?
39. (C) Docentes con varios roles por curso: ¿atribuimos sólo al `TITULAR`?

**Eventos (G6)**
21. (C) `category` opcional en `events.event.created.v1` para agrupar por tipo; si no, usamos la clase de precio.
22. (C) Emitir los tres eventos con nombres del catálogo, `amount` en la inscripción y `present: false` en ausentes. **Respuesta nuestra pendiente**: confirmamos los nombres de CORE.

**Tienda (G5), Comedor (G4), Biblioteca (G3), Portales (G1, G2)**
24. (C) Tienda: confirmar `items[]` con `productId, productName, category, quantity, subtotal` y `siteId` opcional; cerrar las cards «G5→G7 #26–#30».
25. (C) Comedor: "facturación" = cobrado menos cancelaciones (default) o también menos lo restituido por asistencia (`DINING_REVENUE_NET_OF_ATTENDANCE`).
27. (C) G1: ¿emiten `inscripcion.*` o un conteo de alumnos con cursada activa? G2: sus eventos no usan los nombres de v1 (`teacher.*`); no los usamos.

**Equipo / cátedra**
28. (C) ¿La entrega del 11/11 y la final del 2/12 admiten integraciones mockeadas? Determina cuánto de la fase B en modo real hay que probar.
31. (C) Definición de ingresos y egresos de 6.2 (¿ingreso = cobros de servicios o = cargas de saldo?) y si "Becas" cuenta como gasto administrativo.

---

## 10. Objeciones

1. **`ADMIN` → todo el acceso amplía privilegios.** `ADMIN` es el administrativo de Backoffice; con este mapeo ve el tablero financiero y el académico. Es la decisión pedida y queda implementada, pero conviene pedir `analytics:*` a CORE (pregunta 3) y que el mapeo por permiso pase a ser el principal. El código ya lo soporta: el permiso otorga la sección sin mirar el rol.
2. **Depender de G9 en vivo para períodos cerrados es frágil.** Los KPI "Materias en curso" y "Comisiones activas" y sus deltas necesitan que `/cursos?periodoId=` siga devolviendo cursos de períodos pasados (pregunta 36). Si G9 sólo expone los vigentes, el delta se rompe. Plan B previsto: tabla `academic_period_snapshots` (período, materias, comisiones, inscriptos) cargada por un job análogo al de saldo. No se implementa hasta tener la respuesta.
3. **La tasa de aprobación depende al 100 % de un evento que nadie emite.** `academic.course-result.published.v1` es propuesta nuestra: no está en CORE v1, G9 no declara eventos hacia Analítica y su evento real (`academica.resultado.publicado`) no cumple el envelope. Si G9 no puede emitir un evento, ofrecerles un modelo pull equivalente (`GET /internal/v1/cursos/{id}/resultados`); el gateway lo soportaría con poco cambio, pero perderíamos el histórico por evento. Hasta que se decida, el tablero académico queda sin tasas.
4. **El proxy de login concentra el rate limit de CORE** (100/min por IP, todo desde nuestro servidor) y hace pasar la contraseña por nuestro backend. Con la cantidad de usuarios de Analítica es irrelevante; si crecieran, habría que pasar al login directo y exigirle a CORE `SameSite=None` en la cookie de refresh.
5. **Un `aggregates` por mes de la ventana cuesta 6 llamadas por tablero.** Con TTL de 24 h para meses cerrados y de-duplicación de llamadas en vuelo, el costo real es 1 llamada cada 5 minutos (mes en curso). Si CORE cambia a un rango con `groupBy=month`, se reduce a una; hay que preguntarlo.
6. **Nombres de métricas con definición incierta** (ingresos/egresos, facturación, "Estudiantes con cursada activa" como inscripciones). Quedan señalados en pantalla (`note`, `siteScopeNote`) para que ninguna cifra se lea con más precisión de la que tiene.
