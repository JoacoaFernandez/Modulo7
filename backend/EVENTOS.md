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

`portal-estudiante` · `portal-docente` · `biblioteca` · `comedor` · `tienda` · `eventos` ·
`backoffice` · `gestion-academica` · `core`

Son los 9 módulos del TPO que emiten eventos (todos menos Analítica, que es el 7), y los que
la UI muestra como "fuentes de eventos". Cualquier otro valor devuelve `400`. El detalle de
qué campos pedimos a cada uno está en `DATOS-POR-MODULO.md`.

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
    "sourceModule": "portal-estudiante",
    "eventType": "inscripcion.confirmada",
    "occurredAt": "2026-08-27T10:00:00.000-03:00",
    "payload": { "alumnoId": "alumno-456", "cursoId": 42, "materia": "BDD-310", "sede": "Sede Centro", "cuatrimestre": "2026-2Q" }
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
| `gestion-academica` | `curso.abierto` | `cursoId`, `materia`, `nombreMateria`, `facultad`, `comision`, `sede`, `cuatrimestre`, `cupo` | Materias en curso · Comisiones activas · Tendencia por facultad |
| `gestion-academica` | `resultado.publicado` | `alumnoId`, `cursoId`, `materia`, `sede`, `cuatrimestre`, `estado` o `aprobado`, `notaFinal` | Tasa de aprobación general · por materia · por cuatrimestre |
| `portal-docente` | `curso.creado` | `cursoId`, `docenteId`, `materia`, `comision`, `sede`, `cuatrimestre` | Aprobación por docente (cruce `cursoId → docenteId`) |
| `portal-estudiante` | `inscripcion.confirmada` | `alumnoId`, `cursoId`, `materia`, `sede`, `cuatrimestre` | Estudiantes con cursada activa |
| `backoffice` | `docente.alta` | `docenteId`, `nombre`, `facultad` | Nombre del docente en el tablero |

### Tablero financiero

| Módulo | `eventType` | Campos clave del payload | Alimenta |
|---|---|---|---|
| `core` | `saldo.movimiento` | `tipo` (`carga`/`cobro`/`acreditacion`/`multa`/`restitucion`), `monto`, `origen` (`comedor`/`tienda`/`evento`/`biblioteca`), `sede`, `fecha`, `saldoPosterior` | Saldo acumulado · Ingresos · Egresos · Resultado |
| `backoffice` | `sueldos.liquidados` | `periodo`, `monto`, `sede`, desglose docente/administrativo | Gastos administrativos (salarios) |
| `backoffice` | `gasto.registrado` | `categoria`, `monto`, `sede`, `fecha` | Gastos administrativos (resto de categorías) — **a acordar** |
| `tienda` | `compra.realizada` | `compraId`, `sede`, `fecha`, `total`, `items[] { producto, categoria, unidades, monto }` | Productos más vendidos |
| `comedor` | `reserva.confirmada` | `monto`, `sede`, `turno`, `fecha` | Comedores por sede (facturación, tickets, ticket promedio) |
| `comedor` | `reserva.asistida` | `reservaId`, `monto` restituido, `sede` | Ajuste de facturación (el costo se restituye si se presenta) |
| `biblioteca` | `multa.aplicada` | `monto`, `sede`, `fecha` | Ingresos (menor, opcional) |

### Estadísticas de eventos

| Módulo | `eventType` | Campos clave del payload | Alimenta |
|---|---|---|---|
| `eventos` | `evento.realizado` | `eventoId`, `tipoEvento`, `locacion`, `cupo`, `sede`, `fecha`, `costo` | Eventos realizados · Frecuencia por mes · Ocupación de cupo |
| `eventos` | `inscripcion.confirmada` | `eventoId`, `personaId`, `monto` | Inscriptos · ingresos por inscripción paga |
| `eventos` | `asistencia.registrada` | `eventoId`, `personaId`, `presente` | Concurrencia · Presentismo por tipo |

> **Nota:** `eventType` es único por módulo emisor, no global: `inscripcion.confirmada` lo
> pueden mandar `portal-estudiante` y `eventos`, y se distinguen por `sourceModule`.

---

## Cosas a definir entre los equipos

1. **Idempotencia real.** Hoy `eventId` se guarda pero no se deduplica. Cuando haya base
   de datos tiene que ser índice único.
2. **Esquema por tipo de evento.** Ahora `payload` es un objeto libre. Convendría validar
   cada `eventType` contra su esquema.
3. **Envío por lotes.** Si el volumen lo pide, agregar `POST /api/analytics/events/batch`.
4. **Autenticación entre módulos.** No hay ninguna: el endpoint está abierto.
5. **Reintentos y orden.** Analítica no asume orden de llegada; `occurredAt` manda.
