# CLAUDE.md

Guía para Claude Code trabajando en este repo. Es el módulo **Analítica Institucional**
(Módulo 7) de **UADEnet**, un sistema universitario de 10 módulos independientes que se
integran vía eventos HTTP. Este módulo recolecta esos eventos y expone dashboards para
dirección académica, dirección financiera y estadísticas de eventos.

## Estado del proyecto

- **Sin base de datos todavía** (no decidida). El backend sirve **datasets mock 1:1** con
  el diseño (`ANALISIS-DISENO.md`), con filtros de sede/período resueltos server-side.
- Todo sigue el **contrato de integración CORE v1** (2026-08-05). El flujo de datos está en
  `docs/Flujo_de_Datos_Modulo_7_Analitica.xlsx` y las dudas abiertas con otros grupos, con el
  supuesto que tomamos en cada una, en `docs/PREGUNTAS-A-GRUPOS.md`.
- Eventos: no hay ingesta propia. Consumimos el bus de CORE (cola `analytics.all-events.v1`,
  binding `#`). Sin RabbitMQ todavía, se simula con `POST /api/v1/dev/events` (sólo fuera de
  producción); el consumer deduplica por `eventId` en una inbox en memoria. **Ningún dashboard
  lee esos eventos todavía**: los dashboards salen del mock. Conectarlos es el trabajo
  pendiente cuando exista DB.
- Auth: el portal hace login contra CORE (hoy un **mock** servido por el mismo backend en
  `/api/v1/auth/*` y `/.well-known/jwks.json`). El access token es un JWT RS256 de 15 min que
  el backend valida localmente contra el JWKS; el refresh viaja en cookie HttpOnly. Se
  autoriza por **permiso** (`analytics:academic:read`, `analytics:finance:read`), no por rol de
  CORE; los perfiles `academica`/`financiera` se derivan de esos permisos. Los roles son los
  del catálogo de CORE (`ACADEMIC_ADMIN`, `FINANCE_ADMIN`, …): CORE es dueño de roles y permisos.
- Backend a backend: con el **token de servicio** de CORE (`analytics-service`, secret en
  `backend/.env`, nunca en Git). Backoffice se consulta directo a su backend, sin gateway, y las
  personas no se copian: se piden cuando hacen falta. Cada gateway usa su mock salvo que su URL
  esté configurada (ver `backend/.env.example` y `infrastructure/config.ts`).
- Sedes: el catálogo sale de un mock de Backoffice y toda sede viaja como `siteId` UUID
  (`?siteId=3e9b0a12-...`), nunca como nombre. Sin `siteId` = todas las sedes. Los
  cuatrimestres son los períodos de Gestión Académica (`termId` = id del período) y los meses viajan `AAAA-MM`.
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
```

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
                   (ej: analytics-calculator.service.ts con la lógica de cálculo pura)
application/      Casos de uso (un archivo por acción) + DTOs
infrastructure/   Implementaciones concretas: datasets mock, repos, cliente HTTP (frontend)
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

Lo que consumimos está documentado en **`backend/EVENTOS.md`** — leerlo antes de tocar
cualquier cosa relacionada a eventos. Resumen:

- Sobre estándar de CORE: `specVersion, eventId (UUID), eventType, source, occurredAt,
  subject, correlationId, causationId, actor, data`. `eventType` es el del catálogo de CORE
  (`{source}.{entidad}.{acción}.v{n}`, por ejemplo `dining.reservation.created.v1`) y `source`
  es uno de `backoffice, teacher, academic, library, dining, store, events, core`.
- `data` se valida contra `backend/src/domain/entities/event-schemas.ts`. Ese archivo es la
  fuente de verdad: la tabla de `EVENTOS.md` y la colección de Postman se generan de ahí con
  `npm run docs` (en `backend/`), no se editan a mano. Un `eventType` que no está ahí se
  confirma y se descarta (`IGNORED`).
- Convenciones de CORE que hay que respetar en todo lo que exponemos o consumimos: JSON
  camelCase, IDs UUID, fechas ISO 8601 UTC, dinero como string decimal (`"1500.00"`, nunca
  number), errores `application/problem+json` con `code`, `X-Correlation-Id` propagado.
- Rutas: el backend sirve `/api/v1/*`; por el gateway de CORE el portal las ve como
  `/api/v1/analytics/*`. Health en `/health/live` y `/health/ready`.
- El catálogo de CORE puede sumar campos opcionales dentro de v1; lo que todavía no está
  acordado con otros grupos figura como supuesto en `docs/PREGUNTAS-A-GRUPOS.md`.

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
  no hay librería de CORS). Los errores esperados son `HttpError` (`shared/http-error.ts`,
  con `status` y `code`) o su subclase `ValidationError` (400); el error handler los traduce a
  problem+json. Cualquier otra excepción cae en 500 `INTERNAL_ERROR`.

## Al agregar funcionalidad

- Nuevo endpoint: caso de uso en `application/use-cases` →
  controller + ruta en `interfaces/http` → si aplica, reflejar el contrato en
  `frontend/src/domain/entities` y el cliente en `frontend/src/infrastructure/api`.
- Nuevo dato mock: agregarlo en `backend/src/infrastructure/data/analytics.dataset.ts`
  siguiendo el mismo shape que usa `analytics-calculator.service.ts`.
- Nuevo evento consumido: agregarlo a `event-schemas.ts` con el `data` del catálogo de CORE,
  correr `npm run docs` y reflejarlo en el xlsx del flujo de datos en el mismo commit.
- Nuevo módulo externo: interfaz en `domain/gateways`, mock en
  `infrastructure/integrations/` e instancia en `infrastructure/integrations/gateways.ts`.

<!-- Dudas: si algo de acá quedó desactualizado o falta contexto, preguntame antes de asumir. -->
