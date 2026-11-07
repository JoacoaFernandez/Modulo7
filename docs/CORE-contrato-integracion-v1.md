<!-- Texto provisto por el equipo de CORE (pegado por el usuario el 2026-11-04). Es el contrato acordado al inicio (v1, 2026-08-05): base, pero puede estar modificado por acuerdos posteriores. -->

# CORE — Contrato de integración para los módulos de UADEnet

**Trabajo Práctico Obligatorio — Desarrollo de Aplicaciones II — 2.º cuatrimestre 2026**
**Versión del contrato:** `v1` · **Fecha:** 2026-08-05 · **Estado:** vigente para las tres entregas

Este documento es lo único que necesitás leer para integrar tu módulo con CORE. Contiene todas las firmas: endpoints, headers, bodies, respuestas, códigos de error y eventos. El diseño completo y su justificación están en `CORE_SPEC.md`; acá está sólo lo que se usa.

**Regla de compatibilidad:** dentro de `v1` podemos agregar campos opcionales, nunca renombrar ni cambiar la semántica de uno existente. Cualquier cambio incompatible crea `v2` y se avisa con al menos una semana de anticipación. Si algo de este documento te bloquea, escribinos antes de improvisar una solución local.

---

## 1. Lo mínimo que tenés que saber

1. **El `userId` lo genera Backoffice.** Es un UUID v4 y es la clave con la que todos referenciamos personas. No inventes tu propio id de usuario ni referencies gente por email o legajo.
2. **Tu portal nunca llama a tu backend directo.** Todo entra por el gateway de CORE: `https://core/api/v1/{tu-modulo}/...`.
3. **Tu backend nunca llama a CORE con el token del usuario.** Para `/internal/v1/*` usás tu propio token de servicio.
4. **Todo lo que mueve plata necesita `Idempotency-Key` y una `externalReference` estable.** Si no la mandás, vas a cobrar dos veces.
5. **Si consumís RabbitMQ, implementá deduplicación por `eventId`.** El broker puede reentregarte el mismo mensaje.

## 2. Convenciones comunes

| Tema | Regla |
|---|---|
| Base URL pública | `/api/v1/...` — la usan los portales con el token del usuario |
| Base URL interna | `/internal/v1/...` — la usa tu backend con token de servicio; no se expone a Internet |
| Formato | JSON UTF-8, claves en `camelCase` |
| IDs | UUID v4 como string |
| Fechas | ISO 8601 en UTC: `2026-08-05T18:25:43.511Z` |
| Dinero | String decimal con dos decimales + moneda aparte: `{ "amount": "1250.00", "currency": "ARS" }`. **Nunca float.** |
| Paginación | `?cursor=<opaco>&limit=20`, máximo 100. Respuesta: `{ "items": [], "nextCursor": null }` |
| Swagger | `GET /docs` · OpenAPI JSON en `/docs-json` |

Headers: `Authorization: Bearer <jwt>` (siempre salvo login, refresh, health y JWKS); `X-Correlation-Id` (propagarlo en llamadas y eventos); `Idempotency-Key` (obligatorio en escrituras financieras y publicación de eventos, UUID v4 por intento lógico); `X-Service-Name` (en llamadas de servicio, coincide con el token).

## 3. Autenticación de usuarios

Sin SSO institucional: login email + contraseña contra la ficha que provee Backoffice.

`POST /api/v1/auth/login` con `{ "email", "password" }` → `200 { accessToken, expiresIn: 900, user: { id, email, roles, permissions, status } }` + refresh token en cookie `HttpOnly`, `Secure`, `SameSite=Lax`. El access token va en memoria, nunca en `localStorage`. Errores: `401 AUTH_INVALID_CREDENTIALS`, `403 AUTH_IDENTITY_SUSPENDED`, `429 RATE_LIMITED`.

| Método y ruta | Request | Respuesta |
|---|---|---|
| `POST /api/v1/auth/refresh` | cookie de refresh | `200 { accessToken, expiresIn }` + cookie rotada |
| `POST /api/v1/auth/logout` | Bearer o cookie | `204` |
| `GET /api/v1/auth/me` | Bearer | `200 { id, email, roles, permissions, status }` |
| `POST /api/v1/auth/activate` | `{ token, password }` | `204` |
| `POST /api/v1/auth/password/forgot` | `{ email }` | `202` siempre |
| `POST /api/v1/auth/password/reset` | `{ token, password }` | `204` |

El refresh token rota en cada uso (serializar la llamada). `GET /auth/me` devuelve datos de autorización, no es un directorio de personas: nombre, legajo o carrera se piden a Backoffice o se proyectan desde `backoffice.user.upserted.v1`.

## 4. Autenticación de tu servicio

Cada módulo tiene `clientId`/`clientSecret` propios (no hay API key global). `POST /internal/v1/service-auth/token` con `{ clientId, clientSecret }` → `200 { accessToken, expiresIn: 900, tokenType: "Bearer" }` (claims `sub=service:<modulo>`, `service`, scopes). Cachearlo hasta poco antes de `exp`.

No usar el token del usuario para `/internal/v1/*` ni el de servicio para operar en nombre de un usuario.

Validar tokens de usuario localmente (defensa en profundidad): JWKS en `GET /.well-known/jwks.json` (cacheado), firma RS256, `iss`, `aud`, `exp`; refrescar JWKS sólo ante `kid` desconocido. Claims: `iss`, `aud`, `sub` (userId), `sid`, `email`, `roles`, `permissions`, `iat`, `exp`, `jti`. `POST /internal/v1/auth/introspect` existe sólo para operaciones sensibles.

## 5. Cómo recibís la identidad del usuario

El gateway inyecta `X-User-Id`, `X-User-Roles` (coma), `X-User-Permissions` (coma), `X-Correlation-Id`, y borra cualquier `X-User-*` que venga de afuera. El módulo no debe ser accesible fuera de la red interna; validar igual el JWT. Nunca confiar en un `userId` del body o query.

## 6. Gateway

| Módulo | Prefijo externo | Variable | Se reescribe a |
|---|---|---|---|
| Portal del Estudiante | `/api/v1/student/*` | `STUDENT_SERVICE_URL` | `/api/v1/*` |
| Portal del Docente | `/api/v1/teacher/*` | `TEACHER_SERVICE_URL` | `/api/v1/*` |
| Biblioteca | `/api/v1/library/*` | `LIBRARY_SERVICE_URL` | `/api/v1/*` |
| Comedor | `/api/v1/dining/*` | `DINING_SERVICE_URL` | `/api/v1/*` |
| Tienda | `/api/v1/store/*` | `STORE_SERVICE_URL` | `/api/v1/*` |
| Eventos | `/api/v1/events/*` | `EVENTS_SERVICE_URL` | `/api/v1/*` |
| Analítica | `/api/v1/analytics/*` | `ANALYTICS_SERVICE_URL` | `/api/v1/*` |
| Backoffice | `/api/v1/backoffice/*` | `BACKOFFICE_SERVICE_URL` | `/api/v1/*` |
| Gestión Académica | `/api/v1/academic/*` | `ACADEMIC_SERVICE_URL` | `/api/v1/*` |

El gateway no transforma respuestas, timeout 10 s, no reintenta `POST`/`PATCH`/`DELETE` (puede reintentar una vez `GET`/`HEAD`), devuelve `503 UPSTREAM_UNAVAILABLE` / `502` / `504`. Se espera de cada módulo: errores en `application/problem+json` (sección 13), `GET /health/live` y `GET /health/ready`, propagar `X-Correlation-Id`.

## 7. Saldo

Una wallet en ARS por usuario, nunca negativa. Todo movimiento es `CREDIT`, `DEBIT` o `REVERSAL`, con `concept` obligatorio ("Es lo que le permite a Analítica armar el dashboard financiero").

| `concept` | `type` | Quién lo usa |
|---|---|---|
| `TOP_UP` | `CREDIT` | CORE (carga desde el portal) |
| `PAYROLL` | `CREDIT` | Backoffice (sueldos) |
| `SCHOLARSHIP` | `CREDIT` | Backoffice (becas) |
| `ADJUSTMENT` | `CREDIT`/`DEBIT` | Backoffice (corrección auditada) |
| `LIBRARY_FINE` | `DEBIT` | Biblioteca |
| `DINING_RESERVATION` | `DEBIT` | Comedor |
| `STORE_PURCHASE` | `DEBIT` | Tienda |
| `EVENT_REGISTRATION` | `DEBIT` | Eventos |
| `REFUND` | `REVERSAL` | El módulo que cobró |

`externalReference` estable por módulo: Biblioteca `penalty/{penaltyId}`, Comedor `reservation/{reservationId}`, Tienda `purchase/{purchaseId}`, Eventos `registration/{registrationId}`, Backoffice (sueldo) `payroll/{periodo}/user/{userId}`.

- Cobrar: `POST /internal/v1/wallets/{userId}/debits` con `{ amount, currency, concept, sourceModule, externalReference, description?, metadata? }` → `201 { transactionId, status: "POSTED", type, concept, amount, currency, balanceAfter, externalReference, createdAt }`. Errores: `422 WALLET_INSUFFICIENT_FUNDS`, `409 DUPLICATE_REFERENCE` (adoptar el `transactionId` existente), `409 IDEMPOTENCY_CONFLICT`, `403 FORBIDDEN`, `404 WALLET_NOT_FOUND`.
- Acreditar (sólo Backoffice y finanzas): `POST /internal/v1/wallets/{userId}/credits`, mismo formato con concept de crédito (ej. `PAYROLL`, `metadata.period`).
- Devolver: `POST /internal/v1/wallet-transactions/{transactionId}/reversals` con `{ reason, amount?, externalReference?, metadata? }` → `201 { transactionId, originalTransactionId, status, type: "REVERSAL", concept: "REFUND", amount, currency, balanceAfter, createdAt }`. `409 ALREADY_REVERSED` se trata como éxito.

Consultas:

| Endpoint | Quién | Para qué |
|---|---|---|
| `GET /api/v1/wallets/me` | Portal | Saldo propio |
| `GET /api/v1/wallets/me/transactions?type=&from=&to=&cursor=&limit=` | Portal | Movimientos propios |
| `POST /api/v1/wallets/me/top-ups` | Portal | Carga de saldo (`paymentMethodToken`: `mock-approved` / `mock-rejected`) |
| `GET /internal/v1/wallet-transactions/by-reference?sourceModule=&externalReference=` | Backend | Reconciliación tras timeout |
| `GET /internal/v1/wallet-transactions/{transactionId}` | Backend | Detalle |
| `GET /internal/v1/wallets/{userId}` | Backoffice/finanzas | Saldo de un tercero |
| `GET /internal/v1/wallets/aggregates?groupBy=concept&from=&to=` | Analítica/finanzas | Balances y gastos agregados |

Respuesta de agregados (sin identificadores de personas):

```json
{
  "range": { "from": "2026-08-01", "to": "2026-08-31" },
  "currency": "ARS",
  "outstandingBalance": "8452300.00",
  "walletCount": 1834,
  "groups": [
    { "key": "STORE_PURCHASE", "type": "DEBIT", "count": 942, "total": "1847500.00" },
    { "key": "PAYROLL", "type": "CREDIT", "count": 210, "total": "10080000.00" }
  ]
}
```

## 8. Notificaciones

En general se derivan de eventos: `teacher.exam-result.published.v1` → `EXAM_RESULT_PUBLISHED`; `library.penalty.applied.v1` → `LIBRARY_PENALTY_APPLIED`; `events.reminder.requested.v1` → `EVENT_REMINDER`. Para otras: `POST /internal/v1/notifications` con `{ userId, type, title, message, actionUrl, sourceModule, sourceReference, expiresAt }`. Lectura: `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/{id}`, `POST /api/v1/notifications/read-all`. Tiempo real por Socket.IO en `/notifications` (evento `notification.created`, room `user:{sub}`); al reconectar, releer por REST.

## 9. Eventos: publicar

Envelope:

```json
{
  "specVersion": "1.0",
  "eventId": "e3d28114-e52e-4db9-afeb-03399bcb27e7",
  "eventType": "library.penalty.applied.v1",
  "source": "library",
  "occurredAt": "2026-08-05T18:25:43.511Z",
  "subject": "user/ba310c57-a684-4dbf-a4a4-905fcfbefa08",
  "correlationId": "f501201b-00bc-4200-99e0-6883500854f1",
  "causationId": null,
  "actor": { "type": "service", "id": "library-service" },
  "data": {
    "userId": "ba310c57-a684-4dbf-a4a4-905fcfbefa08",
    "loanId": "c8ed9311-6a6b-40c6-a798-5066d290c13c",
    "daysLate": 8,
    "amount": "2500.00",
    "currency": "ARS"
  }
}
```

| Campo | Regla |
|---|---|
| `eventId` | UUID v4, único global; clave de deduplicación de todos los consumidores |
| `eventType` | Exactamente como en el catálogo, con sufijo de versión |
| `source` | El módulo; debe coincidir con su token |
| `occurredAt` | Cuándo pasó el hecho de negocio |
| `subject` | Entidad principal, formato `tipo/id` |
| `correlationId` | El propagado |
| `causationId` | `eventId` del evento que disparó éste, si aplica |
| `data` | Valida contra el JSON Schema de `contracts/events/` |

Publicar: `POST /internal/v1/events` (token de servicio, `Idempotency-Key` = `eventId`) → `202 { eventId, status: "ACCEPTED" }` (outbox: persistido y se publicará). Errores: `400 EVENT_SCHEMA_INVALID`, `403 EVENT_SOURCE_MISMATCH`, `409` si el `eventId` existe con otro contenido. Consultas IT: `GET /internal/v1/events/{eventId}`, `GET /internal/v1/events?type=&source=&status=&from=&to=`, `POST /internal/v1/events/{eventId}/replay`, `GET /internal/v1/event-bus/dlq`, `POST /internal/v1/event-bus/dlq/{messageId}/retry`.

## 10. Eventos: consumir

No declarar exchanges/queues/bindings desde código. Pedir la cola por PR sobre `contracts/topology.yaml`:

```yaml
queues:
  - name: analytics.all-events.v1     # formato {modulo}.{proposito}.v1
    durable: true
    owner: analytics
    bindings:
      - exchange: uadenet.events.v1
        routingKeys: ["#"]
    deadLetter: uadenet.dlx.v1
    maxRetries: 3
```

Un `eventType` nuevo requiere en el mismo PR su JSON Schema en `contracts/events/` y la entrada en AsyncAPI (respuesta en 48 h hábiles). La routing key es idéntica al `eventType` (`{source}.{entidad}.{acción}.v{n}`); `#` recibe todo ("lo que usa Analítica"). Cada módulo tiene su propia cola.

Algoritmo de consumo (obligatorio): prefetch 10–50 con ack manual; validar envelope; insertar `eventId` en tabla inbox con índice único y ejecutar el efecto en la misma transacción; si ya existía, ack sin repetir el efecto; error transitorio → nack (retry 10 s, 1 min, 10 min); tras 3 intentos o error permanente/schema inválido → DLQ con `failureReason`, `failedAt`, `attempt`. No hacer ack antes de procesar ni ack de errores.

```sql
CREATE TABLE inbox_messages (
  event_id     UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result       TEXT
);
```

Alternativa por webhook (compatibilidad): `POST /internal/v1/subscriptions` con `{ eventType, callbackUrl }` (allowlist), verificación con `GET callbackUrl?topic=&challenge=`, entrega `POST` con `X-UADEnet-Event-Id` y `X-UADEnet-Signature: sha256=<hmac>` sobre el body crudo (comparar en tiempo constante); reintentos ante timeout, `5xx` y `429`.

## 11. Catálogo de eventos

| Evento | Lo publica | Lo consumen | `data` |
|---|---|---|---|
| `backoffice.user.upserted.v1` | Backoffice | CORE Auth, Analítica | `userId, email, status, roles, permissions` |
| `backoffice.user.disabled.v1` | Backoffice | CORE Auth | `userId, reason` |
| `backoffice.rate.changed.v1` | Backoffice | Biblioteca, Comedor, Eventos | `rateType, amount, currency, effectiveFrom` |
| `backoffice.location.upserted.v1` | Backoffice | Biblioteca, Comedor, Eventos, Académica | `locationId, siteId, name, capacity, status` |
| `teacher.exam-result.published.v1` | Portal Docente | CORE Notif., Académica, Analítica | `studentId, courseId, subjectId, examId, grade, result, publishedAt` |
| `teacher.attendance.recorded.v1` | Portal Docente | Académica, Analítica | `studentId, courseId, classDate, present` |
| `library.penalty.applied.v1` | Biblioteca | CORE Notif., Analítica | `userId, loanId, daysLate, amount, currency` |
| `dining.reservation.created.v1` | Comedor | Analítica, calendario de portales | `reservationId, userId, siteId, slotAt, amount, currency` |
| `dining.reservation.cancelled.v1` | Comedor | Analítica, calendario de portales | `reservationId, userId, slotAt, cancelledAt` |
| `dining.attendance.recorded.v1` | Comedor | Analítica | `reservationId, userId, attendedAt` |
| `store.purchase.completed.v1` | Tienda | Analítica | `purchaseId, userId, total, currency, items[]` |
| `events.event.created.v1` | Eventos | Analítica, calendario de portales | `eventId, title, locationId, startAt, endAt, capacity, price, currency` |
| `events.registration.completed.v1` | Eventos | Analítica | `eventId, registrationId, userId, amount, currency` |
| `events.reminder.requested.v1` | Eventos | CORE Notif. | `eventId, userId, title, startAt, detailsUrl` |
| `events.attendance.recorded.v1` | Eventos | Analítica | `eventId, userId, present, checkedAt` |
| `academic.exam-scheduled.v1` | Gestión Académica | calendario de portales | `examId, subjectId, startAt, endAt, siteId, locationId` |
| `academic.term-defined.v1` | Gestión Académica | calendario de portales, Analítica | `termId, startDate, endDate` |
| `core.wallet.transaction-posted.v1` | CORE | módulo originante, Analítica | `transactionId, userId, type, concept, amount, currency, sourceModule, externalReference, status` |
| `core.wallet.transaction-rejected.v1` | CORE | módulo originante, Analítica | `userId, type, concept, amount, currency, sourceModule, externalReference, reasonCode` |
| `core.wallet.transaction-reversed.v1` | CORE | módulo originante, Analítica | `transactionId, originalTransactionId, userId, concept, amount, currency` |
| `core.notification.created.v1` | CORE | Analítica (opcional) | `notificationId, userId, type, sourceModule, createdAt` |

El calendario lo arma cada portal consumiendo eventos de Comedor, Eventos y Académica (CORE no expone calendario agregado). `store.purchase.completed.v1` no se enruta a los portales: el historial de compras se consulta a Tienda por gateway.

## 12. Checklist por módulo (resumen)

- **Portal del Estudiante:** auth, wallet propia y top-ups, notificaciones + WebSocket, historial de compras por gateway a Tienda, calendario consumiendo eventos de Comedor/Eventos/Académica; no publica eventos desde el navegador.
- **Portal del Docente:** igual que Estudiante en lo personal; publica `teacher.exam-result.published.v1` y `teacher.attendance.recorded.v1`; no llama a notificaciones para avisar notas.
- **Biblioteca:** consume `backoffice.rate.changed.v1` (`rateType=LIBRARY_LATE_FEE`); crea sanción → débito `LIBRARY_FINE` (`penalty/{penaltyId}`) → guarda `transactionId` → publica `library.penalty.applied.v1`; si no hay saldo (`422`) la deuda queda en Biblioteca.
- **Comedor:** consume `backoffice.rate.changed.v1` (`rateType=DINING_RESERVATION`); al reservar debita (`reservation/{reservationId}`); al presentarse el usuario revierte el total (reversal sin `amount`); segundo check-in → `409 ALREADY_REVERSED` = éxito; publica reserva, cancelación y asistencia.
- **Tienda:** débito `STORE_PURCHASE` (`purchase/{purchaseId}`); publica `store.purchase.completed.v1` sólo tras confirmar stock y cobro; si falla el stock después de cobrar, revierte; sirve el historial por gateway.
- **Eventos:** toda la validación de negocio es suya (superposición, cupo, doble inscripción, asistencia); inscripción paga con débito `EVENT_REGISTRATION` (`registration/{registrationId}`); scheduler de "faltan 7 días" propio → `events.reminder.requested.v1`; publica creación, inscripción y asistencia.
- **Analítica:**
  - Cola `analytics.all-events.v1` bindeada a `#`: recibe todo.
  - Inbox obligatorio (con `#` va a ver reentregas).
  - Balances y gastos administrativos (incluidos salarios): `GET /internal/v1/wallets/aggregates`, agrupando por `concept`.
  - Facturación de comedor por sede: de `dining.reservation.created.v1`, que lleva `siteId`. CORE no conoce sedes.
  - Productos más vendidos: de `store.purchase.completed.v1`.
  - No consulta wallets usuario por usuario y no recibe credenciales ni el texto de las notificaciones.
- **Backoffice:** provisiona identidades (`PUT /internal/v1/identities/{userId}` o `backoffice.user.upserted.v1`, un solo camino); cambia estado (`PATCH /internal/v1/identities/{userId}/status`); publica tarifas y sedes/ubicaciones; sueldos con crédito `PAYROLL`; no guarda hashes de contraseña ni fija saldos.
- **Gestión Académica:** consume `teacher.attendance.recorded.v1` y `teacher.exam-result.published.v1` (motor de regularidad); publica `academic.exam-scheduled.v1` y `academic.term-defined.v1`; endpoints administrativos por gateway con permisos académicos.

## 13. Errores

Todos en `application/problem+json`: `{ type, title, status, code, detail, instance, correlationId }`. Programar contra `code`, no `detail`.

| Status | Significado | ¿Reintentar? |
|---|---|---|
| `400` | Contrato inválido | No |
| `401` | Token ausente, vencido o inválido | Sí, después de refrescar |
| `403` | Sin permiso | No |
| `404` | No existe | No |
| `409` | Conflicto de idempotencia o referencia duplicada | No: leer el `transactionId`/`eventId` de la respuesta |
| `422` | Regla de negocio | No: manejarla |
| `429` | Rate limit | Sí, con backoff y `Retry-After` |
| `502` / `504` | Upstream inválido o timeout | Sólo si la operación es idempotente |
| `503` | Upstream caído / circuit breaker | Sí, con backoff |

## 14. Checklist de integración

- [ ] Validar el JWT localmente con JWKS, además de confiar en el gateway.
- [ ] Cachear claves públicas; no llamar a `introspect` en cada request.
- [ ] `clientId`/`clientSecret` de servicio en variables de entorno, fuera de Git.
- [ ] Propagar `X-Correlation-Id` en llamadas, eventos y logs.
- [ ] Toda escritura financiera con `Idempotency-Key` y `externalReference` estable.
- [ ] Guardar el `transactionId` de CORE junto a la entidad.
- [ ] Manejar `422 WALLET_INSUFFICIENT_FUNDS` como caso de negocio.
- [ ] Manejar `409 DUPLICATE_REFERENCE` y `409 ALREADY_REVERSED` adoptando la transacción existente.
- [ ] Ante timeout, consultar `by-reference` antes de reintentar.
- [ ] Si se consume RabbitMQ, tabla inbox con índice único por `eventId`.
- [ ] Ack sólo después de persistir; errores a la DLQ.
- [ ] Eventos que validan contra su JSON Schema y sin datos sensibles.
- [ ] Errores en `application/problem+json`.
- [ ] `/health/live` y `/health/ready`.
- [ ] OpenAPI publicado y actualizado.

Contratos formales (según CORE): `contracts/openapi.yaml`, `contracts/asyncapi.yaml`, `contracts/events/*.schema.json`, y una colección de Postman con todos los flujos.
