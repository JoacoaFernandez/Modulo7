# Ingesta de eventos — Analítica Institucional

Este documento es el contrato que tienen que implementar los módulos de UADEnet para
mandarnos eventos. Está **abierto a cambios**: la ingesta real todavía no se definió entre
los equipos, así que lo de acá es una propuesta funcional, ya implementada y validada en el
backend, para que sirva de punto de partida.

> **Estado actual:** los eventos que se reciben se guardan en memoria y se pueden consultar
> con `GET /api/analytics/events`, pero **ningún tablero los lee todavía**. Los tableros salen
> de un dataset mock que replica el prototipo. Conectar la ingesta con los tableros es el
> trabajo que sigue cuando exista una base de datos.

---

## Endpoint

```
POST /api/analytics/events
Content-Type: application/json
```

### Envelope

Todo evento, venga del módulo que venga, tiene la misma envoltura. Lo propio de cada
módulo va adentro de `payload`, sin esquema fijo por ahora.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventId` | `string` no vacío | sí | Identificador del evento **en el módulo emisor**. Es la clave de idempotencia: reenviar el mismo `eventId` tiene que poder repetirse sin duplicar el hecho. |
| `sourceModule` | enum (9 valores) | sí | Módulo que emite. Ver tabla de abajo. |
| `eventType` | `string` no vacío | sí | Qué pasó, en notación `sustantivo.verbo`: `inscripcion.confirmada`. |
| `occurredAt` | ISO 8601 | sí | Cuándo ocurrió el hecho, según el reloj del emisor. **No** es la fecha de envío. |
| `payload` | objeto JSON | no (default `{}`) | Datos del hecho. |

Analítica agrega dos campos propios al guardarlo: `id` (UUID interno) y `receivedAt`
(cuándo lo recibimos). El emisor no los manda.

### Módulos admitidos

`portal-estudiante` (1) · `portal-docente` (2) · `biblioteca` (3) · `comedor` (4) ·
`tienda` (5) · `eventos` (6) · `backoffice` (8) · `gestion-academica` (9) · `core` (10)

Son los 9 módulos de UADEnet que nos mandan eventos (el 7 es Analítica). Cualquier otro valor
devuelve `400`. El detalle de qué datos le pedimos a cada uno está en
[`../DATOS-POR-MODULO.md`](../DATOS-POR-MODULO.md).

### Respuestas

| Código | Cuerpo | Cuándo |
|---|---|---|
| `201` | `{ "eventId": "...", "status": "accepted" }` | Evento aceptado. |
| `400` | `{ "error": "mensaje en castellano" }` | Falta un campo, `sourceModule` no existe, `occurredAt` no es una fecha válida o `payload` no es un objeto. |
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

Consultar lo ingerido (solo para desarrollo, se pierde al reiniciar el servidor):

```bash
curl http://localhost:3000/api/analytics/events
```

---

## Qué evento alimenta qué tablero

Resumen del catálogo. Los payloads completos, con ejemplos, están en
[`../DATOS-POR-MODULO.md`](../DATOS-POR-MODULO.md). Todo payload lleva `sedeId` (id del
catálogo de sedes de Backoffice) y los IDs (`alumnoId`, `cursoId`, `docenteId`) van como
string. Los eventos de anulación o corrección restan o reemplazan lo que contó el evento
original.

### Tablero académico

| Módulo | `eventType` | Alimenta |
|---|---|---|
| `gestion-academica` | `resultado.publicado` · `resultado.modificado` | Tasa de aprobación general · por materia · por cuatrimestre · por docente |
| `gestion-academica` | `curso.abierto` · `curso.cerrado` | Materias en curso · Comisiones activas · Tendencia por facultad |
| `gestion-academica` | `cuatrimestre.definido` | Qué es "en curso" y "cuatrimestre anterior" |
| `portal-estudiante` | `inscripcion.confirmada` · `inscripcion.cancelada` | Estudiantes con cursada activa |
| `portal-docente` | `curso.creado` · `acta.cerrada` (opcionales) | Respaldo del cruce curso → docente y de la aprobación |
| `backoffice` | `docente.alta` | Nombre del docente |

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
| `backoffice` | `sede.definida` | Catálogo de sedes (`sedeId` → nombre) |

`biblioteca` está habilitado como emisor (`prestamo.realizado` · `prestamo.devuelto`), pero
hoy ningún tablero consume sus eventos.

---

## Cosas a definir entre los equipos

1. **Idempotencia real.** Hoy `eventId` se guarda pero no se deduplica. Cuando haya base
   de datos tiene que ser índice único.
2. **Esquema por tipo de evento.** Ahora `payload` es un objeto libre. Convendría validar
   cada `eventType` contra su esquema.
3. **Envío por lotes.** Si el volumen lo pide, agregar `POST /api/analytics/events/batch`.
4. **Autenticación entre módulos.** No hay ninguna: el endpoint está abierto.
5. **Reintentos y orden.** Analítica no asume orden de llegada; `occurredAt` manda.
