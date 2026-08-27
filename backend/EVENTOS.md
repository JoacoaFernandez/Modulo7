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

`academica` · `inscripciones` · `evaluaciones` · `docencia` · `finanzas` · `biblioteca` ·
`campus` · `soporte` · `identidad`

Son los 9 módulos que la UI muestra como "fuentes de eventos". Cualquier otro valor
devuelve `400`.

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
    "eventId": "insc-2026-000123",
    "sourceModule": "inscripciones",
    "eventType": "inscripcion.confirmada",
    "occurredAt": "2026-08-27T10:00:00.000-03:00",
    "payload": { "legajo": "1234", "materia": "BDD-310", "comision": "B1", "sede": "Sede Centro" }
  }'
```

Consultar lo ingerido (solo para desarrollo, se pierde al reiniciar el servidor):

```bash
curl http://localhost:3000/api/analytics/events
```

---

## Qué evento alimenta qué tablero

Propuesta de catálogo. Cada tablero necesita que el `payload` traiga **sede** y **fecha**
para poder filtrar, porque los dos filtros de la UI (sede y período) se resuelven acá.

### Tablero académico

| Módulo | `eventType` | Campos clave del payload | Alimenta |
|---|---|---|---|
| `academica` | `materia.cursada.iniciada` | `materia`, `comision`, `sede`, `cuatrimestre` | Materias en curso · Comisiones activas |
| `inscripciones` | `inscripcion.confirmada` | `legajo`, `materia`, `sede`, `cuatrimestre` | Estudiantes con cursada activa |
| `evaluaciones` | `evaluacion.registrada` | `materia`, `legajo`, `aprobado` (bool), `sede` | Tasa de aprobación general · por materia · tendencia por facultad |
| `docencia` | `docente.asignado` | `docente`, `materia`, `comision`, `sede` | Aprobación por docente |

### Tablero financiero

| Módulo | `eventType` | Campos clave del payload | Alimenta |
|---|---|---|---|
| `finanzas` | `movimiento.registrado` | `tipo` (`ingreso`/`egreso`), `monto`, `categoria`, `sede`, `fecha` | Saldo acumulado · Ingresos · Egresos · Resultado · Gastos administrativos |
| `campus` | `venta.registrada` | `producto`, `categoria`, `unidades`, `monto`, `sede` | Productos más vendidos |
| `campus` | `ticket.comedor.emitido` | `monto`, `sede` | Comedores por sede (facturación, tickets, ticket promedio) |

### Estadísticas de eventos

| Módulo | `eventType` | Campos clave del payload | Alimenta |
|---|---|---|---|
| `academica` | `evento.realizado` | `tipoEvento`, `cupo`, `inscriptos`, `sede`, `fecha` | Eventos realizados · Frecuencia por mes · Ocupación de cupo |
| `campus` | `evento.asistencia.registrada` | `tipoEvento`, `asistentes`, `sede`, `fecha` | Concurrencia · Presentismo por tipo |

`biblioteca`, `soporte` e `identidad` están habilitados como emisores pero hoy ningún
tablero consume sus eventos.

---

## Cosas a definir entre los equipos

1. **Idempotencia real.** Hoy `eventId` se guarda pero no se deduplica. Cuando haya base
   de datos tiene que ser índice único.
2. **Esquema por tipo de evento.** Ahora `payload` es un objeto libre. Convendría validar
   cada `eventType` contra su esquema.
3. **Envío por lotes.** Si el volumen lo pide, agregar `POST /api/analytics/events/batch`.
4. **Autenticación entre módulos.** No hay ninguna: el endpoint está abierto.
5. **Reintentos y orden.** Analítica no asume orden de llegada; `occurredAt` manda.
