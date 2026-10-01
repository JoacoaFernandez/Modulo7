# Datos que Analítica necesita de cada módulo

Pedido de datos para los equipos de UADEnet. Complementa `EVENTOS.md` (contrato del
envelope y catálogo de eventos). Está abierto a cambios: nada está acordado todavía.

Todos los eventos usan el mismo envelope. Los ejemplos de abajo son el formato ideal; lo
marcado como **obligatorio** es lo que los tableros no pueden calcular sin ese dato.

## Pedido común a todos los módulos

- **`eventId`** (obligatorio): estable por hecho. Si reenvían el mismo evento, tiene que llevar el mismo id para no contarlo dos veces.
- **`occurredAt`** (obligatorio): ISO 8601, cuándo ocurrió el hecho, no cuándo se envió.
- **`sede`** (obligatorio): todos los tableros se filtran por sede y no se puede deducir. Ideal: el nombre/id del catálogo de sedes de Backoffice.
- **IDs consistentes:** `alumnoId`, `cursoId`, `docenteId` y `sedeId` deben ser los mismos en todos los módulos.
- **Montos:** número en ARS, sin formato de texto.

---

## Gestión Académica (9)

`resultado.publicado` — obligatorios: `materia`, `sede`, `cuatrimestre`, `estado` o `aprobado`.
Alimenta tasa de aprobación general, por materia y por cuatrimestre.

```json
{
  "eventId": "acad-res-alumno-456-curso-42",
  "sourceModule": "gestion-academica",
  "eventType": "resultado.publicado",
  "occurredAt": "2026-09-30T14:30:00Z",
  "payload": {
    "alumnoId": "alumno-456",
    "cursoId": 42,
    "materia": "BDD-310",
    "sede": "Sede Montserrat",
    "cuatrimestre": "2026-2Q",
    "notaFinal": 8.0,
    "estado": "APROBADO",
    "aprobado": true,
    "fechaResultado": "2026-09-30"
  }
}
```

`curso.abierto` — alimenta materias en curso, comisiones activas y tendencia por facultad.

```json
{
  "eventId": "acad-curso-42-abierto",
  "sourceModule": "gestion-academica",
  "eventType": "curso.abierto",
  "occurredAt": "2026-08-10T09:00:00Z",
  "payload": {
    "cursoId": 42,
    "materia": "BDD-310",
    "nombreMateria": "Bases de Datos",
    "facultad": "Ingeniería y Tecnología",
    "comision": "B1",
    "sede": "Sede Montserrat",
    "cuatrimestre": "2026-2Q",
    "cupo": 40
  }
}
```

Dato maestro adicional: fechas de inicio y fin de cada cuatrimestre (define qué es "en curso" y "cuatrimestre anterior").

```json
{
  "eventId": "acad-cuatrimestre-2026-2Q",
  "sourceModule": "gestion-academica",
  "eventType": "cuatrimestre.definido",
  "occurredAt": "2026-06-01T12:00:00Z",
  "payload": { "cuatrimestre": "2026-2Q", "inicio": "2026-08-10", "fin": "2026-12-04" }
}
```

---

## Portal Docente (2)

`curso.creado` — reemplaza el dato de docente que Gestión Académica no tiene. Alimenta aprobación por docente (cruce `cursoId → docenteId`). **Confirmar que `cursoId` es el mismo que usa Gestión Académica.**

```json
{
  "eventId": "doc-curso-42-creado",
  "sourceModule": "portal-docente",
  "eventType": "curso.creado",
  "occurredAt": "2026-08-05T15:00:00Z",
  "payload": {
    "cursoId": 42,
    "docenteId": "docente-12",
    "materia": "BDD-310",
    "comision": "B1",
    "sede": "Sede Montserrat",
    "cuatrimestre": "2026-2Q"
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
  "payload": { "cursoId": 42, "alumnoId": "alumno-456", "nota": 8.0, "aprobado": true }
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
    "cursoId": 42,
    "materia": "BDD-310",
    "sede": "Sede Montserrat",
    "cuatrimestre": "2026-2Q"
  }
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
    "sede": "Sede Montserrat",
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

---

## Tienda (5)

`compra.realizada` — productos más vendidos. Si hay devoluciones, pedir un evento aparte.

```json
{
  "eventId": "tienda-compra-9001",
  "sourceModule": "tienda",
  "eventType": "compra.realizada",
  "occurredAt": "2026-08-20T13:20:00Z",
  "payload": {
    "compraId": "9001",
    "sede": "Sede Montserrat",
    "fecha": "2026-08-20",
    "total": 18500,
    "items": [
      { "producto": "Cuaderno A4 UADE", "categoria": "Librería", "unidades": 2, "monto": 8000 },
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
    "sede": "Sede Montserrat",
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
  "payload": { "reservaId": "5501", "montoRestituido": 3500, "sede": "Sede Montserrat" }
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
    "sede": "Sede Montserrat",
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
  "payload": { "categoria": "Mantenimiento", "monto": 2300000, "sede": "Sede Montserrat", "fecha": "2026-08-15" }
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

`saldo.movimiento` — fuente más limpia para balance, ingresos, egresos y resultado. Si no trae `sede`, el filtro por sede del tablero financiero no puede funcionar.

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
    "sede": "Sede Montserrat",
    "fecha": "2026-08-20",
    "saldoPosterior": 41500
  }
}
```

---

## Biblioteca (3) — opcional

`multa.aplicada` — ingreso menor.

```json
{
  "eventId": "bib-multa-210",
  "sourceModule": "biblioteca",
  "eventType": "multa.aplicada",
  "occurredAt": "2026-08-25T09:00:00Z",
  "payload": { "alumnoId": "alumno-456", "monto": 1500, "sede": "Sede Montserrat", "fecha": "2026-08-25" }
}
```
