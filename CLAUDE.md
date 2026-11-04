# CLAUDE.md

Guía para Claude Code trabajando en este repo. Es el módulo **Analítica Institucional**
(Módulo 7) de **UADEnet**, un sistema universitario de 10 módulos independientes que se
integran vía eventos HTTP. Este módulo recolecta esos eventos y expone dashboards para
dirección académica, dirección financiera y estadísticas de eventos.

## Estado del proyecto

- **Postgres + Prisma** (rama `feature/db-postgres`): la ingesta (`POST /api/analytics/events`)
  persiste en la tabla `inbox_events` con **idempotencia por `eventId`** (un `eventId`
  repetido se ignora y responde igual que la primera vez).
- **No hay datos mock**: todos los tableros, KPIs y catálogos salen de `inbox_events`. Lo que
  no tiene eventos se ve vacío o en cero, nunca con números inventados. Las queries están en
  `backend/src/infrastructure/repositories/queries/` y cada tablero lo arma un *builder* en
  `repositories/builders/` (filtros de sede/período server-side). Los deltas comparan contra
  el período anterior del catálogo; sin período anterior o sin datos en él, son neutros.
- **`DATABASE_URL` es obligatoria**: sin ella el server no arranca (error claro en castellano).
  Si la DB falla en una request, responde 500 por el error handler.
- Catálogos desde eventos: sedes = `backoffice` / `sede.definida` (más "Todas las sedes",
  `todas-las-sedes`, siempre primera); cuatrimestres = todo `payload.cuatrimestre` de cualquier
  evento; meses = meses (hora de Argentina) de `occurred_at`. Con la base vacía los filtros
  devuelven el período actual según la fecha de hoy. Roles y etiquetas de módulos son
  configuración (`domain/entities`), y colores/categorías de tableros viven en
  `infrastructure/config/dashboard.config.ts`.
- Auth: login con mail `@uade.edu.ar` contra un **mock de CORE** (`/api/auth`, gateway en
  `backend/src/infrastructure/integrations/`). Es el único mock que queda: es autenticación, no
  datos de tableros. El token viaja como Bearer y el rol (académica / financiera) lo define
  CORE; los tableros exigen sesión y el rol correcto.
- Sedes: toda sede viaja como `sedeId` (`?sedeId=sede-centro`), nunca como nombre.
- Antes de asumir que algo falta o está desactualizado, releer `ANALISIS-DISENO.md` — es
  la auditoría viva del proyecto y puede tener notas más recientes que esta guía.

## Estructura del repo

Monorepo con dos paquetes independientes, **sin workspaces** (cada uno con su propio
`node_modules`/`package-lock.json`):

```
backend/    Node / Express 5 / TypeScript, corre con tsx (no hay .nvmrc ni "engines" fijado)
frontend/   React 19 / Vite / TypeScript / Tailwind 4 / shadcn
```

Correr los comandos siempre parados en `backend/` o `frontend/`, no desde la raíz (la raíz
no tiene scripts reales).

## Comandos

**Backend** (`cd backend`):
```
npm run dev     # tsx watch index.ts — server en :3000 (o $PORT), con hot reload
npm run build   # tsc → dist/
npm run start   # node dist/index.js (requiere build previo)
npm run db:up       # docker compose up -d — Postgres 16 local (:5432)
npm run db:migrate  # prisma migrate dev — aplica las migraciones
npm run db:seed     # eventos de ejemplo (re-ejecutable, upsert por eventId; incluye sede.definida y cuatrimestre.definido)
npm run docs        # regenera la tabla de payloads de EVENTOS.md y la colección de Postman
```
La config va en `backend/.env` (no se commitea): copiar `backend/.env.example` y ajustar
`DATABASE_URL`. Es obligatoria: sin ella el backend no arranca.

**Frontend** (`cd frontend`):
```
npm run dev       # vite dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run preview   # sirve el build de dist/
```

No hay tests configurados en ningún paquete (`npm test` es un placeholder). Si agregás
tests, actualizá esta sección.

Para probar el flujo completo hacen falta **dos terminales**: backend en :3000 y frontend
con Vite (por defecto :5173), el frontend consume el backend por HTTP.

## Arquitectura

Ambos paquetes siguen **la misma arquitectura por capas** (estilo hexagonal/clean), con
las mismas carpetas espejadas a ambos lados. Al tocar una entidad o caso de uso, revisar
si hay que actualizar la contraparte en el otro paquete.

```
domain/           Entidades, value objects, interfaces de repositorio, servicios de dominio
                   (ej: period-catalog.service.ts con la lógica de catálogos de períodos)
application/      Casos de uso (un archivo por acción) + DTOs
infrastructure/   Implementaciones concretas: repos Prisma, queries y builders de tableros, config, gateways (mock de CORE), cliente HTTP (frontend)
interfaces/       (solo backend) rutas, controllers, validators — capa HTTP
presentation/     (solo frontend) componentes, páginas, hooks, contexto de sesión
shared/           Helpers transversales (ej: ValidationError)
```

Reglas de dependencia: `domain` no depende de nada. `application` depende de `domain`.
`infrastructure` implementa las interfaces de `domain`. `interfaces`/`presentation`
orquestan casos de uso, nunca hablan directo con `infrastructure`.

**`frontend/src/domain/entities/analytics.entity.ts` es una copia manual del contrato del
backend** (no hay paquete compartido). Si cambiás una entidad en `backend/src/domain/entities/`,
replicá el cambio ahí a mano.

## Integración con los otros módulos de UADEnet

El contrato de ingesta está documentado en **`backend/EVENTOS.md`** — leerlo antes de
tocar cualquier cosa relacionada a eventos. Resumen:

- `POST /api/analytics/events` — envelope común: `eventId`, `sourceModule` (enum de 9
  módulos: `portal-estudiante, portal-docente, biblioteca, comedor, tienda, eventos,
  backoffice, gestion-academica, core`), `eventType` (`sustantivo.verbo`), `occurredAt` (ISO 8601), `payload`
  validado por tipo de evento contra `backend/src/domain/entities/event-schemas.ts`. Ese
  archivo es la fuente de verdad: la tabla de tipos de `EVENTOS.md` y la colección de
  Postman se generan de ahí con `npm run docs` (en `backend/`), no se editan a mano.
- El contrato **está abierto a cambios** — todavía no se acordó formalmente entre los
  equipos de los 10 módulos. No asumir que es definitivo.
- Sin autenticación entre módulos (la ingesta es pública), idempotente por `eventId` (si hay DB), sin envío
  por lotes.

## Convenciones de código

- TypeScript estricto en ambos paquetes. Nombres de archivo en kebab-case con sufijo por
  rol: `*.entity.ts`, `*.use-case.ts`, `*.repository.ts`, `*.dto.ts`, `*.component.tsx`,
  `*.hook.ts`, `*.page.tsx`.
- Comentarios y mensajes de error (los que ve el usuario final) **en castellano**; nombres
  de variables/funciones/tipos en inglés. Seguir esa mezcla, no traducir una cosa a la otra.
- Cada carpeta de capa (`domain/`, `application/`, `shared/`, etc.) suele empezar su primer
  archivo con un comentario de una línea explicando qué va ahí — mantener esa costumbre al
  agregar carpetas nuevas.
- Frontend: componentes de UI base (shadcn) viven en `components/ui/` y no se tocan a mano
  — se regeneran con la CLI de shadcn. Componentes propios del dominio van en
  `presentation/components/`.
- Backend: CORS y manejo de errores están centralizados en `index.ts` (middleware manual,
  no hay librería de CORS). `ValidationError` es la única excepción que el error handler
  traduce a 400; cualquier otra cae en 500.

## Al agregar funcionalidad

- Nuevo endpoint: DTO en `application/dtos` → caso de uso en `application/use-cases` →
  controller + ruta en `interfaces/http` → si aplica, reflejar el contrato en
  `frontend/src/domain/entities` y el cliente en `frontend/src/infrastructure/api`.
- Nueva métrica o dato de un tablero: query en `infrastructure/repositories/queries/` sobre
  `inbox_events` y armado en el builder del tablero (`repositories/builders/`). No se agregan
  datos fijos: si el evento no existe, se define primero en `event-schemas.ts` y `EVENTOS.md`.
  Para una demo, cargar eventos en la base (`prisma/seed.ts`), no código.
- Cambios al contrato de eventos: actualizar `backend/EVENTOS.md` en el mismo commit —
  es la referencia que van a leer los otros equipos de UADEnet.

<!-- Dudas: si algo de acá quedó desactualizado o falta contexto, preguntame antes de asumir. -->
