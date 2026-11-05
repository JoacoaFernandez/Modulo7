# Ingesta de eventos — Analítica Institucional

Este documento describe cómo Analítica (Módulo 7) recibe los eventos de los demás módulos de
UADEnet. El contrato es el **envelope v1 de CORE** (`Recursos IA/CORE-contrato-integracion-v1.md`,
§9 a §11, más las novedades del 2026-11-04): Analítica no define un formato propio. Qué `eventType`
consume y con qué `data` está en el catálogo
[`src/domain/entities/event-catalog.ts`](src/domain/entities/event-catalog.ts), que es la **fuente de
verdad**: la tabla de tipos de este documento y la colección de Postman se generan de ahí con
`npm run docs` (en `backend/`).

Contexto, decisiones y pendientes con cada equipo: [`../CONTEXTO-UADENET.md`](../CONTEXTO-UADENET.md) y
[`../docs/INTEGRACION.md`](../docs/INTEGRACION.md).

> **Estado actual:** los eventos se guardan en Postgres (tabla `inbox_events`) y los tableros se
> calculan desde ahí más las consultas REST a CORE, Backoffice y Gestión Académica (o sus mocks).
> Varios tipos que Analítica necesita todavía no los emite ningún módulo (por ejemplo
> `academic.course-result.published.v1`, propuesto por nosotros): en la tabla de tipos figuran como
> «propuesto, pendiente de registrar en CORE».

---

## Cómo llegan los eventos

| Transporte | Cuándo | Cómo |
|---|---|---|
| **Cola de CORE (real)** | Con `RABBITMQ_URL` definida | El backend consume la cola `analytics.all-events.v1` (`RABBITMQ_QUEUE`), que crea CORE y recibe todo el bus (binding `#`). Ack manual, `RABBITMQ_PREFETCH` mensajes en vuelo. La cola no se declara desde el código: si no existe, el consumer loguea el error y reintenta con backoff (hasta 30 s) sin tirar el servidor |
| **`POST /api/analytics/events` (simulado)** | Con `EVENTS_HTTP_INGEST=true` | Mock de la cola para probar con Postman o `curl`: el body es el mismo envelope que CORE entregaría. Sin autenticación, igual que la cola. Con el flag apagado (por defecto), `POST` y `GET /api/analytics/events` dan `404` |

Los dos caminos pasan por el mismo caso de uso (`RecordEventUseCase`), así que validan, descartan e
insertan exactamente igual. El `POST` también responde bajo `/api/v1/events` (el gateway de CORE
reescribe `/api/v1/analytics/*` a `/api/v1/*`).

### Envelope

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `specVersion` | string | sí | `"1.0"` |
| `eventId` | UUID | sí | Clave de idempotencia (se guarda en minúsculas) |
| `eventType` | string | sí | `{source}.{entidad}.{acción}.v{n}`; el prefijo debe coincidir con `source` |
| `source` | string | sí | `student`, `teacher`, `library`, `dining`, `store`, `events`, `academic`, `backoffice` o `core` |
| `occurredAt` | datetime | sí | ISO 8601 UTC con `Z` (`2026-09-30T18:12:03.511Z`). Cuándo pasó el hecho, no cuándo se envió |
| `subject` | string | no | `tipo/id` |
| `correlationId` | UUID | no | Se loguea |
| `causationId` | UUID \| null | no | |
| `actor` | `{ type, id }` | no | |
| `data` | objeto | sí | Se valida contra la entrada del catálogo (ver la tabla de tipos) |

Reglas de `data`: los UUID van como UUID; el dinero es un **string decimal con dos decimales**
(`"1500.00"`, nunca un número) más `currency`; los ids numéricos de Gestión Académica viajan **como texto**
(`"42"`); las fechas de negocio sin hora son `AAAA-MM-DD`; los `datetime` son UTC con `Z`. Sólo se exigen
los campos que una métrica necesita; los campos que el catálogo no declara se aceptan y se ignoran.

`receivedAt` y el resto de las columnas internas los agrega Analítica al guardar; el emisor no los manda.

### Ejemplo

```bash
curl -X POST http://localhost:3000/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "specVersion": "1.0",
    "eventId": "7b1f6d20-3a54-4c0e-9d11-4e8a2f6c9b01",
    "eventType": "academic.course-result.published.v1",
    "source": "academic",
    "occurredAt": "2026-09-30T18:12:03.511Z",
    "subject": "course/42",
    "data": {
      "studentId": "ba310c57-a684-4dbf-a4a4-905fcfbefa08",
      "courseId": "42",
      "subjectId": "15",
      "periodId": "8",
      "siteId": "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90",
      "status": "APROBADO",
      "finalGrade": 8,
      "resultDate": "2026-09-30"
    }
  }'
```

Consultar lo guardado (depuración; sólo con `EVENTS_HTTP_INGEST=true`, paginado de más nuevo a más
viejo con `?limit=` y `?cursor=`):

```bash
curl "http://localhost:3000/api/analytics/events?limit=5"
```

---

## Respuestas del `POST`

| Código | Cuerpo | Cuándo |
|---|---|---|
| `201` | `{ "eventId": "...", "status": "STORED" }` | El evento se validó y se guardó |
| `200` | `{ "eventId": "...", "status": "DUPLICATE" }` | Ya existía un evento con ese `eventId`: no se inserta ni se pisa |
| `202` | `{ "eventId": "...", "status": "IGNORED" }` | Es válido pero no se guarda: tipo fuera del catálogo, de efecto lateral o de los que se descartan (ver abajo) |
| `400` | `application/problem+json` con `code: "INVALID_EVENT"` | El envelope o el `data` no cumplen el contrato |

El `400` sigue el formato de errores de CORE (`type`, `title`, `status`, `code`, `detail`, `instance`,
`correlationId`) y suma `errors[]` con un texto por cada problema; `error` repite `detail`:

```json
{
  "type": "urn:uadenet:problem:invalid-event",
  "title": "Solicitud inválida",
  "status": 400,
  "code": "INVALID_EVENT",
  "detail": "data.studentId debe ser un UUID.",
  "instance": "/api/analytics/events",
  "correlationId": "…",
  "errors": ["data.studentId debe ser un UUID."]
}
```

Un cuerpo que no es JSON también da `400` (`code: "BAD_REQUEST"`). Un error nuestro (por ejemplo, la base
caída) da `500` (`INTERNAL_ERROR`): el emisor debe reintentar.

Por la cola la semántica es la equivalente: guardado, duplicado o descartado se confirman con `ack`; un
evento inválido o un mensaje que no es JSON se rechaza con `nack` sin reencolar y va a la DLQ de CORE; un
error transitorio (base caída) se reintenta en proceso `RABBITMQ_MAX_ATTEMPTS` veces (esperas de 1, 5 y 30 s)
y, si persiste, también va a la DLQ. `GET /health/ready` informa si el consumer está conectado.

---

## Idempotencia

`eventId` es la clave primaria del inbox: se inserta con `ON CONFLICT DO NOTHING`, así que reenviar el mismo
evento (entrega al menos una vez de la cola, o un reintento del emisor) no duplica ni pisa nada y no suma a los
contadores. Si llega el mismo `eventId` con otro `eventType` u `occurredAt`, se ignora el nuevo y se loguea
un aviso. Para corregir un hecho (por ejemplo, una nota) se publica un evento **nuevo** con otro `eventId`: los
tableros toman el último por `occurredAt`.

---

## Qué se guarda, qué se descarta y qué se redacta

Cada entrada del catálogo tiene un tratamiento (`handling`):

| Tratamiento | Qué pasa | Respuesta |
|---|---|---|
| `persist` | Se valida `data` y se guarda en `inbox_events` (envelope completo, `result = OK`) | `201` |
| `side-effect` | Se valida y se procesa, pero no se guarda. Hoy: `backoffice.user.upserted.v1` y `backoffice.user.disabled.v1` invalidan el nombre cacheado de ese `userId` (llevan mail y permisos) | `202` |
| `ignore` | Se descarta sin validar el contenido (`ack`) | `202` |
| Fuera del catálogo | Se descarta, siempre que el `eventType` esté bien formado. Con `INBOX_STORE_UNKNOWN=true` se guarda con `result = UNKNOWN_TYPE` | `202` (o `201` con el flag) |

- Con binding `#` llega todo el bus; descartar no pierde nada definitivo, porque CORE conserva los eventos y
  permite releerlos (`GET /internal/v1/events`, replay). Para una carga histórica: `npm run backfill:core` (ver
  `docs/INTEGRACION.md`, Fase B).
- **Redacción (`redact`):** algunos tipos borran campos de `data` antes de guardar. Hoy, `userId` en las
  reservas de comedor y en las compras de tienda: no se guarda el usuario de ninguna compra. Cada tipo de la
  tabla lo indica en «No se guarda».
- **Siempre se cuenta:** aunque el evento se descarte, se actualiza `source_ingestions` (último evento recibido
  y contadores de guardados y descartados por módulo), que alimenta «Fuentes de datos» y el pie de cada tablero.
- Un `400` ocurre si el envelope es inválido, si el prefijo del `eventType` no coincide con `source`, si un
  tipo del catálogo se publica con otro `source`, o si falta o tiene un tipo equivocado un campo obligatorio de
  `data` (los tipos que se descartan no se validan).

---

## Esquema de los tipos de evento

Los campos de `data` van con prefijo `data.`. «Obligatorio» es lo que Analítica necesita para una métrica:
los campos que CORE lista y no usamos figuran como opcionales. Estado: **CORE oficial** (figura en el
catálogo de CORE v1), **declarado por el equipo emisor** o **propuesto, pendiente de registrar en CORE**
(lo propusimos nosotros y nadie lo emite todavía).

Esta sección se genera con `npm run docs` desde `src/domain/entities/event-catalog.ts`.
**No editar a mano**: cambiar el catálogo y regenerar.

<!-- payloads:start -->

<!-- Generado por `npm run docs` desde event-catalog.ts: no editar a mano. -->

#### `source: teacher`

**`teacher.exam-result.published.v1`**

- Estado: declarado por el equipo emisor.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: Es por examen, no resultado final de curso.

**`teacher.attendance.recorded.v1`**

- Estado: declarado por el equipo emisor.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: Es por clase; ningún tablero lo usa.

#### `source: library`

**`library.penalty.applied.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: Ningún tablero lo usa (las multas ya están en aggregates).

#### `source: dining`

**`dining.reservation.created.v1`** · G4

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Facturación y tickets por sede.
- No se guarda: `data.userId` (redact).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.reservationId` | `uuid` | sí | Id de la reserva. |
| `data.userId` | `uuid` | no | Id del usuario. No se guarda (redact). |
| `data.siteId` | `uuid` | sí | Id de la sede. |
| `data.slotAt` | `datetime` ISO 8601 UTC con `Z` | no | Turno reservado. |
| `data.amount` | `money` texto con 2 decimales | sí | Importe. |
| `data.currency` | `string` | no | Moneda (ISO 4217). |

**`dining.reservation.cancelled.v1`** · G4

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Descuenta la reserva cancelada.
- No se guarda: `data.userId` (redact).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.reservationId` | `uuid` | sí | Id de la reserva. |
| `data.userId` | `uuid` | no | Id del usuario. No se guarda (redact). |
| `data.slotAt` | `datetime` ISO 8601 UTC con `Z` | no | Turno reservado. |
| `data.cancelledAt` | `datetime` ISO 8601 UTC con `Z` | no | Momento de la cancelación. |

**`dining.attendance.recorded.v1`** · G4

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Sólo con DINING_REVENUE_NET_OF_ATTENDANCE=true.
- No se guarda: `data.userId` (redact).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.reservationId` | `uuid` | sí | Id de la reserva. |
| `data.userId` | `uuid` | no | Id del usuario. No se guarda (redact). |
| `data.attendedAt` | `datetime` ISO 8601 UTC con `Z` | no | Momento de la asistencia. |

#### `source: store`

**`store.purchase.completed.v1`** · G5

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Productos más vendidos (unidades y facturación).
- No se guarda: `data.userId` (redact).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.purchaseId` | `uuid` | sí | Id de la compra. |
| `data.userId` | `uuid` | no | Id del usuario. No se guarda (redact). |
| `data.total` | `money` texto con 2 decimales | no | Total de la compra. |
| `data.currency` | `string` | no | Moneda (ISO 4217). |
| `data.siteId` | `uuid` | no | Id de la sede (opcional). |
| `data.items` | `array` de objetos | sí | Ítems de la compra (propuesto: no está en CORE v1). |
| `data.items[].productId` | `uuid` | sí | Id del producto. |
| `data.items[].productName` | `string` | sí | Nombre del producto al momento de la compra. |
| `data.items[].category` | `string` | no | Categoría. |
| `data.items[].quantity` | `integer` | sí | Unidades. |
| `data.items[].unitPrice` | `money` texto con 2 decimales | no | Precio unitario. |
| `data.items[].subtotal` | `money` texto con 2 decimales | sí | Importe de la línea. |

#### `source: events`

**`events.event.created.v1`** · G6

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Frecuencia, ocupación de cupo y tipo de evento.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.eventId` | `uuid` | sí | Id del evento. |
| `data.title` | `string` | no | Título. |
| `data.locationId` | `uuid` | sí | Id de la locación en Backoffice. |
| `data.startAt` | `datetime` ISO 8601 UTC con `Z` | no | Inicio. |
| `data.endAt` | `datetime` ISO 8601 UTC con `Z` | sí | Fin. |
| `data.capacity` | `integer` | sí | Cupo. |
| `data.price` | `money` texto con 2 decimales | no | Precio (puede ser null). |
| `data.currency` | `string` | no | Moneda (ISO 4217). |
| `data.category` | `string` | no | Tipo de evento (propuesto, opcional). |

**`events.registration.completed.v1`** · G6

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Inscriptos y presentismo.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.eventId` | `uuid` | sí | Id del evento. |
| `data.registrationId` | `uuid` | sí | Id de la inscripción. |
| `data.userId` | `uuid` | sí | Id del usuario inscripto. |
| `data.amount` | `money` texto con 2 decimales | no | Importe cobrado. |
| `data.currency` | `string` | no | Moneda (ISO 4217). |

**`events.attendance.recorded.v1`** · G6

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Concurrencia y presentismo.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.eventId` | `uuid` | sí | Id del evento. |
| `data.userId` | `uuid` | sí | Id del usuario. |
| `data.present` | `boolean` | sí | Si estuvo presente. |
| `data.checkedAt` | `datetime` ISO 8601 UTC con `Z` | no | Momento del registro. |

**`events.reminder.requested.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: No es de Analítica.

#### `source: academic`

**`academic.course-result.published.v1`** · G9

- Estado: propuesto, pendiente de registrar en CORE.
- Tratamiento: se guarda.
- Alimenta: Tasa de aprobación (KPI, por materia, por facultad, por docente).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.studentId` | `uuid` | sí | Id del alumno. |
| `data.courseId` | `string` | sí | Id del curso (texto). |
| `data.subjectId` | `string` | sí | Id de la asignatura (texto). |
| `data.periodId` | `string` | sí | Id del período (texto). |
| `data.siteId` | `uuid` | sí | Id de la sede en Backoffice (backofficeSiteId). |
| `data.status` | enum (`APROBADO`, `DESAPROBADO`) | sí | Resultado final. |
| `data.finalGrade` | `number` | no | Nota final (0 a 10). |
| `data.resultDate` | `date` AAAA-MM-DD | no | Fecha del resultado (AAAA-MM-DD). |

**`academic.term-defined.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: Los cuatrimestres salen de GET periodos.

**`academic.exam-scheduled.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: No es de Analítica.

#### `source: backoffice`

**`backoffice.location.upserted.v1`** · G8

- Estado: CORE oficial.
- Tratamiento: se guarda.
- Alimenta: Resolver la sede de un evento (locationId a siteId).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.locationId` | `uuid` | sí | Id de la locación. |
| `data.siteId` | `uuid` | sí | Id de la sede. |
| `data.name` | `string` | no | Nombre de la locación. |
| `data.capacity` | `integer` | no | Capacidad. |
| `data.status` | enum (`ACTIVE`, `INACTIVE`, `MAINTENANCE`) | no | Estado. |
| `data.type` | `string` | no | Tipo de locación (pedido de G8, opcional). |

**`backoffice.user.upserted.v1`** · G8

- Estado: CORE oficial.
- Tratamiento: efecto lateral (se procesa y no se guarda).
- Alimenta: Invalida el nombre cacheado del usuario (no se guarda: lleva mail y permisos).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.userId` | `uuid` | sí | Id del usuario. |

**`backoffice.user.disabled.v1`** · G8

- Estado: CORE oficial.
- Tratamiento: efecto lateral (se procesa y no se guarda).
- Alimenta: Invalida el nombre cacheado del usuario (no se guarda: lleva mail y permisos).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `data.userId` | `uuid` | sí | Id del usuario. |

**`backoffice.rate.changed.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: No es de Analítica.

#### `source: core`

**`core.wallet.transaction-posted.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: Los totales oficiales salen de aggregates.

**`core.wallet.transaction-reversed.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: Los totales oficiales salen de aggregates.

**`core.wallet.transaction-rejected.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: Los totales oficiales salen de aggregates.

**`core.notification.created.v1`**

- Estado: CORE oficial.
- Tratamiento: se recibe y se descarta (ack).
- Alimenta: No es de Analítica.

<!-- payloads:end -->

---

## Qué evento alimenta qué tablero

| Tablero | Eventos que lee | Qué más usa |
|---|---|---|
| Académico | `academic.course-result.published.v1` (tasa de aprobación por materia, facultad y docente) | Cursos, períodos, catálogo de asignaturas y docentes de Gestión Académica; sedes y nombres de Backoffice |
| Estadísticas de eventos | `events.event.created.v1`, `events.registration.completed.v1`, `events.attendance.recorded.v1`, `backoffice.location.upserted.v1` (la sede de un evento sale de su `locationId`) | Sedes de Backoffice |
| Financiero | `store.purchase.completed.v1` (productos más vendidos), `dining.reservation.created.v1`, `dining.reservation.cancelled.v1`, `dining.attendance.recorded.v1` (comedores por sede) | `wallets/aggregates` de CORE (saldo, ingresos, egresos, sueldos) y los snapshots mensuales del saldo |

Los tipos de efecto lateral y los descartados no alimentan ningún tablero. El detalle de cada métrica y su
fuente está en `docs/INTEGRACION.md`, sección 6.

---

## Probar con la colección de Postman

[`../docs/postman/UADEnet-Analitica.postman_collection.json`](../docs/postman/UADEnet-Analitica.postman_collection.json)
se genera con `npm run docs` desde el mismo catálogo. Pasos:

1. En `backend/.env`: `EVENTS_HTTP_INGEST=true` y `CORE_MOCK=true` (valores de `.env.example`); levantar el
   backend y cargar el demo con `npm run db:demo`.
2. Importar la colección, correr un login de la carpeta **Auth (mock de CORE)** (la contraseña de demo está
   en `backend/mocks/README.md`); el token se guarda solo.
3. En **Cola (simulación)** hay una request por cada `eventType` que se guarda, una por cada descarte
   (`202 IGNORED`), los casos borde (corrección de un resultado, duplicado) y los errores de contrato (`400`).
   Cada envío usa un `eventId` y un `occurredAt` nuevos y datos coherentes con el demo
   (`backend/demo/ids.ts`), así que impactan en los tableros.
4. Volver a pedir un tablero en **Tableros** para ver el efecto.

---

## Cosas a definir entre los equipos

El contrato todavía no se cerró con todos los emisores (detalle en `docs/INTEGRACION.md`, sección 9):

1. **Quién emite qué.** Varios tipos de la tabla están «propuestos» o los emisores los declaran con otro nombre
   (por ejemplo, Eventos declara `evento.creado`). Falta que registren los del catálogo.
2. **Resultado final de curso.** `academic.course-result.published.v1` no existe en CORE v1: lo necesita el
   tablero académico y hay que acordarlo con Gestión Académica.
3. **Tienda.** `items[]` de `store.purchase.completed.v1` no está especificado en v1: confirmar los campos.
4. **Autenticación del `POST`.** No tiene (es el mock de la cola); la cola real se autentica con una
   credencial de sólo lectura que entrega CORE.
5. **Envío por lotes.** No hay; CORE entrega de a un evento.
