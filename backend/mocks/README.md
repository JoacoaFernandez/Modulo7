# Mocks de integración

Con `CORE_MOCK`, `BACKOFFICE_MOCK` y `ACADEMIC_MOCK` en `true` (por defecto) los gateways leen estos archivos en lugar de llamar a los otros módulos. Especificación completa: `docs/INTEGRACION.md`, sección 5.

Los archivos están pensados para **editarse a mano**: cada uno es literalmente el body JSON de la respuesta del módulo real.

## Cómo se resuelven los parámetros

Cada archivo se lee **en cada llamada** (sin caché ni watcher): editar un `.json` se ve en el siguiente request, sin reiniciar el backend.

| Endpoint simulado | Archivo | Si el archivo no existe |
|---|---|---|
| CORE `wallets/aggregates?from=2026-10-01&to=…` | `core/wallets-aggregates/2026-10.json` (mes de `from`; se devuelve tal cual aunque `to` sea parcial) | `core/wallets-aggregates/_empty.json` si existe; si no, una respuesta vacía (`walletCount: 0`) |
| CORE login | `core/users.json` | error de configuración (500) |
| Backoffice `sites` | `backoffice/sites.json` (siempre completo, sin paginar) | error de configuración (500) |
| Backoffice `users/{userId}` | `backoffice/users/<userId>.json` | `404 RESOURCE_NOT_FOUND` |
| G9 `periodos`, `sedes`, `carreras` | `academic/periodos.json`, `sedes.json`, `carreras.json` | error de configuración (500) |
| G9 `carreras/{id}/planes` | `academic/planes/<carreraId>.json` | `404 RESOURCE_NOT_FOUND` |
| G9 `planes/{id}/asignaturas` | `academic/asignaturas/<planId>.json` | lista vacía |
| G9 `cursos?periodoId=8` | `academic/cursos/8.json` | lista vacía |
| G9 `cursos/{id}` | `academic/curso-detalle/<cursoId>.json` | `404 RESOURCE_NOT_FOUND` |

Las claves de archivo sólo aceptan letras, números, `_` y `-`. Un JSON mal formado da `500` con la ruta del archivo en el mensaje.

## Simular una falla (`__mockStatus`)

Un archivo puede ser, en lugar del body, esto:

```json
{ "__mockStatus": 503, "__mockBody": { "code": "SERVICE_UNAVAILABLE", "detail": "G9 no responde" } }
```

El mock responde ese status y el tablero afectado sale con el bloque vacío (`—`) y un `warnings[]`, no con un 500. Por ejemplo, ponelo en `academic/cursos/8.json` y mirá el tablero académico. Acordate de restaurar el archivo (`npm run mocks:generate -- --force` lo regenera, ver abajo).

## Qué hay en el demo

Los mocks y los eventos del demo (`npm run db:demo`) salen de los mismos ids (`backend/demo/ids.ts`), así que se ven coherentes en los tres tableros:

- **Sedes** (Backoffice): Monserrat, Belgrano, Pilar, Campus Online y Rosario (`INACTIVE`: no aparece en el filtro de sedes). Campus Online no tiene comedor: sale como «Sin reservas de comedor registradas». G9 conoce las cuatro activas con `backofficeSiteId`.
- **Períodos**: 2024-1C a 2026-2C (ids 3 a 8). Todos tienen cursos con `inscriptosActivos`; los cuatro primeros cerrados y 2026-2C en curso, con un tercio de los cursos ya finalizados (promoción directa) y resultados publicados.
- **Académico**: 5 carreras con 5 facultades, 7 planes (el plan viejo `ISI-2020` repite 4 materias con otro id y el mismo código; `ISI-2027` está `PLANIFICADO` y no tiene archivo de asignaturas), 32 materias, cursos `CANCELADO` y docentes `TITULAR` y `AUXILIAR`.
- **Detalle de curso**: unos pocos cursos no traen `docentes` en el listado y se resuelven con `curso-detalle/<id>.json`; uno no tiene ficha (`404`) y no se atribuye a ningún docente.
- **CORE `wallets-aggregates`**: marzo a noviembre de 2026, con `outstandingBalance` creciente. Los conceptos de tienda, comedor y eventos suman lo mismo que los eventos del demo; el resto (cargas, sueldos, becas, multas, devoluciones) es inventado. Noviembre es un mes **parcial** (hoy es 5/11): sin sueldos todavía, así que el mes en curso muestra ingresos y egresos chicos; para ver el tablero financiero con valores de mes completo, elegí otro mes (por ejemplo Oct 2026), o editá `2026-11.json`.

## Usuarios de prueba (`core/users.json`)

Contraseña de todos: `uadenet2026` (es de demo; no son credenciales reales de CORE).

| Mail | Rol de CORE | Sección de Analítica |
|---|---|---|
| `direccion.academica@uade.edu.ar` | `ACADEMIC_ADMIN` | académica (tablero académico y eventos) |
| `direccion.financiera@uade.edu.ar` | `FINANCE_ADMIN` | financiera |
| `direccion.general@uade.edu.ar` | `ADMIN` | ambas |
| `alumno.demo@uade.edu.ar` | `STUDENT` | ninguna: `403 ANALYTICS_FORBIDDEN` |
| `suspendido.demo@uade.edu.ar` | `ACADEMIC_ADMIN` con `status: SUSPENDED` | `403 AUTH_IDENTITY_SUSPENDED` |

El JWT del login mock se firma con un par RSA local en `backend/.mock-keys/` (se crea solo, no se versiona).

## Regenerar y verificar

Estos archivos se generan con `npm run mocks:generate` (script `scripts/generate-demo-mocks.ts`, desde `backend/demo/ids.ts` y el dataset de `backend/demo/dataset.ts`). El script **no pisa tus ediciones a mano**: si algún archivo existente difiere de lo que generaría, no escribe nada, lista cuáles son y pide `--force`.

```
npm run mocks:generate                      # escribe sólo si no hay archivos editados
npm run mocks:generate -- --dry-run         # informa qué haría
npm run mocks:generate -- --force           # sobrescribe los archivos que difieren
npm run mocks:generate -- --force --prune   # además borra archivos de las carpetas generadas que ya no corresponden
npm run mocks:check                         # valida el shape de cada archivo y que los ids referenciados existan
```

`mocks:check` falla si un `asignaturaId`, `sedeId`, `docenteId` o `periodoId` de los mocks no existe, si un `courseId`, `subjectId`, `periodId` o `siteId` de los eventos del demo no está en los mocks, o si un docente de un curso no tiene ficha en `backoffice/users/`. Correlo después de editar a mano.

Si cambiás el dataset del demo (`demo/dataset.ts` o `demo/ids.ts`): regenerá los mocks, y para recargar los eventos corré `npm run db:demo:clear && npm run db:demo` (los `eventId` salen de claves estables: un evento que cambia de contenido pero no de clave no se reinserta sin borrar antes).
