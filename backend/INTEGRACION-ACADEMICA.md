# Integración con Gestión Académica — diferencias y cómo tratarlas

Comparación entre el evento que manda el módulo de Gestión Académica y el contrato de
ingesta de Analítica (`EVENTOS.md`). Sirve como checklist para acordar con ese equipo y
para decidir qué absorbemos nosotros.

## Evento recibido

```json
{
  "tipo": "academica.resultado.publicado",
  "ocurridoEn": "2026-09-30T14:30:00Z",
  "alumnoId": "alumno-456",
  "cursoId": 42,
  "notaFinal": 8.0,
  "estado": "APROBADO",
  "fechaResultado": "2026-09-30",
  "enlace": "/alumnos/cursos/42"
}
```

**Veredicto:** no cumple el contrato. Hoy el backend lo rechaza con `400`
(`"sourceModule" inválido...`, que es la primera validación que falla en
`parseRecordEventDto`).

## Diferencias

| # | Ellos mandan | Nosotros esperamos | Tipo | Cómo tratarla |
|---|---|---|---|---|
| 1 | `tipo: "academica.resultado.publicado"` | `sourceModule` + `eventType` separados | Estructura | **Adaptar (nosotros).** Cortar en el primer punto: `academica` → `sourceModule: "gestion-academica"` (alias del prefijo), `resultado.publicado` → `eventType`. Si el prefijo no está en `SOURCE_MODULES`, `400`. |
| 2 | `ocurridoEn` | `occurredAt` | Nombre | **Adaptar (nosotros).** Alias directo; después pasa por `requireTimestamp`. El valor recibido es ISO 8601 válido. |
| 3 | Campos sueltos en la raíz | Todo dentro de `payload` | Estructura | **Adaptar (nosotros).** Lo que no sea envelope (`tipo`, `ocurridoEn`, `eventId`, `sourceModule`, `eventType`, `occurredAt`, `payload`) pasa a `payload`. |
| 4 | Sin `eventId` | `eventId` obligatorio | Dato faltante | **Pedirles a ellos** (lo correcto). Como respaldo, derivarlo con un hash determinístico y marcarlo provisorio. |
| 5 | Sin `sourceModule` | Obligatorio | Dato faltante | Se resuelve con el punto 1. |
| 6 | `cursoId: 42` (número) | `materia` (texto, ej. `BDD-310`) | Dato distinto | **Pedirles a ellos** que agreguen `materia`, o acordar un mapeo `cursoId → materia`. No se puede inventar. |
| 7 | Sin `sede` | `sede` en el `payload` | Dato faltante | **Pedirles a ellos.** No se puede deducir. Sin esto no entra a los filtros por sede. |
| 8 | `estado: "APROBADO"` | `aprobado` (boolean) | Formato | **Adaptar (nosotros)** al calcular: `aprobado = estado === "APROBADO"`. No hace falta tocar la ingesta. |
| 9 | `alumnoId: "alumno-456"` | `legajo` | Nombre / posible dato distinto | **Acordar.** No sabemos si `alumnoId` equivale al legajo. Mientras tanto queda en el `payload` tal cual. |
| 10 | `resultado.publicado` | El catálogo espera `evaluacion.registrada` | Semántica | **Acordar entre equipos.** Sumarlo al catálogo de `EVENTOS.md` (recomendado) o que usen el nombre existente. |
| 11 | `notaFinal`, `fechaResultado` | No están en el catálogo | Extra | **Dejar.** Entran en `payload` sin problema. |
| 12 | `enlace: "/alumnos/cursos/42"` | No se usa | Extra | **Ignorar.** Viaja en el `payload` sin molestar. |

## Resumen por responsable

**Lo absorbemos nosotros** (puntos 1, 2, 3 y 8): una función de normalización en
`parseRecordEventDto`, antes de las validaciones actuales. Es barato y no cambia el contrato.

**Se lo pedimos a ellos** (puntos 4, 6 y 7): `eventId`, `materia` y `sede`. Sin eso el
evento se acepta pero no sirve para los tableros.

**Se acuerda entre equipos** (puntos 9 y 10): si `alumnoId` es el legajo y cómo se llama el
evento. Con la respuesta se actualiza `EVENTOS.md`.

## Lo que no conviene hacer

- Generar `eventId` con un UUID aleatorio: rompe la idempotencia, cada reenvío sería un
  evento nuevo.
- Crear un endpoint o validador especial por módulo: son 9 módulos, sería inmanejable.
  Una única capa de normalización alcanza.

## Cómo quedaría el evento normalizado

```json
{
  "eventId": "<el que manden, o derivado como respaldo>",
  "sourceModule": "gestion-academica",
  "eventType": "resultado.publicado",
  "occurredAt": "2026-09-30T14:30:00Z",
  "payload": {
    "alumnoId": "alumno-456",
    "cursoId": 42,
    "notaFinal": 8.0,
    "estado": "APROBADO",
    "fechaResultado": "2026-09-30",
    "enlace": "/alumnos/cursos/42"
  }
}
```

## Cómo debería mandarlo Académica (formato ideal)

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
    "sede": "Sede Centro",
    "notaFinal": 8.0,
    "estado": "APROBADO",
    "aprobado": true,
    "fechaResultado": "2026-09-30"
  }
}
```

## Pendientes

- [ ] Implementar la normalización (puntos 1, 2, 3 y respaldo del 4) en
      `backend/src/interfaces/http/validators/analytics.validator.ts`.
- [ ] Documentar en `EVENTOS.md` los formatos tolerados, aclarando que el oficial es el
      estricto.
- [ ] Pedir a Académica: `eventId`, `materia`, `sede`.
- [ ] Acordar: equivalencia `alumnoId` ↔ `legajo` y nombre del evento
      (`resultado.publicado` vs `evaluacion.registrada`).
