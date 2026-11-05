# Ingesta de eventos — Analítica Institucional

Este documento es el contrato que tienen que implementar los módulos de UADEnet para
mandarnos eventos. Está **abierto a cambios**: la ingesta real todavía no se definió entre
los equipos, así que lo de acá es una propuesta funcional, ya implementada y validada en el
backend, para que sirva de punto de partida.

> **Estado actual:** los eventos se guardan en Postgres (tabla `inbox_events`, `DATABASE_URL`
> obligatoria) y **todos** los tableros, KPIs y catálogos (sedes, cuatrimestres, meses) se
> calculan desde ellos: no hay datos mock. Lo que no tiene eventos se ve vacío o en cero. Se
> pueden consultar con `GET /api/analytics/events`.

---

## Endpoint

```
POST /api/analytics/events
Content-Type: application/json
```

### Envelope

Todo evento, venga del módulo que venga, tiene la misma envoltura. Lo propio de cada
módulo va adentro de `payload`, que tiene un esquema por tipo de evento (ver
[Esquema de payloads](#esquema-de-payloads)).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventId` | `string` no vacío | sí | Identificador del evento **en el módulo emisor**. Es la clave de idempotencia: reenviar el mismo `eventId` se ignora (no duplica ni pisa el evento original) y responde `201` igual que la primera vez. |
| `sourceModule` | enum (9 valores) | sí | Módulo que emite. Ver tabla de abajo. |
| `eventType` | `string` no vacío | sí | Qué pasó, en notación `sustantivo.verbo`: `inscripcion.confirmada`. |
| `occurredAt` | ISO 8601 | sí | Cuándo ocurrió el hecho, según el reloj del emisor. **No** es la fecha de envío. |
| `payload` | objeto JSON | sí | Datos del hecho, según el esquema de su `eventType`. |

Analítica agrega dos campos propios al guardarlo: `id` (UUID interno) y `receivedAt`
(cuándo lo recibimos). El emisor no los manda.

### Módulos admitidos

`portal-estudiante` (1) · `portal-docente` (2) · `biblioteca` (3) · `comedor` (4) ·
`tienda` (5) · `eventos` (6) · `backoffice` (8) · `gestion-academica` (9) · `core` (10)

Son los 9 módulos de UADEnet que nos mandan eventos (el 7 es Analítica). Cualquier otro valor
devuelve `400`. El detalle de qué datos le pedimos a cada uno está en
[`../CONTEXTO-UADENET.md`](../CONTEXTO-UADENET.md) (sección 6, matriz de brechas).

### Respuestas

| Código | Cuerpo | Cuándo |
|---|---|---|
| `201` | `{ "eventId": "...", "status": "accepted", "warnings": [...] }` | Evento aceptado. `warnings` solo aparece si hubo que normalizar el formato o faltan campos (ver [Formatos tolerados](#formatos-tolerados)). |
| `400` | `{ "error": "mensaje en castellano" }` | Falta un campo, `sourceModule` no existe, `eventType` no existe para ese módulo, `occurredAt` no es una fecha válida o el `payload` no cumple el esquema de abajo (campo faltante o de otro tipo). |
| `500` | `{ "error": "Error interno del servidor" }` | Error nuestro. Reintentar. |

### Ejemplo

```bash
curl -X POST http://localhost:3000/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "est-insc-alumno-456-curso-42",
    "sourceModule": "portal-estudiante",
    "eventType": "inscripcion.confirmada",
    "occurredAt": "2026-08-02T10:00:00.000-03:00",
    "payload": { "alumnoId": "alumno-456", "cursoId": "curso-42", "materia": "BDD-310", "sedeId": "montserrat", "cuatrimestre": "2026-2C" }
  }'
```

Consultar lo ingerido (solo para desarrollo; se lee de la tabla `inbox_events` de Postgres):

```bash
curl http://localhost:3000/api/analytics/events
```

---

## Formatos tolerados

El formato oficial es el de arriba y es **estricto**. Mientras los otros módulos ajustan sus
eventos, la ingesta absorbe estas diferencias con una única capa de normalización
(`src/application/services/event-normalizer.service.ts`), la misma para los 9 módulos. Es una
tolerancia temporal: cada emisor tiene que migrar al formato oficial.

| Llega | Se interpreta como |
|---|---|
| `tipo: "academica.resultado.publicado"` | `sourceModule: "gestion-academica"` + `eventType: "resultado.publicado"` (el prefijo antes del primer punto es el módulo; admite alias como `academica`, `estudiante`, `docente`) |
| `ocurridoEn` | `occurredAt` |
| Campos sueltos en la raíz del evento | `payload` |
| Sin `eventId` | Se deriva uno determinístico (`derivado-<hash>`), igual para el mismo hecho reenviado, y se avisa en `warnings` |
| Ids numéricos (`cursoId: 42`) | String (`"42"`), en cualquier campo que termine en `Id` |
| `cuatrimestre: "2026-2Q"` | `"2026-2C"` |
| `sede: "Sede Centro"` (nombre o id) | `sedeId`, buscado en el catálogo de Backoffice. Si no existe en el catálogo no se inventa |
| `estado: "APROBADO"` sin `aprobado` | `aprobado: true`; cualquier otro estado, `false` |

Qué cambia según el formato en que llegue el evento:

- **Formato oficial:** falta un campo obligatorio o hay uno de otro tipo → `400`.
- **Formato viejo (`tipo`):** un campo obligatorio faltante **no corta** la ingesta: responde
  `201` con `warnings`, y el evento no sirve a los tableros hasta que el emisor lo complete
  (por ejemplo, `materia` o `sedeId`). Un campo con el tipo equivocado sí devuelve `400`.

La respuesta `201` incluye `warnings` cuando hubo normalización o campos faltantes:

```json
{ "eventId": "derivado-822daf2a1a6e3b1b47e4738a", "status": "accepted", "warnings": ["..."] }
```

---

## Esquema de payloads

`eventType` es único por módulo emisor, no global: `inscripcion.confirmada` lo mandan
`portal-estudiante` y `eventos`, y se distinguen por `sourceModule`.

Cada módulo solo puede mandar los eventos de esta tabla. El backend valida el `payload`
contra ella y responde `400` con el detalle si falta un campo obligatorio, si un tipo no
coincide o si el `eventType` no existe para ese módulo. Los campos extra se aceptan y se
ignoran. Tipos: `string`, `number` (montos en ARS, sin formato de texto), `boolean`, fecha
`AAAA-MM-DD` (sin hora, hora de Argentina), `object` y `array`.

Esta sección se genera con `npm run docs:payloads` desde
`src/domain/entities/event-catalog.ts`. **No editar a mano**: cambiar el catálogo y regenerar.

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

Resumen del catálogo. Los payloads completos, con ejemplos, están en
[`../CONTEXTO-UADENET.md`](../CONTEXTO-UADENET.md) (sección 6, matriz de brechas). Todo payload lleva `sedeId` (id del
catálogo de sedes de Backoffice) y los IDs (`alumnoId`, `cursoId`, `docenteId`) van como
string. Los eventos de anulación o corrección restan o reemplazan lo que contó el evento
original.

### Tablero académico

| Módulo | `eventType` | Alimenta |
|---|---|---|
| `gestion-academica` | `resultado.publicado` · `resultado.modificado` | Tasa de aprobación general · por materia · por cuatrimestre · por docente |
| `gestion-academica` | `curso.abierto` · `curso.cerrado` | Materias en curso · Comisiones activas (un curso cuenta en su cuatrimestre salvo que `curso.cerrado` llegue antes del `fin` de `cuatrimestre.definido`; sin definición, antes de hoy) · Tendencia por facultad |
| `gestion-academica` | `cuatrimestre.definido` | Catálogo de cuatrimestres (también se arma con el `cuatrimestre` de cualquier otro evento) |
| `portal-estudiante` | `inscripcion.confirmada` · `inscripcion.cancelada` | Estudiantes con cursada activa |
| `portal-docente` | `curso.creado` · `acta.cerrada` (opcionales) | Respaldo del cruce curso → docente y de la aprobación |
| `backoffice` | `docente.alta` | Nombre del docente |
| `gestion-academica` | `curso.abierto` (`facultad`) | Tendencia por facultad · Catálogo y filtro `?facultad=` del tablero académico (el resto de los eventos se atribuye a una facultad por `cursoId` + `cuatrimestre` del `curso.abierto`) |

### Tablero financiero

| Módulo | `eventType` | Alimenta |
|---|---|---|
| `core` | `saldo.movimiento` | Saldo acumulado · Ingresos · Egresos · Resultado |
| `backoffice` | `sueldos.liquidados` · `gasto.registrado` | Gastos administrativos |
| `tienda` | `compra.realizada` · `compra.devuelta` | Productos más vendidos |
| `comedor` | `reserva.confirmada` · `reserva.asistida` · `reserva.cancelada` | Comedores por sede (facturación, tickets, ticket promedio) |

### Estadísticas de eventos

| Módulo | `eventType` | Alimenta |
|---|---|---|
| `eventos` | `evento.realizado` · `evento.cancelado` | Eventos realizados · Frecuencia por mes · Ocupación de cupo |
| `eventos` | `inscripcion.confirmada` · `inscripcion.cancelada` | Inscriptos · Ingresos por inscripción paga |
| `eventos` | `asistencia.registrada` | Concurrencia · Presentismo por tipo |

### Datos maestros

| Módulo | `eventType` | Para qué |
|---|---|---|
| `backoffice` | `sede.definida` | Catálogo de sedes (`sedeId` → nombre): sin este evento no hay sedes para filtrar |

`biblioteca` está habilitado como emisor (`prestamo.realizado` · `prestamo.devuelto`), pero
hoy ningún tablero consume sus eventos.

---

## Cosas a definir entre los equipos

1. **Idempotencia.** Resuelta: `eventId` es único en la base y un reenvío se ignora. Falta
   acordar que cada módulo mantenga el mismo `eventId` en los reintentos.
2. **Versionado del esquema.** Los payloads ya se validan por tipo de evento; falta definir
   cómo se versiona un cambio de campos sin romper a los módulos que ya emiten.
3. **Envío por lotes.** Si el volumen lo pide, agregar `POST /api/analytics/events/batch`.
4. **Autenticación entre módulos.** No hay ninguna: el endpoint está abierto.
5. **Reintentos y orden.** Analítica no asume orden de llegada; `occurredAt` manda.
