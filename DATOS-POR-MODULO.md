# Datos que Analítica necesita de cada módulo

Pedido de datos para los equipos de UADEnet. Complementa `EVENTOS.md` (contrato del
envelope y catálogo de eventos). Está abierto a cambios: nada está acordado todavía.

Todos los eventos usan el mismo envelope. Los ejemplos de abajo son el formato ideal; lo
marcado como **obligatorio** es lo que los tableros no pueden calcular sin ese dato.

## Pedido común a todos los módulos

- **`eventId`** (obligatorio): estable por hecho. Si reenvían el mismo evento, tiene que llevar el mismo id para no contarlo dos veces.
- **`occurredAt`** (obligatorio): ISO 8601, cuándo ocurrió el hecho, no cuándo se envió.
- **`sourceModule`** (obligatorio): uno de los ids de la tabla de abajo. Cualquier otro valor devuelve `400`.
- **`sedeId`** (obligatorio): todos los tableros se filtran por sede y no se puede deducir. Es el id del catálogo de sedes de Backoffice (`sede.definida`), no el nombre: si el nombre cambia o viene con otra tilde, el filtro no se rompe.
- **IDs consistentes:** `alumnoId`, `cursoId`, `docenteId` y `sedeId` deben ser los mismos en todos los módulos, siempre **string** y siempre con ese nombre de campo.
- **Fechas:** `occurredAt` lleva hora y zona (`Z` o `-03:00`). Los campos de fecha de negocio sin hora (`fecha`, `fechaResultado`) se interpretan en hora de Argentina. Para asignar un hecho a un día, mes o cuatrimestre manda la fecha de negocio si existe; si no, `occurredAt`.
- **Montos:** número en ARS, sin formato de texto.

### Ids de `sourceModule`

| Módulo | `sourceModule` |
|---|---|
| 1 · Portal Estudiante | `portal-estudiante` |
| 2 · Portal Docente | `portal-docente` |
| 3 · Biblioteca | `biblioteca` |
| 4 · Comedor | `comedor` |
| 5 · Tienda | `tienda` |
| 6 · Eventos Académicos | `eventos` |
| 8 · Backoffice | `backoffice` |
| 9 · Gestión Académica | `gestion-academica` |
| 10 · CORE | `core` |

El módulo 7 es Analítica: recibe, no emite.

---

## Gestión Académica (9)

`resultado.publicado` — **formato acordado** con Gestión Académica.
Alimenta tasa de aprobación general, por materia, por cuatrimestre y por docente.

```json
{
  "eventId": "acad-res-alumno-456-curso-42",
  "sourceModule": "gestion-academica",
  "eventType": "resultado.publicado",
  "occurredAt": "2026-09-30T14:30:00Z",
  "payload": {
    "alumnoId": "alumno-456",
    "cursoId": "curso-42",
    "materia": "BDD-310",
    "comision": "B1",
    "docenteId": "docente-12",
    "sedeId": "montserrat",
    "cuatrimestre": "2026-2C",
    "notaFinal": 8.0,
    "estado": "APROBADO",
    "aprobado": true,
    "fechaResultado": "2026-09-30"
  }
}
```

Pendiente de confirmar con Académica:
- Cambios propuestos sobre el formato acordado, para alinearlo con el resto de los módulos: `docente` pasa a llamarse `docenteId`, `sede` pasa a `sedeId`, `cursoId` pasa a string y el cuatrimestre usa el formato `AAAA-NC` (`2026-2C`) que usan los tableros.
- Si `alumnoId` equivale al legajo (hoy no lo usa ningún tablero).
- Que `docenteId` sea el mismo id que el de `docente.alta` (Backoffice), del que sale el nombre.

`curso.abierto` — alimenta materias en curso, comisiones activas y tendencia por facultad.

```json
{
  "eventId": "acad-curso-42-abierto",
  "sourceModule": "gestion-academica",
  "eventType": "curso.abierto",
  "occurredAt": "2026-08-10T09:00:00Z",
  "payload": {
    "cursoId": "curso-42",
    "materia": "BDD-310",
    "nombreMateria": "Bases de Datos",
    "facultad": "Ingeniería y Tecnología",
    "comision": "B1",
    "sedeId": "montserrat",
    "cuatrimestre": "2026-2C",
    "cupo": 40
  }
}
```

Dato maestro adicional: fechas de inicio y fin de cada cuatrimestre (define qué es "en curso" y "cuatrimestre anterior").

```json
{
  "eventId": "acad-cuatrimestre-2026-2C",
  "sourceModule": "gestion-academica",
  "eventType": "cuatrimestre.definido",
  "occurredAt": "2026-06-01T12:00:00Z",
  "payload": { "cuatrimestre": "2026-2C", "inicio": "2026-08-10", "fin": "2026-12-04" }
}
```

`resultado.modificado` — corrección de una nota ya publicada. Reemplaza al `resultado.publicado` del mismo alumno y curso; sin este evento la tasa de aprobación queda con el valor viejo.

```json
{
  "eventId": "acad-res-alumno-456-curso-42-mod-1",
  "sourceModule": "gestion-academica",
  "eventType": "resultado.modificado",
  "occurredAt": "2026-10-05T11:00:00Z",
  "payload": {
    "alumnoId": "alumno-456",
    "cursoId": "curso-42",
    "notaFinal": 4.0,
    "estado": "APROBADO",
    "aprobado": true,
    "motivo": "Corrección de acta"
  }
}
```

`curso.cerrado` — el curso deja de contar como "en curso" y como comisión activa.

```json
{
  "eventId": "acad-curso-42-cerrado",
  "sourceModule": "gestion-academica",
  "eventType": "curso.cerrado",
  "occurredAt": "2026-12-04T18:00:00Z",
  "payload": { "cursoId": "curso-42", "sedeId": "montserrat", "cuatrimestre": "2026-2C" }
}
```

---

## Portal Docente (2)

`curso.creado` (opcional) — ya no hace falta para aprobación por docente: Gestión Académica manda `docenteId` en `resultado.publicado`. Sirve como respaldo del cruce `cursoId → docenteId`.

```json
{
  "eventId": "doc-curso-42-creado",
  "sourceModule": "portal-docente",
  "eventType": "curso.creado",
  "occurredAt": "2026-08-05T15:00:00Z",
  "payload": {
    "cursoId": "curso-42",
    "docenteId": "docente-12",
    "materia": "BDD-310",
    "comision": "B1",
    "sedeId": "montserrat",
    "cuatrimestre": "2026-2C"
  }
}
```

`acta.cerrada` (opcional) — segunda fuente de aprobación.

```json
{
  "eventId": "doc-acta-curso-42-alumno-456",
  "sourceModule": "portal-docente",
  "eventType": "acta.cerrada",
  "occurredAt": "2026-09-30T14:00:00Z",
  "payload": { "cursoId": "curso-42", "alumnoId": "alumno-456", "nota": 8.0, "aprobado": true }
}
```

---

## Portal Estudiante (1)

`inscripcion.confirmada` — alimenta estudiantes con cursada activa.

```json
{
  "eventId": "est-insc-alumno-456-curso-42",
  "sourceModule": "portal-estudiante",
  "eventType": "inscripcion.confirmada",
  "occurredAt": "2026-08-02T10:00:00Z",
  "payload": {
    "alumnoId": "alumno-456",
    "cursoId": "curso-42",
    "materia": "BDD-310",
    "sedeId": "montserrat",
    "cuatrimestre": "2026-2C"
  }
}
```

`inscripcion.cancelada` — baja de una materia. Descuenta de cursada activa y es la base para medir abandono.

```json
{
  "eventId": "est-baja-alumno-456-curso-42",
  "sourceModule": "portal-estudiante",
  "eventType": "inscripcion.cancelada",
  "occurredAt": "2026-09-10T16:00:00Z",
  "payload": {
    "alumnoId": "alumno-456",
    "cursoId": "curso-42",
    "sedeId": "montserrat",
    "cuatrimestre": "2026-2C",
    "motivo": "baja-voluntaria"
  }
}
```

---

## Biblioteca (3)

Hoy ningún tablero muestra uso de biblioteca. Las multas ya llegan por CORE (`origen: biblioteca`), así que este módulo solo es necesario si se suma un tablero de préstamos. Se deja el formato propuesto para no tener que definirlo después.

`prestamo.realizado` / `prestamo.devuelto` — préstamos activos, vencidos y rotación del material.

```json
{
  "eventId": "bib-prestamo-7001",
  "sourceModule": "biblioteca",
  "eventType": "prestamo.realizado",
  "occurredAt": "2026-08-25T10:00:00Z",
  "payload": {
    "prestamoId": "7001",
    "alumnoId": "alumno-456",
    "materialId": "isbn-9789875841234",
    "sedeId": "montserrat",
    "fechaVencimiento": "2026-09-08"
  }
}
```

```json
{
  "eventId": "bib-prestamo-7001-devuelto",
  "sourceModule": "biblioteca",
  "eventType": "prestamo.devuelto",
  "occurredAt": "2026-09-10T15:00:00Z",
  "payload": { "prestamoId": "7001", "sedeId": "montserrat", "conDemora": true }
}
```

---

## Eventos Académicos (6)

`tipoEvento` no figura en el TPO, pero los tableros agrupan por tipo (charla, taller, etc.).

`evento.realizado` — frecuencia y ocupación de cupo.

```json
{
  "eventId": "evt-123-realizado",
  "sourceModule": "eventos",
  "eventType": "evento.realizado",
  "occurredAt": "2026-09-15T18:00:00Z",
  "payload": {
    "eventoId": "evt-123",
    "tipoEvento": "Clases magistrales abiertas",
    "locacion": "Auditorio 1",
    "cupo": 120,
    "sedeId": "montserrat",
    "fecha": "2026-09-15",
    "costo": 0
  }
}
```

`inscripcion.confirmada` — inscriptos e ingresos por inscripción paga.

```json
{
  "eventId": "evt-123-insc-persona-77",
  "sourceModule": "eventos",
  "eventType": "inscripcion.confirmada",
  "occurredAt": "2026-09-01T11:00:00Z",
  "payload": { "eventoId": "evt-123", "personaId": "persona-77", "monto": 0 }
}
```

`asistencia.registrada` — concurrencia y presentismo (asistentes / inscriptos).

```json
{
  "eventId": "evt-123-asist-persona-77",
  "sourceModule": "eventos",
  "eventType": "asistencia.registrada",
  "occurredAt": "2026-09-15T18:05:00Z",
  "payload": { "eventoId": "evt-123", "personaId": "persona-77", "presente": true }
}
```

`evento.cancelado` — saca el evento de "realizados" y de la ocupación de cupo.

```json
{
  "eventId": "evt-123-cancelado",
  "sourceModule": "eventos",
  "eventType": "evento.cancelado",
  "occurredAt": "2026-09-14T09:00:00Z",
  "payload": { "eventoId": "evt-123", "sedeId": "montserrat", "motivo": "Disertante ausente" }
}
```

`inscripcion.cancelada` — descuenta inscriptos y, si hubo pago, el ingreso.

```json
{
  "eventId": "evt-123-baja-persona-77",
  "sourceModule": "eventos",
  "eventType": "inscripcion.cancelada",
  "occurredAt": "2026-09-12T20:00:00Z",
  "payload": { "eventoId": "evt-123", "personaId": "persona-77", "montoDevuelto": 0 }
}
```

---

## Tienda (5)

`compra.realizada` — productos más vendidos. Las devoluciones van en `compra.devuelta`.

```json
{
  "eventId": "tienda-compra-9001",
  "sourceModule": "tienda",
  "eventType": "compra.realizada",
  "occurredAt": "2026-08-20T13:20:00Z",
  "payload": {
    "compraId": "9001",
    "sedeId": "montserrat",
    "fecha": "2026-08-20",
    "total": 18500,
    "items": [
      { "producto": "Cuaderno A4 UADE", "categoria": "Librería", "unidades": 2, "monto": 8000 },
      { "producto": "Buzo con logo", "categoria": "Indumentaria", "unidades": 1, "monto": 10500 }
    ]
  }
}
```

`compra.devuelta` — resta unidades y monto de los productos devueltos. Puede ser parcial: solo trae los ítems devueltos.

```json
{
  "eventId": "tienda-devolucion-9001-1",
  "sourceModule": "tienda",
  "eventType": "compra.devuelta",
  "occurredAt": "2026-08-23T10:00:00Z",
  "payload": {
    "compraId": "9001",
    "sedeId": "montserrat",
    "fecha": "2026-08-23",
    "items": [
      { "producto": "Buzo con logo", "categoria": "Indumentaria", "unidades": 1, "monto": 10500 }
    ]
  }
}
```

---

## Comedor (4)

**A decidir:** el TPO dice que el costo se restituye si el usuario se presenta. ¿"Facturación" es lo cobrado, lo cobrado menos lo restituido, o solo las reservas no usadas?

`reserva.confirmada` — facturación, tickets, ticket promedio.

```json
{
  "eventId": "comedor-reserva-5501",
  "sourceModule": "comedor",
  "eventType": "reserva.confirmada",
  "occurredAt": "2026-08-21T11:00:00Z",
  "payload": {
    "reservaId": "5501",
    "monto": 3500,
    "sedeId": "montserrat",
    "turno": "12:30",
    "fecha": "2026-08-22"
  }
}
```

`reserva.asistida` — ajuste por restitución.

```json
{
  "eventId": "comedor-asistio-5501",
  "sourceModule": "comedor",
  "eventType": "reserva.asistida",
  "occurredAt": "2026-08-22T12:35:00Z",
  "payload": { "reservaId": "5501", "montoRestituido": 3500, "sedeId": "montserrat" }
}
```

`reserva.cancelada` — la reserva se anuló antes del turno. Sale de tickets y de facturación.

```json
{
  "eventId": "comedor-cancelada-5501",
  "sourceModule": "comedor",
  "eventType": "reserva.cancelada",
  "occurredAt": "2026-08-21T19:00:00Z",
  "payload": { "reservaId": "5501", "montoDevuelto": 3500, "sedeId": "montserrat" }
}
```

---

## Backoffice (8)

`sueldos.liquidados` — salarios dentro de gastos administrativos.

```json
{
  "eventId": "back-sueldos-2026-08-montserrat",
  "sourceModule": "backoffice",
  "eventType": "sueldos.liquidados",
  "occurredAt": "2026-08-31T20:00:00Z",
  "payload": {
    "periodo": "2026-08",
    "sedeId": "montserrat",
    "monto": 145000000,
    "desglose": { "docentes": 98000000, "administrativos": 47000000 }
  }
}
```

`gasto.registrado` — resto de gastos administrativos. **Hueco:** ningún módulo emite mantenimiento, licencias, etc. Si Backoffice no lo manda, hay que recortar las categorías del tablero.

```json
{
  "eventId": "back-gasto-3301",
  "sourceModule": "backoffice",
  "eventType": "gasto.registrado",
  "occurredAt": "2026-08-15T10:00:00Z",
  "payload": { "categoria": "Mantenimiento", "monto": 2300000, "sedeId": "montserrat", "fecha": "2026-08-15" }
}
```

`docente.alta` — nombre del docente en el tablero.

```json
{
  "eventId": "back-docente-12-alta",
  "sourceModule": "backoffice",
  "eventType": "docente.alta",
  "occurredAt": "2026-03-01T09:00:00Z",
  "payload": { "docenteId": "docente-12", "nombre": "Ana Pérez", "facultad": "Ingeniería y Tecnología" }
}
```

Dato maestro: catálogo de sedes.

```json
{
  "eventId": "back-sede-montserrat",
  "sourceModule": "backoffice",
  "eventType": "sede.definida",
  "occurredAt": "2026-01-10T09:00:00Z",
  "payload": { "sedeId": "montserrat", "nombre": "Sede Montserrat" }
}
```

---

## CORE (10)

`saldo.movimiento` — fuente más limpia para balance, ingresos, egresos y resultado. Si no trae `sedeId`, el filtro por sede del tablero financiero no puede funcionar.

`tipo`: `carga` | `cobro` | `acreditacion` | `multa` | `restitucion`. `origen`: `comedor` | `tienda` | `evento` | `biblioteca`.

```json
{
  "eventId": "core-mov-880012",
  "sourceModule": "core",
  "eventType": "saldo.movimiento",
  "occurredAt": "2026-08-20T13:20:05Z",
  "payload": {
    "cuentaId": "cuenta-alumno-456",
    "tipo": "cobro",
    "monto": 18500,
    "origen": "tienda",
    "sedeId": "montserrat",
    "fecha": "2026-08-20",
    "saldoPosterior": 41500
  }
}
```

---
## Carga inicial (todos los módulos)

Los tableros comparan contra el período anterior (cuatrimestre o mes). Si la ingesta arranca hoy, no hay contra qué comparar. Pedido: al conectarse, cada módulo manda **una sola vez** sus eventos históricos desde el inicio de 2026-1C, con el mismo formato de arriba y el `occurredAt` original. Como el `eventId` es estable, si la carga se corta se puede repetir sin duplicar.
