# CLAUDE.md

Guía para Claude Code trabajando en este repo. Es el módulo **Analítica Institucional**
(Módulo 7) de **UADEnet**, un sistema universitario de 10 módulos independientes que se
integran por el bus de eventos de CORE y por REST. Este módulo recolecta esos eventos,
consulta a CORE / Backoffice / Gestión Académica y expone dashboards para dirección
académica, dirección financiera y estadísticas de eventos.

## Estado del proyecto

- **Postgres + Prisma** (`backend/prisma/`, `npm run db:up` y `db:migrate`). `DATABASE_URL` es
  obligatoria: sin ella el server no arranca. Tablas: `inbox_events` (envelope v1 tal cual llegó),
  `source_ingestions` (último evento y contadores por módulo) y `wallet_balance_snapshots`.
- **Los tableros se calculan** desde el inbox más las consultas a los otros módulos por
  **gateways** (`domain/gateways/`). Si un gateway falla, el bloque afectado sale vacío con un
  `warnings[]` (200), nunca números inventados.
- **Cada gateway tiene modo mock o real por flag** (`CORE_MOCK`, `BACKOFFICE_MOCK`,
  `ACADEMIC_MOCK`, todos `true` por defecto): el mock lee `backend/mocks/**.json` en cada llamada.
  Los otros grupos todavía no tienen todo listo, así que lo normal en desarrollo es mock.
- **Ingesta:** consumer RabbitMQ de la cola `analytics.all-events.v1` (sólo con `RABBITMQ_URL`) y
  `POST /api/analytics/events` como mock de la cola (sólo con `EVENTS_HTTP_INGEST=true`).
- **Auth:** proxy `/api/auth/*` que habla con CORE (o su mock). El token viaja como Bearer, el
  refresh va en una cookie `HttpOnly`; el rol (académica / financiera) sale de los roles de
  CORE (`ACADEMIC_ADMIN`, `FINANCE_ADMIN`, `ADMIN`) y los tableros exigen sesión y el rol correcto.
- Sedes: el catálogo sale de Backoffice y toda sede viaja como `sedeId` (el `siteId` UUID),
  nunca como nombre.
- La spec de la integración es `docs/INTEGRACION.md` (con los desvíos de lo implementado arriba
  de todo y las preguntas abiertas) y el contexto del TP y de los otros equipos es
  `CONTEXTO-UADENET.md`. Releerlos antes de asumir que algo falta o está desactualizado.

## Estructura del repo

Monorepo con dos paquetes independientes, **sin workspaces** (cada uno con su propio
`node_modules`/`package-lock.json`):

```
backend/    Node / Express 5 / TypeScript, corre con tsx (no hay .nvmrc ni "engines" fijado)
  demo/        ids y dataset determinístico compartidos por el seed, los mocks y Postman
  mocks/       JSON que devuelven los gateways en modo mock (core/, backoffice/, academic/) + README
  prisma/      schema, migraciones y demo-seed.ts
  scripts/     generadores de docs y mocks, check-mocks, backfill-from-core
frontend/   React 19 / Vite / TypeScript / Tailwind 4 / shadcn
docs/       INTEGRACION.md y la colección de Postman (docs/postman/, generada)
```

Correr los comandos siempre parados en `backend/` o `frontend/`, no desde la raíz (la raíz
no tiene scripts reales).

## Comandos

**Backend** (`cd backend`):
```
npm run dev             # tsx watch index.ts — server en :3000 (o $PORT), con hot reload
npm run build           # tsc → dist/
npm run start           # node dist/index.js (requiere build previo)
npm run db:up           # Postgres 16 en Docker (docker compose up -d)
npm run db:migrate      # prisma migrate dev
npm run db:demo         # carga el demo (~34,6 mil envelopes v1 + snapshots de saldo); re-ejecutable
npm run db:demo:clear   # borra sólo el demo
npm run mocks:generate  # regenera backend/mocks desde demo/ (no pisa ediciones; --force, --dry-run, --prune)
npm run mocks:check     # valida el shape de los mocks y que los ids de los eventos del demo existan
npm run docs            # regenera la tabla de tipos de EVENTOS.md y la colección de Postman
npm run docs:payloads   # sólo EVENTOS.md
npm run docs:postman    # sólo Postman
npm run backfill:core   # carga histórica desde GET /internal/v1/events (requiere CORE_MOCK=false)
```
`postinstall` corre `prisma generate`.

**Frontend** (`cd frontend`):
```
npm run dev       # vite dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run preview   # sirve el build de dist/
```

No hay tests configurados en ningún paquete (`npm test` es un placeholder). Si agregás
tests, actualizá esta sección.

Para probar el flujo completo hacen falta **dos terminales** (backend en :3000 y frontend con
Vite, por defecto :5173), Docker para Postgres y un `.env` en cada paquete a partir de
`.env.example`. Detalle del arranque desde cero en `README.md`.

## Arquitectura

Ambos paquetes siguen **la misma arquitectura por capas** (estilo hexagonal/clean), con
las mismas carpetas espejadas a ambos lados. Al tocar una entidad o caso de uso, revisar
si hay que actualizar la contraparte en el otro paquete.

```
domain/           Entidades, value objects, interfaces de repositorio y de gateway, servicios de dominio
                   (ej: event-catalog.ts, event-envelope-validator.service.ts)
application/      Casos de uso (un archivo por acción), servicios de aplicación y DTOs
infrastructure/   Implementaciones concretas (backend):
                     repositories/   Prisma: inbox, queries y builders de los tableros
                     integrations/   gateways por módulo: core/, backoffice/, academic/ (cada uno con
                                     impl. .http y .mock), http/ (cliente, token de servicio),
                                     mock/ (lector de mocks/), cache/ (TTL), gateways.ts (elige por flag)
                     messaging/      consumer de RabbitMQ
                     jobs/           job de snapshots del saldo de CORE
                     config/         constantes de los tableros
                   Frontend: cliente HTTP, sesión y repositorios
interfaces/       (solo backend) rutas, controllers, middleware, validators — capa HTTP
presentation/     (solo frontend) componentes, páginas, hooks, contexto de sesión
shared/           Helpers transversales (ej: config.ts con los flags, ValidationError, ProblemError)
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

- **Envelope v1 de CORE** (`specVersion`, `eventId` UUID, `eventType` `{source}.{entidad}.{acción}.v{n}`,
  `source`, `occurredAt` UTC, `data`, más `subject`, `correlationId`, `causationId`, `actor`
  opcionales). No hay contrato propio: el viejo (`sourceModule` + `payload`) se retiró.
- **`backend/src/domain/entities/event-catalog.ts` es la fuente de verdad**: define por `eventType`
  el emisor, los campos de `data`, el tratamiento (`persist`, `side-effect`, `ignore`) y los campos
  a redactar. `RecordEventUseCase` lo aplica igual por la cola y por el POST. La tabla de tipos de
  `EVENTOS.md` y la colección de Postman se generan de ahí con `npm run docs`: no se editan a mano.
- Respuestas del POST: `201 STORED`, `200 DUPLICATE`, `202 IGNORED`, `400` `problem+json` con
  `errors[]`. Idempotente por `eventId`. Sin autenticación (es el mock de la cola).
- Datos por REST: CORE (`wallets/aggregates`, auth, JWKS), Backoffice (sedes, nombres) y Gestión
  Académica (períodos, cursos, catálogo), siempre a través de las interfaces de `domain/gateways/`.
- El contrato **no está cerrado** con todos los equipos (varios eventos son «propuestos»):
  ver las preguntas abiertas en `docs/INTEGRACION.md`, sección 9.

## Convenciones de código

- TypeScript estricto en ambos paquetes. Nombres de archivo en kebab-case con sufijo por
  rol: `*.entity.ts`, `*.use-case.ts`, `*.repository.ts`, `*.gateway.ts`, `*.dto.ts`,
  `*.component.tsx`, `*.hook.ts`, `*.page.tsx`.
- Comentarios y mensajes de error (los que ve el usuario final) **en castellano**; nombres
  de variables/funciones/tipos en inglés. Seguir esa mezcla, no traducir una cosa a la otra.
- Cada carpeta de capa (`domain/`, `application/`, `shared/`, etc.) suele empezar su primer
  archivo con un comentario de una línea explicando qué va ahí — mantener esa costumbre al
  agregar carpetas nuevas.
- Frontend: componentes de UI base (shadcn) viven en `components/ui/` y no se tocan a mano
  — se regeneran con la CLI de shadcn. Componentes propios del dominio van en
  `presentation/components/`.
- Backend: toda variable de entorno se lee en `shared/config.ts` (tipada y validada al arrancar).
  CORS, `problem+json` y el manejo de errores están centralizados en `index.ts` y
  `interfaces/http/` (middleware manual, no hay librería de CORS). `EventValidationError` y
  `ValidationError` salen como 400, `ProblemError` con su status, `GatewayError` como 502/504;
  cualquier otra cae en 500.

## Al agregar funcionalidad

- Nuevo endpoint propio: DTO en `application/dtos` → caso de uso en `application/use-cases` →
  controller + ruta en `interfaces/http` → si aplica, reflejar el contrato en
  `frontend/src/domain/entities` y el cliente en `frontend/src/infrastructure/api`.
- **Nuevo evento:** entrada en `backend/src/domain/entities/event-catalog.ts` (campos, `handling`,
  `redact`, `feeds`), usarlo en la query o builder que corresponda y correr `npm run docs`
  (regenera `EVENTOS.md` y Postman). Si el evento se guarda y debe verse en el demo, sumarlo a
  `backend/demo/dataset.ts` y a `generate-postman.ts` si necesita un ejemplo propio.
- **Nuevo endpoint externo** (de CORE, Backoffice o Gestión Académica): método en la interfaz de
  `domain/gateways/` → implementación HTTP en `infrastructure/integrations/<módulo>/` (con su
  caché si corresponde) → implementación mock que lee un archivo de `backend/mocks/` → ese archivo
  y su generación en `scripts/generate-demo-mocks.ts` → `npm run mocks:generate` y
  `npm run mocks:check`. Documentar la regla de resolución en `backend/mocks/README.md`.
- Nueva variable de entorno: `shared/config.ts`, `backend/.env.example` y la tabla de
  `docs/INTEGRACION.md` sección 2.
- Datos de demo: se cargan en la base (`backend/demo/`, `npm run db:demo`), no en el código de los tableros.
