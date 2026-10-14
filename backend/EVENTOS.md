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
módulo va adentro de `payload`, que tiene un esquema por tipo de evento (ver
[Esquema de payloads](#esquema-de-payloads)).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventId` | `string` no vacío | sí | Identificador del evento **en el módulo emisor**. Es la clave de idempotencia: reenviar el mismo `eventId` tiene que poder repetirse sin duplicar el hecho. |
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
[`../DATOS-POR-MODULO.md`](../DATOS-POR-MODULO.md).

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
    "payload": { "alumnoId": "alumno-456", "cursoId": "curso-42", "materia": "BDD-310", "sedeId": "sede-centro", "cuatrimestre": "2026-2C" }
  }'
```

Consultar lo ingerido (solo para desarrollo, se pierde al reiniciar el servidor):

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
`src/domain/entities/event-schemas.ts`. **No editar a mano**: cambiar el esquema y regenerar.

<!-- payloads:start -->

#### `portal-estudiante`

**`inscripcion.confirmada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `alumnoId` | `string` | sí | Id del alumno. |
| `cursoId` | `string` | sí | Id del curso (string). |
| `materia` | `string` | sí | Código de la materia. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `cuatrimestre` | `string` | sí | Formato AAAA-NC, por ejemplo `2026-2C`. |

**`inscripcion.cancelada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `alumnoId` | `string` | sí | Id del alumno. |
| `cursoId` | `string` | sí | Id del curso (string). |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `cuatrimestre` | `string` | sí | Formato AAAA-NC, por ejemplo `2026-2C`. |
| `motivo` | `string` | no | Motivo de la baja. |

#### `portal-docente`

**`curso.creado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cursoId` | `string` | sí | Id del curso (string). |
| `docenteId` | `string` | sí | Id del docente (el mismo de `docente.alta`). |
| `materia` | `string` | sí | Código de la materia. |
| `comision` | `string` | no | Comisión. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `cuatrimestre` | `string` | sí | Formato AAAA-NC, por ejemplo `2026-2C`. |

**`acta.cerrada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cursoId` | `string` | sí | Id del curso (string). |
| `alumnoId` | `string` | sí | Id del alumno. |
| `nota` | `number` | no | Nota. |
| `aprobado` | `boolean` | sí | Si aprobó. |

#### `biblioteca`

**`prestamo.realizado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `prestamoId` | `string` | sí | Id del préstamo. |
| `alumnoId` | `string` | sí | Id del alumno. |
| `materialId` | `string` | sí | Id del material (ISBN). |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `fechaVencimiento` | `string` AAAA-MM-DD | no | Fecha límite de devolución. |

**`prestamo.devuelto`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `prestamoId` | `string` | sí | Id del préstamo. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `conDemora` | `boolean` | no | Si se devolvió después del vencimiento. |

#### `comedor`

**`reserva.confirmada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `reservaId` | `string` | sí | Id de la reserva. |
| `monto` | `number` | sí | Costo cobrado en ARS. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `turno` | `string` | no | Horario del turno. |
| `fecha` | `string` AAAA-MM-DD | sí | Fecha del turno. |

**`reserva.asistida`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `reservaId` | `string` | sí | Id de la reserva. |
| `montoRestituido` | `number` | sí | Monto restituido en ARS. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |

**`reserva.cancelada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `reservaId` | `string` | sí | Id de la reserva. |
| `montoDevuelto` | `number` | sí | Monto devuelto en ARS. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |

#### `tienda`

**`compra.realizada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `compraId` | `string` | sí | Id de la compra. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `fecha` | `string` AAAA-MM-DD | sí | Fecha de la compra. |
| `total` | `number` | sí | Total en ARS. |
| `items` | `array` de objetos | sí | Ítems de la compra. |
| `items[].producto` | `string` | sí | Nombre del producto. |
| `items[].categoria` | `string` | no | Categoría del producto. |
| `items[].unidades` | `number` | sí | Unidades. |
| `items[].monto` | `number` | sí | Monto en ARS. |

**`compra.devuelta`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `compraId` | `string` | sí | Id de la compra original. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `fecha` | `string` AAAA-MM-DD | sí | Fecha de la devolución. |
| `items` | `array` de objetos | sí | Ítems de la compra. |
| `items[].producto` | `string` | sí | Nombre del producto. |
| `items[].categoria` | `string` | no | Categoría del producto. |
| `items[].unidades` | `number` | sí | Unidades. |
| `items[].monto` | `number` | sí | Monto en ARS. |

#### `eventos`

**`evento.realizado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventoId` | `string` | sí | Id del evento. |
| `tipoEvento` | `string` | sí | Tipo (charla, taller, ...). |
| `locacion` | `string` | no | Locación. |
| `cupo` | `number` | sí | Cupo máximo. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `fecha` | `string` AAAA-MM-DD | sí | Fecha del evento. |
| `costo` | `number` | no | Costo de inscripción en ARS (0 si es gratis). |

**`inscripcion.confirmada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventoId` | `string` | sí | Id del evento. |
| `personaId` | `string` | sí | Id de la persona. |
| `monto` | `number` | sí | Monto pagado en ARS (0 si es gratis). |

**`asistencia.registrada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventoId` | `string` | sí | Id del evento. |
| `personaId` | `string` | sí | Id de la persona. |
| `presente` | `boolean` | sí | Si asistió. |

**`evento.cancelado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventoId` | `string` | sí | Id del evento. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `motivo` | `string` | no | Motivo. |

**`inscripcion.cancelada`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `eventoId` | `string` | sí | Id del evento. |
| `personaId` | `string` | sí | Id de la persona. |
| `montoDevuelto` | `number` | no | Monto devuelto en ARS. |

#### `backoffice`

**`sueldos.liquidados`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `periodo` | `string` | sí | Mes liquidado, formato AAAA-MM. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `monto` | `number` | sí | Total liquidado en ARS. |
| `desglose` | `object` | no | Desglose del total. |
| `desglose.docentes` | `number` | no | Sueldos docentes en ARS. |
| `desglose.administrativos` | `number` | no | Sueldos administrativos en ARS. |

**`gasto.registrado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `categoria` | `string` | sí | Categoría del gasto. |
| `monto` | `number` | sí | Monto en ARS. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `fecha` | `string` AAAA-MM-DD | sí | Fecha del gasto. |

**`docente.alta`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `docenteId` | `string` | sí | Id del docente (el mismo de `docente.alta`). |
| `nombre` | `string` | sí | Nombre completo. |
| `facultad` | `string` | no | Facultad. |

**`sede.definida`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `nombre` | `string` | sí | Nombre de la sede. |

#### `gestion-academica`

**`resultado.publicado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `alumnoId` | `string` | sí | Id del alumno. |
| `cursoId` | `string` | sí | Id del curso (string). |
| `materia` | `string` | sí | Código de la materia. |
| `comision` | `string` | no | Comisión. |
| `docenteId` | `string` | sí | Id del docente (el mismo de `docente.alta`). |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `cuatrimestre` | `string` | sí | Formato AAAA-NC, por ejemplo `2026-2C`. |
| `notaFinal` | `number` | no | Nota final. |
| `estado` | `string` | no | Situación de la materia (`APROBADO`, `DESAPROBADO`, ...). |
| `aprobado` | `boolean` | sí | Si aprobó la cursada. |
| `fechaResultado` | `string` AAAA-MM-DD | no | Fecha del resultado, hora de Argentina. |

**`resultado.modificado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `alumnoId` | `string` | sí | Id del alumno. |
| `cursoId` | `string` | sí | Id del curso (string). |
| `notaFinal` | `number` | no | Nota corregida. |
| `estado` | `string` | no | Situación corregida. |
| `aprobado` | `boolean` | sí | Si aprobó, con la corrección. |
| `motivo` | `string` | no | Motivo de la corrección. |

**`curso.abierto`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cursoId` | `string` | sí | Id del curso (string). |
| `materia` | `string` | sí | Código de la materia. |
| `nombreMateria` | `string` | no | Nombre de la materia. |
| `facultad` | `string` | no | Facultad. |
| `comision` | `string` | no | Comisión. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `cuatrimestre` | `string` | sí | Formato AAAA-NC, por ejemplo `2026-2C`. |
| `cupo` | `number` | no | Cupo máximo. |

**`curso.cerrado`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cursoId` | `string` | sí | Id del curso (string). |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `cuatrimestre` | `string` | sí | Formato AAAA-NC, por ejemplo `2026-2C`. |

**`cuatrimestre.definido`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cuatrimestre` | `string` | sí | Formato AAAA-NC, por ejemplo `2026-2C`. |
| `inicio` | `string` AAAA-MM-DD | sí | Primer día del cuatrimestre. |
| `fin` | `string` AAAA-MM-DD | sí | Último día del cuatrimestre. |

#### `core`

**`saldo.movimiento`**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `cuentaId` | `string` | sí | Id de la cuenta institucional. |
| `tipo` | enum (`carga`, `cobro`, `acreditacion`, `multa`, `restitucion`) | sí | Tipo de movimiento. |
| `monto` | `number` | sí | Monto en ARS. |
| `origen` | enum (`comedor`, `tienda`, `evento`, `biblioteca`) | sí | Módulo que originó el movimiento. |
| `sedeId` | `string` | sí | Id de la sede en el catálogo de Backoffice. |
| `fecha` | `string` AAAA-MM-DD | sí | Fecha del movimiento. |
| `saldoPosterior` | `number` | no | Saldo de la cuenta después del movimiento. |

<!-- payloads:end -->

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
2. **Versionado del esquema.** Los payloads ya se validan por tipo de evento; falta definir
   cómo se versiona un cambio de campos sin romper a los módulos que ya emiten.
3. **Envío por lotes.** Si el volumen lo pide, agregar `POST /api/analytics/events/batch`.
4. **Autenticación entre módulos.** No hay ninguna: el endpoint está abierto.
5. **Reintentos y orden.** Analítica no asume orden de llegada; `occurredAt` manda.
