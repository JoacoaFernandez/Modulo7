# Eventos que consume Analítica Institucional

Analítica no expone una API de ingesta: **consume los eventos del bus de CORE**, con el
contrato de integración CORE v1 (2026-08-05). Los otros módulos publican en CORE
(`POST /internal/v1/events`) y CORE nos entrega todo por nuestra cola. Este documento resume
qué recibimos, qué validamos y qué usa cada tablero. El flujo de datos completo, con los
endpoints REST que consultamos, está en
[`../docs/Flujo_de_Datos_Modulo_7_Analitica.xlsx`](../docs/Flujo_de_Datos_Modulo_7_Analitica.xlsx).

> **Estado actual:** sin RabbitMQ ni base de datos todavía. La cola se simula con un endpoint
> de desarrollo, y la inbox de deduplicación y los eventos consumidos viven en memoria.
> **Ningún tablero lee esos eventos todavía**: los tableros salen del dataset mock.

---

## Cola

| | |
|---|---|
| Cola | `analytics.all-events.v1` (pedido por PR a `contracts/topology.yaml` de CORE) |
| Exchange | `uadenet.events.v1`, `routingKeys: ["#"]`: recibimos todo el bus |
| Dead letter | `uadenet.dlx.v1`, `maxRetries: 3` |
| Procesamiento | Ack manual después de persistir, `prefetch` 10–50, inbox con clave única `eventId` |

## Sobre

Todos los eventos llegan con el sobre estándar de CORE (§9.1). Sólo cambia `data`.

```json
{
  "specVersion": "1.0",
  "eventId": "e3d28114-e52e-4db9-afeb-03399bcb27e7",
  "eventType": "dining.reservation.created.v1",
  "source": "dining",
  "occurredAt": "2026-09-15T14:02:11.004Z",
  "subject": "reservation/58df9fe3-4883-4dca-9d9f-4770c81543cf",
  "correlationId": "f501201b-00bc-4200-99e0-6883500854f1",
  "causationId": null,
  "actor": { "type": "service", "id": "dining-service" },
  "data": {
    "reservationId": "58df9fe3-4883-4dca-9d9f-4770c81543cf",
    "userId": "ba310c57-a684-4dbf-a4a4-905fcfbefa08",
    "siteId": "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90",
    "slotAt": "2026-09-15T15:00:00.000Z",
    "amount": "1500.00",
    "currency": "ARS"
  }
}
```

## Qué hace el consumer con cada entrega

La lógica está en `src/application/use-cases/consume-core-event.use-case.ts`. No depende del
transporte: la llama el endpoint de desarrollo y, más adelante, el consumer de RabbitMQ.

| Caso | Resultado | Con RabbitMQ |
|---|---|---|
| Sobre inválido: campo faltante, `eventId` que no es UUID, `eventType` sin `.vN`, o `source` que no coincide con el prefijo del `eventType` | `400 EVENT_SCHEMA_INVALID` | DLQ |
| `eventType` que no está en la tabla de abajo | `IGNORED` | ack sin efecto |
| `data` que no cumple el esquema: campo faltante, monto como número, fecha mal formada | `400 EVENT_SCHEMA_INVALID` | DLQ |
| `eventId` ya procesado (reentrega) | `DUPLICATE` | ack sin efecto |
| Válido | `PROCESSED` | ack |

Reglas de formato del contrato:
- dinero como string decimal con dos decimales (`"1500.00"`), nunca número;
- fechas y horas ISO 8601 en UTC;
- fechas sin hora como `AAAA-MM-DD`;
- IDs UUID v4;
- los campos que el esquema no declara se aceptan y se ignoran (CORE puede sumar campos opcionales dentro de v1).

## Endpoint de desarrollo (simula la cola)

No existe con `NODE_ENV=production`.

```bash
curl -X POST http://localhost:3000/api/v1/dev/events \
  -H "Content-Type: application/json" \
  -d @evento.json
# 202 { "eventId": "...", "eventType": "...", "status": "PROCESSED" | "DUPLICATE" | "IGNORED" }

curl http://localhost:3000/api/v1/dev/events   # eventos consumidos, se pierden al reiniciar
```

La colección de Postman (`docs/postman/`) trae un ejemplo válido por cada `eventType`.

---

## Eventos que consumimos

Cada sección muestra el `data` de un evento. Se genera con `npm run docs:payloads` desde
`src/domain/entities/event-schemas.ts`. **No editar a mano**: cambiar el esquema y regenerar.

<!-- payloads:start -->

#### `backoffice` (backoffice)

**`backoffice.user.upserted.v1`** — Aviso de alta o cambio de una persona: invalida el cache de nombres. No se copian datos; el nombre se consulta a Backoffice.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `email` | `string` | sí | Mail institucional. No se persiste. |
| `status` | enum (`PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED`, `DISABLED`) | sí | Estado de la identidad. |
| `roles` | `array` de strings | sí | Roles del catálogo de CORE: STUDENT, TEACHER, ADMIN, ACADEMIC_ADMIN, FINANCE_ADMIN, etc. |
| `permissions` | `array` de strings | no | Permisos {modulo}:{recurso}:{acción}. |

**`backoffice.user.disabled.v1`** — Marca al docente como inactivo; sigue en el histórico.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `reason` | `string` | sí | Motivo de la baja. |

**`backoffice.location.upserted.v1`** — Sede de cada locación: los eventos académicos traen locationId, no siteId.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `locationId` | `string` | sí | UUID del espacio. |
| `siteId` | `string` | sí | UUID de la sede. |
| `name` | `string` | sí | Nombre del espacio. |
| `capacity` | `number` | sí | Capacidad física. |
| `status` | enum (`ACTIVE`, `INACTIVE`, `MAINTENANCE`) | sí | Estado del espacio. |

#### `academic` (gestión académica)

**`academic.course-result.published.v1`** — Tasa de aprobación por materia, por docente (docentes del curso) y por cuatrimestre. Un evento por alumno y curso; vale el último.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `studentId` | `string` | sí | UUID del alumno. |
| `courseId` | `string` | sí | Id del curso en Gestión Académica. |
| `subjectId` | `string` | sí | Id de la asignatura en Gestión Académica. |
| `periodId` | `string` | sí | Id del período (cuatrimestre) en Gestión Académica. |
| `siteId` | `string` | sí | UUID de la sede en Backoffice (backofficeSiteId). |
| `finalGrade` | `number` | sí | Nota final, de 0 a 10. |
| `status` | enum (`APROBADO`, `DESAPROBADO`) | sí | Resultado final de la cursada. |
| `resultDate` | `string` AAAA-MM-DD | sí | Fecha del resultado. |

**`academic.term-defined.v1`** — Cuatrimestre vigente y anteriores (filtro del tablero académico).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `termId` | `string` | sí | UUID del cuatrimestre. |
| `startDate` | `string` AAAA-MM-DD | sí | Primer día. |
| `endDate` | `string` AAAA-MM-DD | sí | Último día. |

#### `library` (biblioteca)

**`library.penalty.applied.v1`** — Multas aplicadas por mes.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `loanId` | `string` | sí | UUID del préstamo. |
| `daysLate` | `number` | sí | Días de atraso. |
| `amount` | `string` decimal (`"1500.00"`) | sí | Monto en ARS, string con dos decimales. |
| `currency` | `string` | sí | Moneda: ARS. |

#### `dining` (comedor)

**`dining.reservation.created.v1`** — Facturación de comedores por sede, tickets y ticket promedio.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `reservationId` | `string` | sí | UUID de la reserva. |
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `siteId` | `string` | sí | UUID de la sede. |
| `slotAt` | `string` ISO 8601 UTC | sí | Turno reservado. |
| `amount` | `string` decimal (`"1500.00"`) | sí | Monto en ARS, string con dos decimales. |
| `currency` | `string` | sí | Moneda: ARS. |

**`dining.reservation.cancelled.v1`** — Descuenta la reserva de la facturación (sede y monto por reservationId).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `reservationId` | `string` | sí | UUID de la reserva. |
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `slotAt` | `string` ISO 8601 UTC | sí | Turno reservado. |
| `cancelledAt` | `string` ISO 8601 UTC | sí | Cuándo se canceló. |

**`dining.attendance.recorded.v1`** — Asistencia a la reserva; la restitución sale de core.wallet.transaction-reversed.v1.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `reservationId` | `string` | sí | UUID de la reserva. |
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `attendedAt` | `string` ISO 8601 UTC | sí | Cuándo se presentó. |

#### `store` (tienda)

**`store.purchase.completed.v1`** — Productos más vendidos (unidades y facturación por producto).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `purchaseId` | `string` | sí | UUID de la compra. |
| `userId` | `string` | sí | UUID de quien compró. No se persiste. |
| `total` | `string` decimal (`"1500.00"`) | sí | Total en ARS. |
| `currency` | `string` | sí | Moneda: ARS. |
| `items` | `array` de objetos | sí | Ítems de la compra (campos a confirmar con Tienda). |
| `items[].productId` | `string` | sí | UUID del producto. |
| `items[].productName` | `string` | sí | Nombre al momento de la compra. |
| `items[].category` | `string` | no | Categoría. |
| `items[].quantity` | `number` | sí | Unidades. |
| `items[].unitPrice` | `string` decimal (`"1500.00"`) | no | Precio unitario en ARS. |
| `items[].subtotal` | `string` decimal (`"1500.00"`) | sí | Subtotal en ARS. |
| `siteId` | `string` | no | UUID de la sede. Opcional. |

#### `events` (eventos académicos)

**`events.event.created.v1`** — Frecuencia por mes y ocupación de cupo; sede por locationId.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventId` | `string` | sí | UUID del evento. |
| `title` | `string` | sí | Título. |
| `locationId` | `string` | sí | UUID de la locación (Backoffice). |
| `startAt` | `string` ISO 8601 UTC | sí | Inicio. |
| `endAt` | `string` ISO 8601 UTC | sí | Fin. |
| `capacity` | `number` | sí | Cupo máximo. |
| `price` | `string` decimal (`"1500.00"`) | no | Precio de inscripción en ARS; null si es gratuito. |
| `currency` | `string` | sí | Moneda: ARS. |

**`events.registration.completed.v1`** — Inscriptos por evento e ingresos por inscripción paga.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventId` | `string` | sí | UUID del evento. |
| `registrationId` | `string` | sí | UUID de la inscripción. |
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `amount` | `string` decimal (`"1500.00"`) | sí | Monto en ARS, string con dos decimales. |
| `currency` | `string` | sí | Moneda: ARS. |

**`events.attendance.recorded.v1`** — Concurrencia y tasa de presentismo.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventId` | `string` | sí | UUID del evento. |
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `present` | `boolean` | sí | Si asistió. |
| `checkedAt` | `string` ISO 8601 UTC | sí | Cuándo se registró. |

#### `core` (core)

**`core.wallet.transaction-posted.v1`** — Movimientos del mes por concepto (los totales salen de wallets/aggregates).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `transactionId` | `string` | sí | UUID de la transacción. |
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `type` | enum (`CREDIT`, `DEBIT`, `REVERSAL`) | sí | Tipo de movimiento. |
| `concept` | enum (`TOP_UP`, `PAYROLL`, `SCHOLARSHIP`, `ADJUSTMENT`, `LIBRARY_FINE`, `DINING_RESERVATION`, `STORE_PURCHASE`, `EVENT_REGISTRATION`, `REFUND`) | sí | Por qué se movió la plata. |
| `amount` | `string` decimal (`"1500.00"`) | sí | Monto en ARS, string con dos decimales. |
| `currency` | `string` | sí | Moneda: ARS. |
| `sourceModule` | `string` | sí | Módulo que originó el movimiento. |
| `externalReference` | `string` | sí | Referencia estable del módulo originante. |
| `status` | `string` | sí | Estado: POSTED. |

**`core.wallet.transaction-rejected.v1`** — Cobros rechazados por concepto (informativo).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `type` | enum (`CREDIT`, `DEBIT`, `REVERSAL`) | sí | Tipo de movimiento. |
| `concept` | enum (`TOP_UP`, `PAYROLL`, `SCHOLARSHIP`, `ADJUSTMENT`, `LIBRARY_FINE`, `DINING_RESERVATION`, `STORE_PURCHASE`, `EVENT_REGISTRATION`, `REFUND`) | sí | Por qué se movió la plata. |
| `amount` | `string` decimal (`"1500.00"`) | sí | Monto en ARS, string con dos decimales. |
| `currency` | `string` | sí | Moneda: ARS. |
| `sourceModule` | `string` | sí | Módulo que originó el movimiento. |
| `externalReference` | `string` | sí | Referencia estable del módulo originante. |
| `reasonCode` | `string` | sí | Motivo, por ejemplo WALLET_INSUFFICIENT_FUNDS. |

**`core.wallet.transaction-reversed.v1`** — Reintegros: comedor asistido y reversas de Tienda y Eventos.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `transactionId` | `string` | sí | UUID de la reversa. |
| `originalTransactionId` | `string` | sí | UUID de la transacción revertida. |
| `userId` | `string` | sí | UUID de la persona (lo genera Backoffice). |
| `concept` | enum (`TOP_UP`, `PAYROLL`, `SCHOLARSHIP`, `ADJUSTMENT`, `LIBRARY_FINE`, `DINING_RESERVATION`, `STORE_PURCHASE`, `EVENT_REGISTRATION`, `REFUND`) | sí | Por qué se movió la plata. |
| `amount` | `string` decimal (`"1500.00"`) | sí | Monto en ARS, string con dos decimales. |
| `currency` | `string` | sí | Moneda: ARS. |

<!-- payloads:end -->

---

## Eventos que recibimos y descartamos

Llegan por el binding `#`, pero ningún tablero los usa:
- `teacher.exam-result.published.v1` y `teacher.attendance.recorded.v1`: los resultados finales y los docentes de cada curso los tomamos de Gestión Académica
- `backoffice.rate.changed.v1`
- `events.reminder.requested.v1`
- `academic.exam-scheduled.v1`
- `core.notification.created.v1`

## Pendiente de acordar

Las preguntas y los supuestos están en [`../docs/PREGUNTAS-A-GRUPOS.md`](../docs/PREGUNTAS-A-GRUPOS.md). Las que tocan este contrato:

1. **Evento de resultado de Gestión Académica.** `academic.course-result.published.v1` es un nombre propuesto: hay que registrarlo en el catálogo de CORE, y G9 tiene que pasar a publicarlo por CORE, con un `eventId` nuevo en cada publicación.
2. **Cola o webhooks.** La cola `analytics.all-events.v1` hay que pedírsela a G10. La alternativa son webhooks por `eventType`.
3. **Ítems de `store.purchase.completed.v1`.** Confirmar los campos contra el JSON Schema de CORE.
4. **Base de datos.** La inbox tiene que pasar a una tabla con índice único por `eventId`, en la misma transacción que el efecto.
