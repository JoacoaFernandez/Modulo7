# Contexto UADEnet — referencia única del TP y del ecosistema (Módulo 7 · Analítica)

> Reemplaza a `TPOUADENET.md`, `DATOS-POR-MODULO.md`, `ANALISIS-DISENO.md`, `prototipo.md` y
> `backend/INTEGRACION-ACADEMICA.md` (ya borrados). Consolidado el **2026-11-04** a partir de la consigna, el contrato y las novedades de CORE, los xlsx de
> flujos de datos de cada equipo y el Trello de POs; la sección «Estado de implementación» se agregó el **2026-11-05**. El README sigue siendo
> la documentación de nuestro módulo; el contrato de ingesta que implementa el backend está en
> [`backend/EVENTOS.md`](backend/EVENTOS.md) (tabla de tipos generada por script desde
> `backend/src/domain/entities/event-catalog.ts`) y la especificación técnica de la integración en
> [`docs/INTEGRACION.md`](docs/INTEGRACION.md).

## Cómo leer este documento

**Prioridad de fuentes** (de mayor a menor; si dos se contradicen manda la de arriba y se
dice explícitamente):

1. Novedades de CORE del 2026-11-04 (PDF «CORE G10 · Novedades», compartido por el equipo de CORE).
2. Trello, xlsx de los equipos y consigna, según la fecha de cada uno.
3. Contrato de integración de CORE v1 del 2026-08-05 ([`docs/CORE-contrato-integracion-v1.md`](docs/CORE-contrato-integracion-v1.md)).
4. Nuestros `.md` viejos (ya absorbidos y borrados).

**Citas:** `(Consigna, p. N)` · `(CORE v1, §N)` · `(Novedades CORE 04/11, p. N)` ·
`(Trello, «card», fecha)` · `(xlsx M#, hoja «…»)`. Las fechas de Trello son las del comentario;
cuando no hay comentario con fecha se usa la fecha de la última actividad de la card.

**Límites de lo que se pudo leer:**
- No se pudo leer el Swagger de CORE (`/docs`, Railway): Trello dice que **esa** es la referencia
  actual y que la v5 del 15/09 ya no describe todo el código (Trello, «G8→G10 · Alta de identidad…», 2026-10-20).
  Todo lo de CORE que no esté en v1, Trello o las Novedades hay que validarlo contra el Swagger.
- De los xlsx de flujos de datos de los equipos **faltaron los de Portal Estudiante (1) y Tienda (5)**.
- La consigna ([`docs/TPO - DEA II 2Q 2026.pdf`](<docs/TPO - DEA II 2Q 2026.pdf>), 6 páginas) **no trae fechas de entrega ni criterios de evaluación**.

## Índice

**[Estado de implementación (2026-11-05)](#estado-de-implementación-2026-11-05)**

1. [Consigna del TP](#1-consigna-del-tp)
2. [Qué nos pide la consigna a nosotros (Módulo 7)](#2-qué-nos-pide-la-consigna-a-nosotros-módulo-7)
3. [Contrato de CORE vigente (v1 + novedades 04/11)](#3-contrato-de-core-vigente-v1--novedades-0411)
4. [Decisiones y aclaraciones de los POs (Trello)](#4-decisiones-y-aclaraciones-de-los-pos-trello)
5. [Flujos de datos de cada equipo (xlsx)](#5-flujos-de-datos-de-cada-equipo-xlsx)
6. [Matriz de brechas](#6-matriz-de-brechas)
7. [Impacto en Analítica: qué tendríamos que cambiar](#7-impacto-en-analítica-qué-tendríamos-que-cambiar)
8. [Diseño y prototipo vigente](#8-diseño-y-prototipo-vigente)
9. [Pendientes y preguntas abiertas](#9-pendientes-y-preguntas-abiertas)

---

## Estado de implementación (2026-11-05)

La integración con CORE y los demás módulos se implementó en cinco fases (commits `917fcde`, `8aa6f41`,
`fc0d831`, `2f026a5` y `4c8359c`) siguiendo [`docs/INTEGRACION.md`](docs/INTEGRACION.md). Qué hay hoy, y qué
depende de terceros:

**Hecho**
- **Ingesta v1 de CORE.** Envelope v1 validado contra `event-catalog.ts` (9 tipos que se guardan, 2 de efecto
  lateral, 11 descartados), inbox idempotente por `eventId` en Postgres (migración `inbox_v1`), contadores por
  módulo en `source_ingestions`. Dos transportes: consumer RabbitMQ de la cola `analytics.all-events.v1` (sólo
  con `RABBITMQ_URL`; ack manual, reintentos, DLQ, reconexión) y `POST /api/analytics/events` como mock de la
  cola (sólo con `EVENTS_HTTP_INGEST=true`). El contrato propio (`sourceModule` + `payload`) y su normalizador
  se retiraron. Detalle: [`backend/EVENTOS.md`](backend/EVENTOS.md).
- **Gateways con mocks por flag** (`CORE_MOCK`, `BACKOFFICE_MOCK`, `ACADEMIC_MOCK`): interfaces en
  `domain/gateways/`, implementación HTTP (token de servicio, caché TTL, reintentos, `problem+json`) e
  implementación mock que lee `backend/mocks/**.json` en cada llamada, editables a mano
  ([`backend/mocks/README.md`](backend/mocks/README.md)).
- **Auth real contra CORE** (o su mock): proxy `/api/auth/{login,refresh,logout,me}` con cookie de refresh
  `HttpOnly`, verificación del JWT por JWKS (o clave local en modo mock) y mapeo de roles de CORE a secciones
  (`ACADEMIC_ADMIN` → académica, `FINANCE_ADMIN` → financiera, `ADMIN` → ambas).
- **Tableros reescritos** sobre el inbox y los gateways: académico (resultados + cursos, catálogo y docentes de
  Gestión Académica + nombres de Backoffice), financiero (`wallets/aggregates` de CORE por mes, snapshots del
  saldo, tienda y comedor desde eventos) y eventos (sede por `locationId`). Si un gateway falla, el bloque
  afectado sale vacío con un `warnings[]` (200, nunca números inventados); `siteScopeNote` avisa que el
  financiero de CORE no se abre por sede.
- **Job de snapshots** del saldo de CORE (`WALLET_SNAPSHOT_*`) y `npm run backfill:core` para la carga histórica.
- **Rutas y operación:** `/api/v1/*` además de `/api/analytics/*`, `problem+json`, `X-Correlation-Id`,
  `/health/live` y `/health/ready`, CORS con credenciales.
- **Demo y herramientas:** `npm run db:demo` (~34,6 mil envelopes v1 coherentes con los mocks), `mocks:generate` y
  `mocks:check`, colección de Postman generada desde el catálogo.
- **Frontend:** sesión con el token sólo en memoria y refresh silencioso, avisos de `warnings` y `siteScopeNote`,
  `note` en las tarjetas, saldo `null` como hueco.

**Pendiente de terceros** (todo corre con mocks hasta que respondan; preguntas en la sección 9):
cola y credencial de lectura de G10; permiso `wallet:read:aggregates` y `backoffice:read` para `analytics-service`;
evento de resultado final de curso y rutas `/internal/v1` de G9; nombres del catálogo y `category` en G6;
`items[]` de G5; identidades de prueba `ACADEMIC_ADMIN` y `FINANCE_ADMIN`.

**No hecho:** tests automatizados (no hay ninguno configurado), documentación OpenAPI/Swagger propia, envío por
lotes.

---

## 1. Consigna del TP

Desarrollo de Aplicaciones II, 2.º cuatrimestre 2026, Ing. Joaquín Timerman. Nuestro módulo es
el **7 · Analítica Institucional**. (Consigna, p. 1)

**Objetivo.** Modernizar el ecosistema digital de la universidad (procesos fragmentados en
sistemas obsoletos y planillas) con "UADEnet", una plataforma modular que integre servicios
académicos, administrativos y de vida universitaria, preparada para **múltiples sedes**,
**escalabilidad regional** y **eventos asincrónicos**. (Consigna, p. 1)

**Requerimientos generales** (Consigna, p. 1):
- Grupos de 5 o 6 estudiantes; cada grupo diseña e implementa un módulo.
- Cada módulo se integra con otros según las reglas de negocio de la consigna. **El método de
  integración y las tecnologías son libres, pero hay que justificarlos y defenderlos** en las
  entregas parciales y finales.
- Las APIs se documentan con herramientas como **Swagger o Postman**.

**Los 10 módulos** (Consigna, pp. 2-5):

| N.º | Módulo | Responsabilidad |
|---|---|---|
| 1 | Portal del Estudiante | Login con mail UADE; inscripción a materias y historial (materia, cuatrimestre, nota, situación); notificaciones en tiempo real (resultado de examen, sanción de biblioteca) y aviso de evento próximo; calendario (comedor, eventos, exámenes); historial de compras de la Tienda; carga de saldo |
| 2 | Portal del Docente | Login; alta de cursos, calificaciones y actas; asistencia y resultados de exámenes; aviso de evento; calendario; historial de compras; carga de saldo |
| 3 | Biblioteca Universitaria | Bibliotecarios administran stock por sede; estudiantes consultan y piden préstamos; la devolución la registra un bibliotecario; pasados **7 días** de la fecha límite: sanción + multa sobre el saldo (el costo lo define Backoffice) |
| 4 | Sistema de Comedor | Reservar turnos en una sede, ver el menú y pagar con saldo; el costo lo define Backoffice y se muestra al reservar; se descuenta al reservar y **se restituye si el usuario se presenta** |
| 5 | Tienda del Campus | Compra de artículos solo con saldo institucional; buscador, filtro, orden por precio y carrito; los administrativos de la tienda gestionan stock |
| 6 | Eventos Académicos | Administrativos gestionan eventos (locación + cupo máximo); inscripción de estudiantes, docentes y administrativos; sin locación ni inscripción en eventos concurrentes; inscripción gratuita o paga con saldo; método para comprobar asistencia; recordatorio **una semana antes** |
| 7 | **Analítica Institucional** | Recolectar los eventos de los otros módulos y generar los reportes (ver sección 2) |
| 8 | Backoffice Administrativo | Usuarios y permisos (ABM de estudiantes, docentes y administrativos, roles por módulo); parametrización tarifaria y financiera (precios de comedor y eventos, multas de biblioteca, **liquidación de sueldos**); sedes y espacios |
| 9 | Gestión Académica y Planificación | Carreras, planes, asignaturas y correlatividades; aulas por sede, horarios y capacidades; fechas de cuatrimestre y turnos de examen; motor de regularidad (asistencia mínima y promedio) |
| 10 | CORE | Comunicación entre módulos; crea y administra **colas** (topics/queues, errores); **autenticación** (emite y valida tokens, login); **gateway**; **notificaciones**; **saldo** de las cuentas institucionales (cobros, visualizaciones, acreditaciones) |

**Entregas** (Consigna, p. 6):
1. **Primera:** mocks de cada vista y flujo de datos.
2. **Segunda:** módulo completamente funcional **con las integraciones mockeadas**.
3. **Final:** módulo funcional **e integrado al resto del sistema**, README con instrucciones de
   instalación y ejecución, y diagrama de arquitectura general del sistema.

**Fechas** (la consigna no las trae):
- Backoffice (G8) menciona la **entrega del 11/11** trabajando con mock (Trello, «G8→G10 · Dudas del Swagger…», 2026-11-04) y que la cátedra les dijo que **hasta la entrega final (2/12) las
  integraciones van mockeadas** (Trello, «G8→G10 · Entorno de CORE…», 2026-10-30). Inferencia: 11/11 = segunda entrega, 2/12 = final.
- **Contradicción:** la consigna pide en la entrega final el módulo "integrado" (Consigna, p. 6); lo que cuenta G8
  que dijo la cátedra es que hasta el 2/12 las integraciones pueden ir mockeadas. Es posterior pero es una
  referencia de segunda mano: confirmar con la cátedra (ver sección 9).

**Criterios de evaluación:** no figuran en la consigna. Lo único explícito es que las decisiones de
integración y de tecnología se justifican y defienden, que las APIs se documentan (Swagger/Postman)
y que la entrega final lleva README y diagrama de arquitectura.

---

## 2. Qué nos pide la consigna a nosotros (Módulo 7)

> "Recolectar los eventos generados por los otros módulos y generar los reportes requeridos por
> cada módulo." (Consigna, p. 4)

| Requisito | Fuente | Estado en el código hoy |
|---|---|---|
| **Dashboard Dirección Académica** (estadísticas de estudiantes, docentes y materias): cantidad de materias en curso; tasa de aprobación de cuatrimestres anteriores por materia; tasa de aprobación por docente | Consigna, p. 4 | Hecho (sección Académica). Sale de eventos propios, no de los de CORE |
| **Dashboard Dirección Financiera**: balances de saldo de la universidad; gastos administrativos (incluyendo salarios); productos más vendidos de la tienda; facturación de los comedores de la sede | Consigna, p. 4 | Hecho (sección Financiera) con el modelo propio `saldo.movimiento`; el contrato de CORE usa otro mecanismo (sección 3) |
| **Sección de estadísticas de eventos**: frecuencia, concurrencia, tasa de presentismo, etc. | Consigna, p. 4 | Hecho (sección Eventos académicos) |
| Acceso restringido por dirección (académica / financiera) | Consigna, p. 4 | Hecho contra un mock de CORE |
| Operación multi-sede | Consigna, p. 1 | Filtro de sede en todas las secciones |
| Documentar APIs (Swagger o Postman) | Consigna, p. 1 | Colección de Postman generada (`docs/postman/`); no hay Swagger |

**Interpretaciones nuestras** (la consigna no las fija):
- La consigna no dice dónde va la sección de eventos ni qué rol la ve. Hoy es una **sección propia**,
  habilitada por el rol **académica** (`frontend/.../institutional-analytics.page.tsx`, `sectionsByRole`; la ruta
  `GET /events/stats` exige `academica`). El xlsx M7 coincide: eventos cuelga de `analytics:academic:read` (xlsx M7, hoja «Flujo de Datos», fila de `events/stats`).
  *Antes (README viejo, diseño original):* eventos dentro del tablero financiero. Ver contradicción en la sección 9.
- "Gastos administrativos incluyendo salarios": **son todos los sueldos que liquida Backoffice** (docentes y no docentes), tomados
  de CORE como el total del concepto `PAYROLL`; **ningún módulo produce otros gastos administrativos**, así que el
  tablero muestra solo sueldos (Trello, «G8→G7 · "Gastos administrativos incl. salarios"…», 2026-10-22).
- "Facturación de los comedores de la sede": facturación por sede de `dining.reservation.created.v1` (lleva `siteId`;
  CORE no conoce sedes) (CORE v1, §12 y §11). Queda por decidir si la facturación es lo cobrado o lo cobrado menos lo restituido por asistencia (ver sección 9).
- "Productos más vendidos": de `store.purchase.completed.v1`; necesitamos `productId`, `productName` y `category` al momento de la compra, `quantity` y `subtotal` como string decimal; no necesitamos `userId`, ni `userType`, ni eventos de stock; `siteId` opcional
  (Trello, «G5→G7 #26–#30», 2026-10-22).
- Los tableros comparan contra el período anterior (cuatrimestre o mes); por eso pedimos una **carga histórica única** desde 2026-1C a cada módulo (sección 6.5).

---

## 3. Contrato de CORE vigente (v1 + novedades 04/11)

Describe el estado **vigente**: el contrato v1 del 2026-08-05 más lo que lo modificó. Texto completo de v1:
[`docs/CORE-contrato-integracion-v1.md`](docs/CORE-contrato-integracion-v1.md). Regla de compatibilidad de v1: dentro de `v1` solo se agregan
campos opcionales; un cambio incompatible crea `v2` con una semana de aviso (CORE v1, encabezado).

Las Novedades del 04/11 declaran que **"todo es compatible con lo que ya estaba: no se quitaron rutas, campos, roles ni permisos"** (Novedades CORE 04/11, p. 8).

### 3.1 Cambios posteriores a v1 (qué lo modificó)

| Tema | Antes (CORE v1 / fuente anterior) | Vigente | Fuente |
|---|---|---|---|
| **Entorno** | CORE_SPEC.md como referencia | CORE **desplegado en Railway** `https://core-api-production-e458.up.railway.app`; `/docs` (Swagger) es la referencia, la v5 del 15/09 ya no describe todo | Novedades CORE 04/11, p. 2; Trello, «G8→G10 · Alta de identidad…», 2026-10-20 |
| **`iss` del JWT** | v1 no fija valor; en Railway se vio `http://localhost:3000` | `iss` = URL de la API en Railway; `aud` = `uadenet`; validar firma RS256, `iss`, `aud` y `exp` tal cual, sin valor por defecto | Novedades CORE 04/11, p. 2; Trello, «G8→G10 · Entorno de CORE…», 2026-11-04 |
| **Claims del JWT de usuario** | `iss, aud, sub, sid, email, roles, permissions, iat, exp, jti` | Suma **`careerIds`** (array de strings, `[]` si no hay) | Trello, «G5→G10 #1», 2026-10-20 |
| **Headers del gateway** | `X-User-Id`, `X-User-Roles`, `X-User-Permissions`, `X-Correlation-Id` | Suma `X-User-Career-Ids`, `X-Core-Timestamp` y `X-Core-Signature`. Firma: HMAC-SHA256 en hex sobre `método\npath de destino\nX-User-Id\nX-Correlation-Id\nX-Core-Timestamp` (ms Unix); no firma body, query ni roles/permisos. El secreto se pasa por privado. **La autorización sale del JWT validado con JWKS, no de los headers** | Trello, «G5→G10 #6», 2026-10-20; «G8→G10 · Entorno de CORE…», 2026-11-04 |
| **Revocación** | v1: introspect solo para operaciones sensibles | El gateway consulta identidad y sesión en la base en cada request (sin la caché de 30 s de la doc anterior). Un backend que solo valida el JWT localmente no ve una baja hasta que vence (15 min) | Trello, «G8→G10 · Corte de sesiones…», 2026-10-20 |
| **Catálogo de roles** | v1 no lista roles | **11 roles** vigentes (tabla en 3.2), CORE es el único dueño del catálogo; lista fija, sin ruta para listarla | Novedades CORE 04/11, pp. 3-4; Trello, «G8→G10 · Roles…», 2026-10-20 y «G8→G10 · Dudas del Swagger…», 2026-11-04 |
| **Permisos nuevos** | — | `backoffice:read`, `backoffice:payroll:generate`, `backoffice:payroll:approve`; roles `BACKOFFICE_VIEWER` y `PAYROLL_ADMIN`; `ADMIN` y `FINANCE_ADMIN` suman `backoffice:read` | Novedades CORE 04/11, p. 3 |
| **Tokens de servicio** | v1: "claims `sub=service:<modulo>`, `service`, scopes" | Cada cliente recibe **solo los permisos que se le habilitan** (no hay tokens universales). Claims: `sub` (`service:<módulo>`), `service`, `clientId`, **`permissions`** (array; no `scopes`), `roles` (siempre `[]`), `iss`, `aud`, `iat`, `exp`, `jti`. Para saber quién llama se usa `service` | Trello, «G8→G10 · Permiso de lectura…», 2026-11-04 |
| **Lectura de eventos** | v1: consulta de eventos para IT | `GET /internal/v1/events/{eventId}` ahora exige `events:read` (igual que el listado); antes cualquier token válido podía leerlo | Novedades CORE 04/11, p. 7 |
| **Reversas de wallet** | v1: `409 ALREADY_REVERSED` se trata como éxito | La reversa ahora guarda la `Idempotency-Key`: misma clave y mismo body devuelve la original (`201`); misma clave con otro body `409 IDEMPOTENCY_CONFLICT`; clave nueva sobre algo ya revertido `409 ALREADY_REVERSED`. Solo una reversa por movimiento | Novedades CORE 04/11, p. 7; Trello, «G5→G10 #14», 2026-10-20 |
| **Rate limit** | v1: `429 RATE_LIMITED` | 100 requests por minuto **por IP de cliente** (variable `TRUST_PROXY_HOPS=1` en Railway; antes se contaba por proxy); `Idempotency-Key` se conserva 24 h; solo se guardan los `201` | Novedades CORE 04/11, p. 7; Trello, «G8→G10 · Dudas del Swagger…», 2026-11-04 |
| **Identidades** | v1: `PUT /internal/v1/identities/{userId}` | Nuevo `GET /internal/v1/identities/{userId}` (`identity:manage`; `{id, email, status, roles, careerIds, createdAt, updatedAt}`); `PUT` no acepta `permissions` ni `status` (400 `HTTP_400`); estado inicial `INVITED`; códigos `AUTH_EMAIL_CONFLICT` (409), `AUTH_IDENTITY_NOT_ACTIVATED` (409) y `AUTH_IDENTITY_NOT_FOUND` (404); rol desconocido: `400 AUTH_ROLE_UNKNOWN`. No nos afecta directo (es de Backoffice) | Novedades CORE 04/11, pp. 5-6; Trello, «G8→G10 · Dudas del Swagger…», 2026-11-04 |
| **Evento `backoffice.rate.changed.v1`** | `{rateType, amount, currency, effectiveFrom}` | Suma opcionales `siteId`, `category`, `baseAmount`, `dailyAmount`. No es de Analítica | Trello, «G3→G10 · Multa…» y «G8→G6/G10 · rateType único…», 2026-10-18/20 |
| **Eventos wallet** | v1 los lista todos | `core.wallet.transaction-rejected.v1`: está en el catálogo pero **su emisión no está implementada**. El de `reversed` sí se emite | Trello, «G8→G10 · Créditos de sueldo…», 2026-10-20 |
| **Webhooks** | v1: alternativa a la cola | Requieren `webhooks:manage`; el secreto de firma se devuelve **una sola vez**; callback HTTPS directo (no por gateway); se filtra solo por `eventType`; reintentos a 10 s, 60 s y 600 s. **CORE no habilita suscripciones a eventos de wallet** hasta implementar un aislamiento (hoy un suscriptor recibiría movimientos ajenos) | Trello, «G8→G10 · Webhooks…», 2026-10-20; «G8→Todos · ¿Cómo nos avisamos…», 2026-11-04 |
| **Consumo directo de RabbitMQ** | v1: nack con reintentos a 10 s, 1 min y 10 min | Un NACK **no** activa por sí solo los reintentos demorados de CORE; cada módulo implementa su inbox, ACK, retries y manejo de errores. Las credenciales de consumo habituales son de **solo lectura** | Trello, «G5→G10 #18», 2026-10-20 |
| **Pedido de colas** | v1: PR sobre `contracts/topology.yaml` | No hace falta acceso al repo: se pide a G10 con dueño, nombre de cola, `eventTypes`, entorno y responsable. Ni webhook ni cola "se consideran configurados solo por estar documentados" | Trello, «G8→G10 · Liquidación de sueldos: cola de feedback…», 2026-10-20 |
| **Sedes** | — | No hay evento de sedes; `backoffice.location.upserted.v1` es de **espacios**. Las sedes se consultan por REST | Trello, «G5→G8/G10 #23», 2026-10-20 |
| **Usuarios de prueba** | — | Existen 3 identidades activas en CORE: `ADMIN`, `STUDENT`, `TEACHER`; las credenciales van por privado. **No hay de prueba con `ACADEMIC_ADMIN` ni `FINANCE_ADMIN`** | Novedades CORE 04/11, p. 2 |

Nota de seguridad: las Novedades dicen que las credenciales de prueba van "por privado"
(Novedades CORE 04/11, p. 2), pero Trello tiene en un comentario del 2026-11-04 las de las tres identidades de prueba en texto plano
(«G6 --> G10 #34 Credenciales»). No se copian acá y conviene pedirle a CORE que las rote.

### 3.2 Catálogo de roles vigente (Novedades CORE 04/11, p. 4)

`IT_ADMIN`: permisos técnicos de CORE sin los de negocio. Todos los demás suman `wallet:read:self` y `wallet:credit:self`.

| Rol | Para quién | Permisos propios |
|---|---|---|
| `STUDENT`, `TEACHER` | Alumnos y docentes | solo la wallet propia |
| `ADMIN` | Administrativos de Backoffice | `backoffice:manage`, `backoffice:read` |
| `BACKOFFICE_VIEWER` | Backoffice, solo consulta | `backoffice:read` |
| `PAYROLL_ADMIN` | Genera liquidaciones | `backoffice:read`, `backoffice:payroll:generate` |
| `FINANCE_ADMIN` | Finanzas | `wallet:read:any`, `wallet:read:aggregates`, `wallet:credit:any`, `wallet:admin`, `backoffice:read`, `backoffice:payroll:approve` |
| `LIBRARIAN` | Biblioteca | `library:manage` |
| `STORE_ADMIN` | Tienda | `store:inventory:manage` |
| `OPERATIONS_ADMIN` | Comedor y Eventos | `dining:manage`, `campus-events:manage` |
| `ACADEMIC_ADMIN` | Gestión académica | `academic:manage` |

**No hay ningún permiso `analytics:*`** en el catálogo. Cada módulo autoriza por permiso, no por rol (Trello, «G8→G10 · Roles…», 2026-10-20),
y "si un módulo necesita separar más fino, nos piden el permiso nuevo". Nuestro xlsx M7 (21/10) asume `analytics:academic:read` y
`analytics:finance:read` "que se piden a CORE para ACADEMIC_ADMIN y FINANCE_ADMIN" (xlsx M7, hoja «Flujo de Datos», fila de headers del gateway):
**no hay constancia de que se hayan pedido ni creado**. Pregunta abierta para CORE (sección 9).

### 3.3 Lo que sigue vigente de v1 (resumen para todos los módulos)

- **Identidad:** `userId` UUID v4 generado por Backoffice = `sub` del JWT = `user.id` del login = `X-User-Id`; nadie referencia personas por email o legajo (CORE v1, §1; Trello, «G5→G8/G10 #25», 2026-10-20).
- **Convenciones:** JSON UTF-8 `camelCase`; IDs UUID v4; fechas ISO 8601 UTC; **dinero como string decimal con dos decimales + `currency`, nunca float** (CORE v1, §2; confirmado en Trello, «G5→G10 #13», 2026-10-20); paginación por cursor (máx. 100); Swagger en `/docs`.
- **Auth de usuario:** `POST /api/v1/auth/login` → `{accessToken (900 s), user}` + refresh en cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; 7 días`, rota en cada uso; `refresh`, `logout`, `me`. El access token vive en memoria (CORE v1, §3; cookie confirmada en Trello, «G8→G10 · Dudas del Swagger…», 2026-11-04).
- **Auth de servicio:** `POST /internal/v1/service-auth/token` con `clientId`/`clientSecret` por módulo (en variables de entorno, fuera de Git); token de 900 s; validar el JWT local con JWKS (`/.well-known/jwks.json`, RS256, `iss`, `aud`, `exp`, refrescar solo ante `kid` desconocido) (CORE v1, §4).
- **Gateway:** `/api/v1/{módulo}/*` se reescribe a `/api/v1/*` del módulo (Analítica: `/api/v1/analytics/*` → `ANALYTICS_SERVICE_URL`); timeout 10 s; no reintenta `POST/PATCH/DELETE`; `502/503/504` (códigos `GATEWAY_UPSTREAM_FAILURE`, `GATEWAY_UPSTREAM_UNCONFIGURED`, `GATEWAY_CIRCUIT_OPEN` según Trello, «G5→G10 #12», 2026-10-20). El módulo no debe ser accesible fuera de la red interna y valida igual el JWT (CORE v1, §5-§6).
- **Backend → backend:** las consultas directas entre backends van por `/internal/v1/...` con token de servicio; `/api/v1/...` queda para el portal vía gateway (Trello, «G3→G10 · Endpoint de multa…», 2026-10-20).
- **Errores:** `application/problem+json` con `{type, title, status, code, detail, instance, correlationId}`; se programa contra `code` (CORE v1, §13; tabla de códigos en Trello, «G5→G10 #12»).
- **Salud y trazabilidad:** `GET /health/live` y `/health/ready`; propagar `X-Correlation-Id` (CORE v1, §6 y §14; Trello, «G5→G10 #7», 2026-10-20).
- **Wallet:** una wallet ARS por usuario; movimientos `CREDIT`/`DEBIT`/`REVERSAL` con `concept`; conceptos `TOP_UP`, `PAYROLL`, `SCHOLARSHIP`, `ADJUSTMENT`, `LIBRARY_FINE`, `DINING_RESERVATION`, `STORE_PURCHASE`, `EVENT_REGISTRATION`, `REFUND`; `externalReference` estable por módulo; `Idempotency-Key` UUID en toda escritura financiera (CORE v1, §7).
- **Envelope de eventos:** `{specVersion "1.0", eventId (UUID v4), eventType (con sufijo .vN), source, occurredAt, subject "tipo/id", correlationId, causationId, actor {type,id}, data}`; se publica con `POST /internal/v1/events` (`202 ACCEPTED`, outbox de CORE); **mismo `eventId` y mismo contenido** devuelve el resultado previo, mismo `eventId` con otro contenido `409 EVENT_ID_CONFLICT`; la entrega es **al menos una vez** (CORE v1, §9; Trello, «G5→G10 #16–#17», 2026-10-20). La routing key es el `eventType` y el exchange es `uadenet.events.v1` (CORE v1, §10).
- **Catálogo de eventos** (CORE v1, §11): 21 tipos. Los que consume Analítica: `backoffice.user.upserted.v1`, `teacher.exam-result.published.v1`, `teacher.attendance.recorded.v1`, `library.penalty.applied.v1`, `dining.reservation.created.v1`, `dining.reservation.cancelled.v1`, `dining.attendance.recorded.v1`, `store.purchase.completed.v1`, `events.event.created.v1`, `events.registration.completed.v1`, `events.attendance.recorded.v1`, `academic.term-defined.v1`, `core.wallet.transaction-posted.v1`, `core.wallet.transaction-rejected.v1`, `core.wallet.transaction-reversed.v1`, `core.notification.created.v1` (opcional). El detalle de `data` de cada uno está en la matriz (sección 6). Un `eventType` nuevo exige su JSON Schema y entrada AsyncAPI en el mismo PR (respuesta en 48 h hábiles).
- Contratos formales según CORE: `contracts/openapi.yaml`, `contracts/asyncapi.yaml`, `contracts/events/*.schema.json`, colección de Postman (CORE v1, §14). **No los tenemos.**

### 3.4 Lo que toca a Analítica (detalle)

Según CORE v1, §12, §10 y §7, con lo vigente de 3.1:

| Tema | Qué dice el contrato vigente | Estado / nota |
|---|---|---|
| **Cola de eventos** | Cola `analytics.all-events.v1`, durable, `owner: analytics`, binding `uadenet.events.v1` con routing key `#`, `deadLetter: uadenet.dlx.v1`, `maxRetries: 3` (CORE v1, §10) | **No hay constancia** de que CORE la haya creado ni de credenciales de consumo. Pedirla (Trello, «G8→G10 · Liquidación de sueldos…», 2026-10-20: se pide con dueño, nombre, `eventTypes`, entorno y responsable). Con `#` recibimos **todo** el bus, incluidos eventos con datos personales y reentregas |
| **Inbox obligatorio** | `inbox_messages(event_id UUID PK, processed_at, result)`; insertar el `eventId` y ejecutar el efecto en la misma transacción; si existe, ack sin repetir; ack manual después de persistir; prefetch 10-50; errores permanentes o schema inválido a DLQ (CORE v1, §10) | Tenemos `inbox_events` con `event_id` único e idempotencia por `eventId` (`CLAUDE.md`). Alineado en espíritu; falta el consumidor RabbitMQ |
| **Balances y gastos** | `GET /internal/v1/wallets/aggregates?groupBy=concept&from=&to=` → `{range, currency, outstandingBalance, walletCount, groups[{key, type, count, total}]}`, **sin identificadores de personas**; "balances de saldo" = `outstandingBalance`; gastos administrativos = grupo `PAYROLL`; "no consulta wallets usuario por usuario" (CORE v1, §7 y §12). Lo consulta "Analítica/finanzas": el permiso de CORE es **`wallet:read:aggregates`** (hoy lo trae `FINANCE_ADMIN`, Novedades CORE 04/11, p. 4) | **Falta confirmar** (a) que el cliente `analytics-service` tenga `wallet:read:aggregates`, (b) la ruta y la respuesta contra el Swagger (la Trello solo registra el endpoint en el xlsx de CORE v5 y en nuestro xlsx). Se consulta mes a mes |
| **Comedor por sede** | Desde `dining.reservation.created.v1`, que lleva `siteId` ("CORE no conoce sedes") (CORE v1, §12) | Cancelación y asistencia no llevan `siteId` ni monto: se cruzan por `reservationId` |
| **Productos más vendidos** | Desde `store.purchase.completed.v1` (`purchaseId, userId, total, currency, items[]`) (CORE v1, §11) | `items[]` no está especificado en v1; lo pedimos a Tienda (Trello, «G5→G7 #26», 2026-10-22). `siteId` opcional |
| **Gateway** | `/api/v1/analytics/*` → `ANALYTICS_SERVICE_URL`, reescribe a `/api/v1/*`; headers `X-User-*` y `Authorization` original (CORE v1, §6; Trello, «G5→G10 #5–#6», 2026-10-20) | Hoy servimos `/api/analytics/...` sin `/v1` ni gateway |
| **Autenticación** | Validar el JWT con JWKS (`iss` Railway, `aud` `uadenet`); autorizar con `permissions` del JWT; los headers no son credencial (Trello, «G5→G10 #6», 2026-10-20; Novedades CORE 04/11, p. 8) | Hoy: mock de CORE con roles `academica`/`financiera` |
| **Errores y salud** | `problem+json`; `/health/live` y `/health/ready` (CORE v1, §6 y §13) | Hoy: `{ "error": "..." }` y no hay health checks |
| **Lo que no recibimos** | Credenciales ni el texto de las notificaciones; `core.notification.created.v1` es opcional (CORE v1, §12 y §11) | — |
| **Consultas a otros backends** | Sedes y ficha de usuario a Backoffice por `/internal/v1/sites` y `/internal/v1/users/{userId}` con token de servicio `analytics-service`; Backoffice **aprobó el acceso de `analytics-service`** y pidió a CORE agregarle `backoffice:read`; **CORE todavía no confirmó que lo agregó** (Trello, «G8→G10 · Permiso de lectura…», 2026-11-04) | Pendiente |

---

## 4. Decisiones y aclaraciones de los POs (Trello)

Tablero «DesaAp2»: listas Pendientes / En revisión / Completadas / Instrucciones, **86 cards** (Trello, export del tablero del 2026-11-04).
Funcionamiento: se crea una card en «Pendientes» con la consulta y la etiqueta del PO y de los grupos involucrados; al responder pasa a «En revisión»; el PO que
preguntó la pasa a «Completadas» o la vuelve a «Pendientes» (cards «Instrucciones»). Etiquetas: G1 Estudiante, G2 Docente, G3 Biblioteca, G4 Comedor, G5 Tienda, G6 Eventos, G7 Analítica, G8 Backoffice, G9 Gestión Académica, G10 CORE.
**Las tres cards etiquetadas G7 y las cinco de G5→G7 son las únicas que nos nombran explícitamente.** Marcadas con ★ las que afectan a Analítica.

### 4.1 Cards dirigidas a Analítica (G7)

| Card | Fecha | Pregunta | Respuesta / decisión |
|---|---|---|---|
| ★ «G8→G7 · ¿Qué granularidad del gasto salarial necesitan?» (Completada) | 2026-10-21/22 | Nivel de detalle del gasto salarial | **De Backoffice no necesitamos nada para los sueldos.** Los tomamos de CORE: total por mes del concepto `PAYROLL` (`GET /internal/v1/wallets/aggregates?groupBy=concept&from=&to=`), sin datos de personas. *Antes (xlsx de G7 del 04/10, desactualizado):* `movimiento.registrado` de Backoffice y `POST /api/analytics/events`, que según G7 "ya no existen" |
| ★ «G8→G7 · "Gastos administrativos incl. salarios"…» (Completada) | 2026-10-22 | ¿Solo salarios de Backoffice? | Todos los sueldos que liquida Backoffice (docentes y no docentes); total de `PAYROLL` en CORE; otros gastos administrativos no los produce ningún módulo, el tablero muestra solo sueldos |
| ★ «G8→G7 · ¿Consumen eventos, pull o ambos?» (Completada) | 2026-10-22 (G7), 2026-10-27 y 2026-11-03 (G8) | ¿Cómo consumen de Backoffice? | **Ambos.** Eventos vía CORE: `backoffice.user.upserted.v1`, `backoffice.user.disabled.v1`, `backoffice.location.upserted.v1`. Pull directo a Backoffice con token de servicio: sedes (carga inicial con cache; las sedes no tienen evento) y ficha de usuario (solo nombre a mostrar, sin copiar datos de personas). **G8 (27/10):** la ruta es `GET /internal/v1/sites` y `GET /internal/v1/users/{userId}` (no `/api/v1/...`). **G8 (03/11):** `careers` de la ficha suma `careerCode`, `careerName`, `planCode`, `planName` (cambio aditivo, G8 pregunta si nos afecta; no hay respuesta nuestra) |
| ★ «G5→G7 #26» (En revisión) | 2026-10-22 | ¿Alcanza el payload de `store.order.completed.v1`? | El evento se llama `store.purchase.completed.v1` en CORE. Necesitamos `productId`, `productName` y `category` al momento de la compra, `quantity`, `subtotal` (string decimal) |
| ★ «G5→G7 #27» | 2026-10-22 | ¿Identificar al comprador? | No segmentamos por persona, no guardamos `userId` ni necesitamos `userType` |
| ★ «G5→G7 #28» | 2026-10-22 | ¿Sede? | Sí, `siteId` (UUID de Backoffice) **opcional**; si viene, filtra el tablero financiero |
| ★ «G5→G7 #29» / «#30» | 2026-10-22 | ¿Eventos de stock? ¿Endpoints de Tienda? | No a ambos: solo `store.purchase.completed.v1` por el bus de CORE |

**Estado de estas respuestas:** las del 22/10 son de nuestro equipo (Gianfranco Montemarani). Las cinco de G5 están en «En revisión»: falta que G5 las dé por cerradas y confirme que emite lo pedido.

### 4.2 CORE (G10): autenticación, gateway, wallet y bus

| Tema | Respuesta de CORE | Fecha |
|---|---|---|
| ★ Claims del JWT | `sub`, `email`, `roles`, `permissions`, `careerIds`, `sid`, `iss`, `aud`, `iat`, `exp`, `jti`; RS256, 15 min («G5→G10 #1») | 2026-10-20 |
| ★ Quién valida | Gateway valida firma, emisor, audiencia, vencimiento y estado de identidad y sesión; el módulo recibe el JWT original y debe validarlo con JWKS además de autorizar; `introspect` para revocación en accesos directos o casos sensibles («#4») | 2026-10-20 |
| ★ Headers del gateway | Ver 3.1 («#6») | 2026-10-20 |
| ★ Ruta en el gateway | `/api/v1/{módulo}/*` se reescribe a `<SERVICE_URL>/api/v1/*`; hay que pasar a CORE la URL base por entorno y coordinar el secreto de firma («#5») | 2026-10-20 |
| ★ Correlation ID | `X-Correlation-Id`: CORE conserva el recibido o genera uno, lo propaga al backend y a los eventos de wallet («#7») | 2026-10-20 |
| Wallet | Débito con `Idempotency-Key` UUID + `externalReference`; `201` con `transactionId`; reversa con `{reason, amount?}`; montos string decimal; errores `problem+json` con tabla de `code` («#8» a «#14») | 2026-10-20 |
| ★ Publicar eventos | `POST /internal/v1/events`, `source` debe coincidir con el token; recomiendan outbox propia | 2026-10-20 |
| ★ Formato estándar | Envelope completo de la sección 3.3; el esquema por tipo está en `contracts/events/` («#16») | 2026-10-20 |
| ★ Duplicados | Entrega al menos una vez: cada consumidor necesita inbox por `eventId` persistido junto con el efecto; la deduplicación de CORE al ingresar no evita reentregas («#17») | 2026-10-20 |
| ★ Reintentos y DLQ | Webhooks: 1 intento + 3 reintentos (10/60/600 s); consumo directo de RabbitMQ: cada módulo implementa inbox, ACK, retries y errores («#18») | 2026-10-20 |
| ★ Versionado | Sufijo `.v1` y routing key = `eventType`; solo están admitidos los tipos v1 registrados; `store.order.completed.v1` y los eventos de stock/productos **no** están registrados («#19») | 2026-10-20 |
| ★ Credenciales de servicio | Cada módulo tiene `clientId`/`clientSecret` propios cargados como variables de entorno del propio backend (`CORE_CLIENT_ID`, `CORE_CLIENT_SECRET` según G8). **"Ya fueron entregadas a todos los grupos"** («G8→G10 · BLOQUEANTE · Credenciales…») | 2026-10-20 |
| ★ Webhooks | Ver 3.1 | 2026-10-20 |
| Sesiones | `PATCH` a `SUSPENDED` o `DISABLED` revoca sesiones y bloquea el refresh | 2026-10-20 |
| ★ Roles y permisos | Lista fija de roles; cada módulo autoriza por permiso; el JWT lleva `permissions`; se agregan permisos finos a pedido | 2026-10-20, 2026-11-04 |
| ★ `iss`/`aud`, firma del gateway, URL del Swagger y fecha de integración | Ver 3.1; el despliegue en Railway existe, "esta semana confirman cuándo queda estable" | 2026-11-04 |
| Eventos de Backoffice | Los cuatro (`user.upserted`, `user.disabled`, `rate.changed`, `location.upserted`) están registrados en el catálogo v1 con `data` obligatorio `userId,email,status,roles,permissions` / `userId,reason` / `rateType,amount,currency,effectiveFrom` / `locationId,siteId,name,capacity,status` | 2026-11-04 |

### 4.3 Backoffice (G8): sedes, usuarios, tarifas

| Tema | Decisión | Fecha |
|---|---|---|
| ★ Sedes | `GET /api/v1/backoffice/sites` y `/sites/{siteId}`; **luego** `/internal/v1/sites` para backend a backend. `siteId` UUID **inmutable**, nunca se reasigna; baja siempre lógica (`status: INACTIVE`); regla: guardar UUID, mostrar código/nombre. Payload: `siteId, code, name, address, city, province, country, timezone, status, updatedAt` («G5→G8 #20–#22») | 2026-09-16, 2026-09-23, 2026-10-27 |
| ★ Eventos de sede | **No existen** `backoffice.sede.*` ni `backoffice.site.*`. Solo `backoffice.location.upserted.v1`, que es de espacios. Para enterarse de altas y bajas de sedes hay que consultar el REST; no hay push («G5→G8/G10 #23») | 2026-09-16, 2026-10-20 |
| ★ Usuarios | `GET /api/v1/backoffice/users/{userId}` (ficha: nombre, apellido, legajo, documento, roles, estado, `siteId`, `careerId`); directorio paginado `GET /users?role=&siteId=&status=&cursor=&limit=` (máx. 100); roles de la ficha de Backoffice: la lista de CORE es la vigente («G1→G8 · Alta de usuarios…», 2026-09-23) | 2026-09-23 |
| Tarifas | `GET /rates` (lista), `category` GENERAL/SPECIAL para eventos, multa de biblioteca base + diaria (`base + diaria × (días − 7)` sólo si > 7). Se resuelve al momento del cobro («G6→G8…», «G3→G8…») | 2026-09-23/10-05/10-08 |
| ★ Acceso a rutas internas | Backoffice **restringe por permiso**: `backoffice:read` para clientes de servicio. Aprobados: `student-service`, `library-service`, `store-service`, **`analytics-service`**, `academic-service`, `dining-service`. Pendiente: que CORE confirme que se lo agregó («G8→G10 · Permiso de lectura…») | 2026-11-04 |
| Aviso de cambios | G8 propone que el dueño del dato publique un evento y el que guarda una copia lo relea por REST ("el evento avisa; el dato sale del REST"); pide a cada grupo listar los `eventType` que publican. Abierta («G8→Todos…») | 2026-11-04 |
| Tipo de espacio | G8 pide sumar `type` opcional a `backoffice.location.upserted.v1` (pedido de Comedor) y una ruta `GET /internal/v1/roles`; sin respuesta («G8→G10 · Confirmaciones…», 2026-11-05) | 2026-11-05 |

### 4.4 Eventos (G6), Biblioteca (G3), Gestión Académica (G9) y portales

- **Eventos:** `capacity` es capacidad física; el cupo del evento (≤ capacity) y la no concurrencia de locación son de Eventos; categoría de precio general/especial es del evento (Trello, «G8→G6 · Confirmar…», 2026-10-05; «G8→G6/G10 · Problema: rateType único…», 2026-10-20).
- **Biblioteca:** días cobrables desde el día 8 (7 de gracia); la multa es global (no por sede ni por material) y el tope no está modelado (Trello, «G3→G8 · Multa…», 2026-09-23).
- **Gestión Académica (todas ★ porque definen nuestras fuentes académicas):** ids de carrera y de plan **numéricos** (Long), viajan como texto en `careerIds`; en una carrera pueden coexistir varios planes activos; un estudiante puede tener más de una carrera con un plan por carrera; rutas internas `GET /internal/v1/carreras`, `/carreras/con-ultimo-plan-activo`, `/carreras/{carreraId}/planes` con token de servicio (hoy **solo** autorizan a `backoffice-service`; los alias `/internal/v1` aún faltan exponer); las rutas no están paginadas; no hay evento de desactivación de planes porque un plan activo no puede dejar de estar activo (Trello, «G8→G9 · Catálogo de carreras…», 2026-10-26 a 2026-10-30). **G9 no respondió nada sobre eventos hacia Analítica ni sobre `/cursos`** (el xlsx M9 tampoco los lista).
- **Portales y Tienda:** G5 propone para el historial de compras `GET /orders/me` y detalle por orden, con filtros paginación, fecha y estado; G1 pidió sumar sede (Trello, «G5→G1 #31–#34», 2026-09-23). No afecta a Analítica. **Sin respuesta** de G2.
- **Comedor:** "NO existe `DINING_PURCHASE` ni evento `dining.purchase.*` en CORE v1; la consigna pide pagar compras" está pendiente con CORE y la cátedra (xlsx M4, hoja «Trazabilidad Backend», fila "Compra de comida").

### 4.5 Cards abiertas (Pendientes / sin cierre) que nos pueden afectar

- «G8→G10 · Permiso de lectura para las rutas /internal/v1 de Backoffice»: falta que CORE agregue `backoffice:read` a `analytics-service` (2026-11-04).
- «G8→G10 · Confirmaciones: campo type en `backoffice.location.upserted.v1` y ruta para leer roles y permisos» (2026-11-05).
- «G8→Todos · ¿Cómo nos avisamos cuando un módulo cambia un dato que otro tiene guardado?»: pide a G7 listar los `eventType` que publicamos (ninguno) y cómo nos enteramos de cambios; no respondida por nosotros.
- «G8→G9 · Materias, aulas y cambios de planes: ¿qué publican?» (2026-11-03) y «G8→G4 · Comedor en el catálogo de espacios» (2026-11-03).
- «G8→G10 · Agregar el plan de estudio del alumno (`planIds`) al JWT» (2026-11-04).

---

## 5. Flujos de datos de cada equipo (xlsx)

Los xlsx son de fechas distintas; cuando Trello los corrige, prevalece Trello. Fecha = última modificación del archivo salvo que la propia hoja diga otra.

| Módulo | Archivo (modificado) | Alineado a CORE v1 | Emite a Analítica | Nota |
|---|---|---|---|---|
| 2 Portal Docente | `FlujoDatos - PortalDocente.xlsx` (2026-10-14) | **No** (nombres propios en inglés/camelCase, ids `D-404`/`E-9912`) | Nada listado | — |
| 3 Biblioteca | `UADEnet_Biblioteca_Grupo3.xlsx` (2026-10-26) | Sí | `library.penalty.applied.v1` por `POST /internal/v1/events` (no figura Analítica como destino en la hoja; v1 sí la lista como consumidora) | Tiene hoja de correcciones de la 1.ª entrega |
| 4 Comedor | `Flujo_de_Datos_Modulo_4_Comedor_Alineado.xlsx` (2026-10-26) | **Sí**, calcado a v1 | `dining.reservation.created/cancelled.v1`, `dining.attendance.recorded.v1` | Hoja «Trazabilidad Backend» |
| 6 Eventos | `Flujo de Datos - Modulo 6 - UADEnet.xlsx` (2026-10-26) | **Parcial**: REST propio en español; los eventos a Analítica con nombres propios | `evento.creado`, `inscripcion.registrada`, `asistencia.confirmada` (cola) | Hoja «CORRECIONES PROFESOR» |
| 7 Analítica | `Flujo_de_Datos_Modulo_7_Analitica.xlsx` (2026-10-21) | Sí (es nuestro diseño objetivo) | — | **No coincide con el código actual** (ver 6.6) |
| 8 Backoffice | `UADE_Flujo_de_Datos_Modulo8_Backoffice.xlsx` ("versión corregida 2026-10-04") | Sí | `user.upserted`, `user.disabled`, `rate.changed`, `location.upserted` | 5 hojas; Trello lo actualiza (rutas `/internal/v1`) |
| 9 Gestión Académica | `Flujo_de_Datos_Modulo_9_UADEnet.xlsx` (2026-10-04) | **No**: REST con ids numéricos | **Nada** (ni eventos ni Analítica) | Columna «Módulo Externo» sin completar (fila final del xlsx) |
| 10 CORE | `Flujo_de_Datos_del_Módulo_10_CORE_v5.xlsx` (v5, 2026-09-15 según Trello) | — | `core.wallet.transaction-posted.v1`; consulta `wallets/aggregates` | **Desactualizado**: Trello dice que la referencia es el Swagger |
| 1 Portal Estudiante, 5 Tienda | **No hay xlsx** | — | — | Tienda: solo lo de Trello (G5→G7) |

### Módulo 2 · Portal Docente (xlsx M2, hoja «Flujo de Datos - Portal Docente»)
- **Consume:** `POST /api/v1/auth/login`, saldo (`GET /api/v1/wallets/{userId}/balance`), `balance.updated`, `GET /api/v1/users/{userId}` (CORE); eventos de Eventos (`GET /api/v1/events`, cola `event.reminder`).
- **Emite:** `POST /api/v1/gateway/academic/courses {teacherId, subjectId, periodId}` (alta de curso hacia Académica vía CORE); por cola `asistencia.registrada {courseId, studentId, date, status}`, `nota.publicada {examId, studentId, grade, status}`, `acta.cerrada {actId, courseId, studentResults[{studentId, finalGrade}]}`. La hoja los rotula "Portal Estudiante" en la columna «Módulo Externo»: parece un error de rótulo (los publica el docente); sin confirmar.
- **Diferencia con v1:** v1 los llama `teacher.attendance.recorded.v1` y `teacher.exam-result.published.v1` con otros campos (CORE v1, §11).

### Módulo 3 · Biblioteca (xlsx M3, hoja «Flujo de Datos - Biblioteca»)
- **Consume:** login, `/api/v1/library/*` por gateway, `backoffice.rate.changed.v1` (`LIBRARY_LATE_FEE`), `backoffice.location.upserted.v1`.
- **Emite:** débito `LIBRARY_FINE` (`penalty/{penaltyId}`) y `POST /internal/v1/events` con `library.penalty.applied.v1 {userId, loanId, daysLate, amount, currency}`.
- **No emite** préstamos ni devoluciones (los `prestamo.*` de nuestro contrato propio no tienen emisor). Correcciones de la 1.ª entrega: faltan endpoints `/api/v1/library`, consumir sedes y datos de usuario, y el formato de `effectiveFrom` (debe ser date-time ISO 8601 UTC con hora).

### Módulo 4 · Comedor (xlsx M4, hoja «Flujo de Datos»)
- **Emite a Analítica** (idénticos a v1): `dining.reservation.created.v1 {reservationId, userId, siteId, slotAt, amount, currency}` ("Analítica usa `siteId` para facturación del comedor por sede"), `dining.reservation.cancelled.v1 {reservationId, userId, slotAt, cancelledAt}`, `dining.attendance.recorded.v1 {reservationId, userId, attendedAt}`. Los mismos dos primeros van a los calendarios de los portales.
- **Consume:** `backoffice.rate.changed.v1` (`DINING_RESERVATION`), `backoffice.location.upserted.v1`, `core.wallet.transaction-posted/rejected/reversed.v1`.
- **Wallet:** débito `DINING_RESERVATION` (`reservation/{reservationId}`), reversa total sin `amount` al presentarse (concepto `REFUND`); `409 ALREADY_REVERSED` = éxito.
- **Reglas que declara:** IDs UUID v4, JSON camelCase, fechas ISO 8601 UTC, dinero como string decimal + `currency`, `X-Correlation-Id`, idempotencia financiera; publica por `POST /internal/v1/events` con `eventId` como `Idempotency-Key`.
- **Pendiente:** compra de comida sin contrato en CORE v1.

### Módulo 6 · Eventos Académicos (xlsx M6, hoja «Flujo de Datos»)
- **API propia** `/api/v1/eventos`, `/inscripciones`, `/asistencia`, `/locaciones` (con campos en español: `titulo`, `cupoMaximo`, `fechaInicio`, `categoriaPrecio`…).
- **Emite a Analítica** (cola):
  - `evento.creado {eventoId, titulo, locacionId, sede (texto), cupoMaximo, fechaInicio, fechaFin, esPago, categoriaPrecio, emitidoEn}` "alimenta la frecuencia".
  - `inscripcion.registrada {inscripcionId, eventoId, usuarioId, rol, pagoConfirmado, emitidoEn}` "alimenta la concurrencia".
  - `asistencia.confirmada {inscripcionId, eventoId, usuarioId, confirmadaEn, emitidoEn}` "alimenta el presentismo".
- **También emite** `evento.recordatorio` a la cola de notificaciones de CORE (v1: `events.reminder.requested.v1`).
- **Estado declarado por el propio equipo:** "el recordatorio y los tres eventos hacia Analítica todavía no se emiten" y "falta que Analítica confirme los tres eventos" (xlsx M6, notas finales). La hoja «CORRECCIONES PROFESOR» marca que **"Analítica Institucional no consume los eventos listados"**, que el endpoint de descuento de saldo no es el de CORE y que los endpoints de Backoffice no son los especificados.
- **Cancelación de inscripción:** fuera del alcance del TP (xlsx M6, fila `GET /inscripciones`).
- **Consume:** CORE (JWT), `POST {CORE}/saldo/descontar` (no es el de CORE, según corrección), Backoffice (`/backoffice/sedes/{sedeId}/espacios`, `/tarifas/vigente`, no vigentes según Trello).

### Módulo 8 · Backoffice (xlsx M8, hojas «Flujo de Datos», «Dependencias», «Datos maestros», «API del portal», «Notas y supuestos»)
- **Emite:** `backoffice.user.upserted.v1`, `backoffice.user.disabled.v1`, `backoffice.rate.changed.v1`, `backoffice.location.upserted.v1`, todos por `POST /internal/v1/events`.
- **Para Analítica** (hoja «Dependencias», criticidad Media): altas, bajas y roles de usuarios, sedes para agrupar; **"los gastos administrativos los obtiene de CORE por `concept = PAYROLL`, no de mí"**; datos de sueldos solo agregados por `concept`, nunca por persona (hoja «Datos maestros», «Legajo salarial»). Usuarios por `GET /api/v1/backoffice/users/{userId}` y directorio paginado; sedes por `GET /api/v1/backoffice/sites` (**corregido por Trello a `/internal/v1/sites`**).
- **Reglas:** "CORE no conoce sedes: la dimensión «sede» de los dashboards sale de mí y de los eventos de cada módulo" (hoja «Datos maestros», «Sede»). Patrón: carga inicial por REST, cambios por evento, re-consulta por REST al recibir el evento (hoja «Notas y supuestos»).
- **No emite** `docente.alta`, `sede.definida`, `sueldos.liquidados` ni `gasto.registrado` (los cuatro eventos de Backoffice de nuestro contrato propio).

### Módulo 9 · Gestión Académica (xlsx M9, hoja «Flujo de Datos»)
- **Solo REST con ids numéricos:** carreras (con `facultad`), planes, asignaturas, correlatividades, sedes y aulas, asignaciones y agenda, **períodos** (`{id, anio, numero, fechaInicio, fechaFin}`), turnos de examen, validación de regularidad.
- **No hay eventos ni referencia a Analítica ni a CORE.** Nuestro xlsx M7 supone `GET /api/planificacion/cursos?periodoId=`, `/cursos/{cursoId}`, y que `GET /planificacion/sedes` devuelve `backofficeSiteId`: **ninguna de esas rutas ni ese campo figuran en el xlsx de G9**.
- **Formato real observado** de lo que envía Gestión Académica a nuestro endpoint (del documento viejo de integración con Gestión Académica, ya absorbido; sin fecha, ~2026-10-12): `{"tipo":"academica.resultado.publicado","ocurridoEn","alumnoId","cursoId":42,"notaFinal","estado":"APROBADO","fechaResultado","enlace"}`: sin `eventId`, sin `sourceModule`, sin `materia`, sin sede, sin `docenteId`, sin `cuatrimestre`. Nuestro xlsx M7 dice que G9 "hoy" lo publica como `resultado.publicado` en su propia cola y debe pasar a `POST /internal/v1/events` de CORE (xlsx M7, fila `academic.course-result.published.v1`).

### Módulo 10 · CORE (xlsx M10, hoja «Hoja1», v5)
- Auth (`login`, `refresh`, `logout`, `me`, `forgot/reset`), JWKS, `service-auth/token`, `introspect`, identidades (`PUT`, `PATCH status`), wallet (`top-ups`, `me`, `debits`, `reversals`, `credits`), `POST /internal/v1/events`, `subscriptions` (webhooks, challenge, firma `X-UADEnet-Signature`), notificaciones (REST y WebSocket `notification.created`).
- **Analítica:** `GET /internal/v1/wallets/aggregates` (`{range, currency, outstandingBalance, groups}`) y `core.wallet.transaction-posted.v1`. **No menciona la cola `analytics.all-events.v1`**; nuestro xlsx la pide a G10.
- **Superado por Trello y Novedades** en roles (9 → 11), `iss`, permisos y errores (sección 3.1).

### Módulo 7 · Analítica (xlsx M7, hoja «Flujo de Datos»; 2026-10-21)
Es el diseño objetivo, alineado a CORE v1:
- **Entradas:** login/refresh/logout/me, JWKS, headers del gateway (`X-User-*`, `X-User-Career-Ids`, `X-Core-*`), `service-auth/token` con `analytics-service`, `wallets/aggregates`, **cola `analytics.all-events.v1`** (`#`, inbox `inbox_messages`), y los eventos: `backoffice.user.upserted/disabled`, `backoffice.location.upserted`, `academic.course-result.published.v1` (nombre propuesto), `academic.term-defined.v1`, `library.penalty.applied.v1`, `dining.*`, `store.purchase.completed.v1`, `events.*`, `core.wallet.transaction-posted/rejected/reversed.v1`.
- **Consultas REST directas** con token de servicio: Backoffice (`/api/v1/sites`, `/api/v1/users/{userId}`; **ahora `/internal/v1/...`** por Trello) y Gestión Académica (`/api/planificacion/cursos`, `/cursos/{id}` con docentes, `/periodos`, `/sedes`, `/api/academica/carreras|planes|asignaturas`).
- **Salidas:** `GET /api/v1/analytics/dashboard/academic?siteId=&termId=`, `/dashboard/financial?siteId=&month=`, `/events/stats?siteId=&month=`, `/filters`, y health. Permisos `analytics:academic:read` (académico y eventos) y `analytics:finance:read` (financiero).
- **Aclara:** de `core.wallet.transaction-posted` no se persiste `userId`; de `store.purchase.completed` tampoco; los totales oficiales salen de `aggregates`.

---

## 6. Matriz de brechas

Se compara, evento por evento, **tres cosas**: lo que implementaba nuestro backend hasta el 2026-11-05
(contrato propio, ya **retirado**: hoy el backend sólo acepta el envelope v1, ver «Estado de implementación»),
el catálogo vigente de CORE (v1 §11 + novedades) y lo que publica cada equipo según su xlsx y Trello. Las
filas de «Nuestro evento» de 6.1 a 6.3 son el diseño anterior y se conservan como histórico: el catálogo
vigente está en `backend/src/domain/entities/event-catalog.ts`. El contrato propio difería de v1 en lo estructural:

| | Contrato propio (retirado el 2026-11-05) | CORE vigente (implementado) |
|---|---|---|
| Envoltura | `{eventId, sourceModule, eventType, occurredAt, payload}` | `{specVersion, eventId, eventType, source, occurredAt, subject, correlationId, causationId, actor, data}` |
| `eventType` | `sustantivo.verbo`, único por módulo, **sin versión** (`resultado.publicado`) | `{source}.{entidad}.{acción}.v{n}` (`teacher.exam-result.published.v1`) |
| Módulos | `sourceModule` en español (`portal-estudiante`, `gestion-academica`, `eventos`, `core`…, 9 valores) | `source` en inglés (`student`, `teacher`, `library`, `dining`, `store`, `events`, `academic`, `backoffice`, `core`) |
| Ids | strings libres (`alumno-456`, `curso-42`); sede = slug (`montserrat`, `sede-centro`) | UUID v4; sede = `siteId` UUID de Backoffice |
| Dinero | `number` en ARS | string decimal con 2 decimales + `currency` |
| Fechas | `occurredAt` ISO 8601 + fecha de negocio `AAAA-MM-DD` (hora de Argentina) | ISO 8601 UTC |
| Sede | `sedeId` en casi todo payload | `siteId` solo en `dining.reservation.created.v1` (y opcional en tienda); CORE no conoce sedes |
| Transporte | `POST /api/analytics/events` público, sin auth | `POST /internal/v1/events` (CORE) + cola `analytics.all-events.v1` |
| Idempotencia | `eventId` único, duplicado = `201` | `eventId` UUID; inbox con PK; entrega al menos una vez |

Leyenda de la columna «Estado»: **OK** = equivalente directo; **Mapeable** = se puede adaptar con
transformación o consulta REST; **Sin fuente** = ningún módulo lo emite; **Rota** = falta algo imprescindible.

### 6.1 Tablero académico

| Nuestro evento (módulo · tipo) | CORE vigente | Lo que publica el equipo | Brecha / acción | Estado |
|---|---|---|---|---|
| `gestion-academica · resultado.publicado` {alumnoId, cursoId, materia, comision, docenteId, sedeId, cuatrimestre, notaFinal, estado, aprobado, fechaResultado} | **No existe** un resultado final de curso. Existe `teacher.exam-result.published.v1` {studentId, courseId, subjectId, examId, grade, result, publishedAt} (Portal Docente → Académica, Analítica), que es por **examen** | G9 (xlsx M9): nada. G9 real (INTEGRACION-ACADEMICA): `academica.resultado.publicado` {alumnoId, cursoId (número), notaFinal, estado, fechaResultado, enlace}. G2 (xlsx M2): `nota.publicada {examId, studentId, grade, status}` y `acta.cerrada`. Nuestro xlsx M7 propone `academic.course-result.published.v1` {studentId, courseId, subjectId, periodId, siteId, finalGrade, status, resultDate}, "a registrar en el catálogo de CORE" | Falta definir **quién emite la aprobación final** y con qué nombre; falta en todos `materia`/`subjectId` legible, `docenteId`, sede y cuatrimestre salvo el evento propuesto. Hay que pedir a G9 el evento y registrarlo en CORE | Rota |
| `gestion-academica · resultado.modificado` | No existe | Nuestro xlsx M7: se republica `resultado` con `eventId` nuevo y nos quedamos con el último por alumno y curso | Absorber como reemplazo por (alumno, curso) en vez de evento aparte | Mapeable |
| `gestion-academica · curso.abierto` {cursoId, materia, nombreMateria, facultad, comision, sedeId, cuatrimestre, cupo} y `curso.cerrado` | No existe | Nuestro xlsx M7: consulta REST `GET /api/planificacion/cursos?periodoId=` (`estado EN_CURSO`, `inscriptosActivos`); **esa ruta no figura en el xlsx de G9** | Pedir a G9 las rutas `/cursos` y `/cursos/{id}` (con docentes) y su alias `/internal/v1/...` + permiso a `analytics-service`. Materias en curso = `asignaturaId` distintas con `EN_CURSO` | Rota (sin fuente confirmada) |
| `gestion-academica · cuatrimestre.definido` {cuatrimestre `2026-2C`, inicio, fin} | `academic.term-defined.v1` {termId, startDate, endDate}; lo consume Analítica | G9 (xlsx M9): `GET /periodos` {id, anio, numero, fechaInicio, fechaFin}; no publica el evento | El evento v1 **no trae `anio`/`numero`**: la etiqueta `AAAA-NC` sale del REST de períodos. Cambia el nombre de campos | Mapeable |
| `portal-docente · curso.creado` {cursoId, docenteId, materia, sedeId, cuatrimestre} | No existe | Nuestro xlsx M7: docentes de cada curso por `GET /api/planificacion/cursos/{cursoId}` (docenteId UUID de Backoffice) | Mismo pedido a G9; sin eso no hay tasa por docente | Rota |
| `portal-docente · acta.cerrada` {cursoId, alumnoId, nota, aprobado} | No existe | xlsx M2: `acta.cerrada {actId, courseId, studentResults[{studentId, finalGrade}]}` (sin `aprobado`) | Opcional; no alcanza como fuente única | Mapeable |
| `portal-estudiante · inscripcion.confirmada` / `inscripcion.cancelada` | No existen | **No hay xlsx de G1**; G1 no aparece en Trello hacia nosotros | "Estudiantes con cursada activa" no tiene fuente en CORE. Alternativa: `inscriptosActivos` de `/cursos` (cuenta inscripciones, no alumnos distintos) | Sin fuente |
| `backoffice · docente.alta` {docenteId, nombre, facultad} | `backoffice.user.upserted.v1` {userId, email, status, roles, permissions} y `backoffice.user.disabled.v1` | xlsx M8: no emite `docente.alta`; el nombre se pide con `GET /internal/v1/users/{userId}` (`firstName`, `lastName`) | Sin nombre ni facultad en el evento: se resuelve por REST (necesita `backoffice:read`). La **facultad** del docente no existe en Backoffice; solo en `curso.abierto`/carrera de G9 | Mapeable |
| Filtro de facultad (nuestro, `curso.abierto.facultad`) | — | G9 (xlsx M9): `facultad` está en `carreras` | La facultad de una materia sale de asignatura → plan → carrera (REST de G9) | Mapeable |
| `teacher.attendance.recorded.v1` {studentId, courseId, classDate, present} | Consumen Académica y Analítica | G2 emite `asistencia.registrada {courseId, studentId, date, status}` (nombre distinto) | **No lo usamos hoy.** Útil si se suma asistencia al tablero | No usado |

### 6.2 Tablero financiero

| Nuestro evento | CORE vigente | Lo que publica el equipo | Brecha / acción | Estado |
|---|---|---|---|---|
| `core · saldo.movimiento` {cuentaId, tipo carga/cobro/acreditacion/multa/restitucion, monto, origen comedor/tienda/evento/biblioteca, sedeId, fecha, saldoPosterior} | `core.wallet.transaction-posted.v1` {transactionId, userId, type CREDIT/DEBIT/REVERSAL, concept, amount (string), currency, sourceModule, externalReference, status}; `...-reversed.v1` {transactionId, originalTransactionId, userId, concept REFUND, amount, currency}; `...-rejected.v1` (emisión **no implementada**) | xlsx M10 y M7: Analítica recibe `transaction-posted`. **Eventos de wallet no pueden entregarse por webhook** hasta aislar los movimientos ajenos (Trello 2026-10-20/11-04) | `saldoPosterior` no existe; **ningún evento de wallet trae sede**; `userId` en vez de `cuentaId`; `concept` en vez de `tipo`+`origen`. Incluye conceptos que no modelamos (`TOP_UP`, `PAYROLL`, `SCHOLARSHIP`, `ADJUSTMENT`, `REFUND`). Ver 6.3 | Mapeable, **sin sede** |
| Balance, ingresos y egresos mensuales (de `saldo.movimiento`) | `GET /internal/v1/wallets/aggregates?groupBy=concept&from=&to=`: `outstandingBalance` (saldo vigente a la fecha), `walletCount`, grupos `{key, type, count, total}`; sin personas | xlsx M7 y M10 | Reemplaza el cálculo por eventos: saldo acumulado = `outstandingBalance` (**foto del momento de la consulta**, no una serie histórica; para la serie hay que guardar cada consulta mensual); ingresos/egresos = suma de grupos `CREDIT`/`DEBIT`. **Sin filtro por sede** (el agregado no trae `siteId`) | Mapeable, **sin sede** |
| `backoffice · sueldos.liquidados` {periodo, sedeId, monto, desglose} | Gasto salarial = grupo `PAYROLL` de aggregates | Trello 2026-10-22 (G7); xlsx M8: Backoffice no lo emite | Sin desglose docentes/administrativos ni sede | Mapeable, **sin sede ni desglose** |
| `backoffice · gasto.registrado` {categoria, monto, sedeId, fecha} | No existe | Trello 2026-10-22: "ningún módulo produce otros gastos administrativos" | Recortar categorías del tablero a sueldos | Sin fuente |
| `tienda · compra.realizada` {compraId, sedeId, fecha, total, items[{producto, categoria, unidades, monto}]} | `store.purchase.completed.v1` {purchaseId, userId, total, currency, items[]} | Trello 2026-10-22: pedimos `items[]` con `productId`, `productName`, `category`, `quantity`, `subtotal` string; `siteId` opcional. **No hay xlsx de G5** | Renombres (`producto`→`productName`, `unidades`→`quantity`, `monto`→`subtotal`), montos string, `siteId` opcional (si falta no hay filtro de sede) y UUID. `items[]` no está en el catálogo | Mapeable |
| `tienda · compra.devuelta` | No existe (la reversa de wallet no trae ítems y solo ocurre si falla el stock) | — | Devoluciones parciales sin fuente; la consigna no las pide | Sin fuente |
| `comedor · reserva.confirmada` {reservaId, monto, sedeId, turno, fecha} | `dining.reservation.created.v1` {reservationId, userId, siteId, slotAt, amount, currency} | xlsx M4: idéntico a v1 | Renombres, `siteId` UUID, `amount` string, `slotAt` (sin `turno` ni `fecha` separados) | OK |
| `comedor · reserva.cancelada` {reservaId, montoDevuelto, sedeId} | `dining.reservation.cancelled.v1` {reservationId, userId, slotAt, cancelledAt} | xlsx M4: idéntico a v1 | Sin `siteId` ni monto: se cruza con la reserva original por `reservationId` (hay que guardarla) | Mapeable |
| `comedor · reserva.asistida` {reservaId, montoRestituido, sedeId} | `dining.attendance.recorded.v1` {reservationId, userId, attendedAt}; reintegro por `core.wallet.transaction-reversed.v1` | xlsx M4: idéntico a v1. La restitución es **total** (reversa sin `amount`) | Sin monto ni sede: monto = el de la reserva original. Define si "facturación" descuenta lo restituido (pregunta abierta, sección 9) | Mapeable |

### 6.3 Eventos académicos (estadísticas de eventos)

| Nuestro evento | CORE vigente | Lo que publica G6 (xlsx M6) | Brecha / acción | Estado |
|---|---|---|---|---|
| `eventos · evento.realizado` {eventoId, tipoEvento, locacion, cupo, sedeId, fecha, costo} | `events.event.created.v1` {eventId, title, locationId, startAt, endAt, capacity, price, currency} | `evento.creado` {eventoId, titulo, locacionId, sede (texto), cupoMaximo, fechaInicio, fechaFin, esPago, categoriaPrecio, emitidoEn} | **`tipoEvento` no existe en ninguna de las dos** (agrupamos por tipo); sede: `locationId`→`siteId` por `backoffice.location.upserted.v1` o nombre→`siteId` por `GET /sites`; "realizado" = pasó `endAt` (xlsx M7), no un evento propio. G6 todavía no lo emite | Rota por `tipoEvento` |
| `eventos · inscripcion.confirmada` {eventoId, personaId, monto} | `events.registration.completed.v1` {eventId, registrationId, userId, amount, currency} | `inscripcion.registrada` {inscripcionId, eventoId, usuarioId, rol, pagoConfirmado, emitidoEn} | G6 no manda `amount` (solo `pagoConfirmado`); ingresos por inscripción paga sin fuente salvo `core.wallet.transaction-posted` (`EVENT_REGISTRATION`) | Mapeable |
| `eventos · asistencia.registrada` {eventoId, personaId, presente} | `events.attendance.recorded.v1` {eventId, userId, present, checkedAt} | `asistencia.confirmada` {inscripcionId, eventoId, usuarioId, confirmadaEn, emitidoEn} | G6 solo emite presentes (no `present: false`); presentismo = presentes / inscriptos | Mapeable |
| `eventos · evento.cancelado` / `inscripcion.cancelada` | No existen | G6: cancelación de inscripción "fuera del alcance del TP" | Sacar del contrato (o dejar como opcionales) | Sin fuente |
| `events.reminder.requested.v1` | Lo consume CORE Notificaciones | G6 emite `evento.recordatorio` | No lo usamos | No usado |

### 6.4 Eventos de v1 que no usamos o sin equivalente en nuestro contrato

*Estado (2026-11-05):* resuelto. Cada uno figura en `event-catalog.ts` con su tratamiento: `backoffice.location.upserted.v1` se guarda; `backoffice.user.*` es de efecto lateral (invalida el nombre cacheado); el resto se descarta con ack. Los eventos del contrato propio sin emisor (`sede.definida`, `prestamo.*`) ya no existen en el backend.

| Evento CORE | Uso posible en Analítica |
|---|---|
| `library.penalty.applied.v1` | Multas por mes (nuestro xlsx M7: complementa `LIBRARY_FINE`). **No está en nuestro contrato propio**; Biblioteca sí lo emite |
| `backoffice.user.upserted.v1` / `backoffice.user.disabled.v1` | Invalidar cache de nombres; roles de docentes |
| `backoffice.location.upserted.v1` | Resolver sede de los eventos académicos (`locationId`→`siteId`); **reemplaza `sede.definida`** |
| `teacher.exam-result.published.v1`, `teacher.attendance.recorded.v1` | Hoy ninguno alimenta un tablero |
| `core.wallet.transaction-rejected.v1` | Cobros rechazados por concepto (informativo); emisión no implementada |
| `core.notification.created.v1` | Opcional; no lo necesitamos |
| `biblioteca · prestamo.realizado/devuelto` (nuestro) | **Sin emisor** ni equivalente en v1. Ningún tablero los usa |
| `backoffice · sede.definida` (nuestro) | **Sin emisor**: las sedes no tienen evento; salen de `GET /internal/v1/sites` |

### 6.5 Lo que pedíamos a cada módulo (contrato propio) que sigue valiendo

*Estado (2026-11-05):* el pedido común y las reglas de interpretación están implementados con el contrato v1 (ver `backend/EVENTOS.md`); la carga histórica se resuelve con `npm run backfill:core` (necesita CORE real y `events:read`, pendiente de G10: pregunta 11) y la definición de "facturación" quedó como flag `DINING_REVENUE_NET_OF_ATTENDANCE` (pendiente de G4: pregunta 25).

Del pedido original (documento viejo de datos por módulo, ya absorbido) sigue vigente:

- **Pedido común:** `eventId` estable por hecho (si se reenvía, el mismo id); `occurredAt` con el momento del hecho (no del envío); ids consistentes entre módulos (`alumnoId`, `cursoId`, `docenteId`, sede); montos numéricos en ARS; fechas de negocio sin hora interpretadas en hora de Argentina (si existen, mandan para asignar un hecho a día/mes/cuatrimestre). *Con CORE vigente se traduce a:* `eventId` UUID v4, `occurredAt` UTC, `userId` UUID, `siteId` UUID, dinero string.
- **Carga histórica única:** al conectarse, cada módulo manda una sola vez sus eventos desde el inicio de **2026-1C** con el `occurredAt` original, para poder comparar contra el período anterior. Como el `eventId` es estable, la carga se puede repetir. **No hay constancia de que se lo hayamos pedido a nadie**, y con la cola de CORE habría que resolverlo con `GET /internal/v1/events?type=&source=&from=&to=` (consulta para IT) o con el replay de CORE (`POST /internal/v1/events/{eventId}/replay`, lo hace IT) (CORE v1, §9; Trello, «G8→G10 · Dudas del Swagger…», 2026-11-04). Abierto.
- **Reglas de interpretación nuestras:** `tipoEvento` no figura en la consigna pero los tableros agrupan por tipo; un evento cuenta como realizado cuando pasa su fecha de fin; las anulaciones o correcciones restan o reemplazan lo contado por el evento original.
- **A decidir:** si "facturación" del comedor es lo cobrado, lo cobrado menos lo restituido por asistencia, o solo las reservas no usadas (la consigna dice que el costo se restituye si el usuario se presenta; Consigna, p. 3).
- **Hueco:** categorías de gasto distintas de sueldos (mantenimiento, licencias): ningún módulo las emite; si Backoffice no las manda el tablero se recorta (confirmado por Trello, 2026-10-22).

### 6.6 Gestión Académica: diferencias del evento real (histórico)

*Estado (2026-11-05):* el normalizador (`event-normalizer.service.ts`) y los «Formatos tolerados» **se eliminaron**. El evento real de G9 (6.1) ya no se absorbe: sin `specVersion`, `source` ni `eventId` UUID responde `400` (`INVALID_EVENT`), y por la cola va a la DLQ. Se espera que G9 publique el evento propuesto del catálogo (`academic.course-result.published.v1`, pregunta 17); mientras tanto el tablero académico no tiene tasas de aprobación. La tabla muestra cómo se trataba cada diferencia con el contrato propio:

| # | Ellos mandan | Nosotros esperamos | Cómo se trata |
|---|---|---|---|
| 1 | `tipo: "academica.resultado.publicado"` | `sourceModule` + `eventType` | Normalizador: el prefijo antes del primer punto es el módulo (alias como `academica`) |
| 2 | `ocurridoEn` | `occurredAt` | Alias |
| 3 | Campos sueltos en la raíz | Todo en `payload` | Lo que no es envelope pasa a `payload` |
| 4 | Sin `eventId` | Obligatorio | Se deriva un hash determinístico y se avisa en `warnings`; **lo correcto es que lo manden ellos** (nunca un UUID aleatorio: rompe la idempotencia) |
| 5 | `cursoId: 42` (número) | string, y `materia` | Ids numéricos → string; `materia` hay que pedirla |
| 6 | Sin sede | `sedeId` | Hay que pedirla o resolverla por REST; sin esto no entra a los filtros |
| 7 | `estado: "APROBADO"` | `aprobado` boolean | `aprobado = estado === "APROBADO"` |
| 8 | `alumnoId` | ¿legajo? | Sin resolver; según CORE el identificador global de personas es el `userId` UUID, no el legajo |
| 9 | `resultado.publicado` | catálogo propio | Con CORE vigente deja de ser un problema de nombre: no existe resultado de curso en el catálogo v1 (6.1) |
| 10 | `enlace`, `notaFinal`, `fechaResultado` | extra | Viajan en el `payload` sin molestar |

Con el contrato propio el evento se aceptaba con `201` y `warnings`, pero **no alimentaba los tableros**; hoy se rechaza.
**Pendiente con G9:** `eventId`, `materia`, sede, `docenteId`, `cuatrimestre` o, mejor, el evento propuesto con el catálogo de CORE.

### 6.7 Brechas del xlsx M7 contra el código (resueltas el 2026-11-05)

Al 2026-11-04 nuestro xlsx M7 (21/10) y lo que dijimos en Trello (22/10: "`POST /api/analytics/events` ya no existe") no coincidían con el código, que ingería por `POST /api/analytics/events` con el contrato propio. Estado hoy:

| Tema | xlsx M7 / Trello | Estado | Dónde |
|---|---|---|---|
| Ingesta | Cola `analytics.all-events.v1` + envelope v1 | **Resuelto**: consumer (con `RABBITMQ_URL`) y `POST` como mock de la cola (con `EVENTS_HTTP_INGEST=true`). **Pendiente de G10**: que la cola y la credencial existan | `infrastructure/messaging/`, `backend/EVENTOS.md` |
| Prefijo de API | `/api/v1/analytics/...` vía gateway | **Resuelto**: las rutas también se montan bajo `/api/v1` (se conserva `/api/analytics` para el frontend) | `index.ts` |
| Filtros | `siteId`, `termId` (UUID), `month` | **Decidido distinto**: se mantienen `sedeId` (ahora el `siteId` UUID de Backoffice), `cuatrimestre` (`2026-2C`), `facultad` y `periodo` (mes); el frontend ya los usa. Si G10/la cátedra exigen los del xlsx, es un cambio de validators | `interfaces/http/validators/analytics.validator.ts` |
| Permisos | `analytics:academic:read`, `analytics:finance:read` | **Pendiente de G10** (no existen): se otorga por rol; el código ya aceptaría esos permisos | `domain/entities/role.entity.ts` |
| Roles de CORE | `ACADEMIC_ADMIN`, `FINANCE_ADMIN` | **Resuelto**: `ACADEMIC_ADMIN` → académica, `FINANCE_ADMIN` → financiera, `ADMIN` → ambas | `domain/entities/role.entity.ts` |
| Sedes | `GET /internal/v1/sites` | **Resuelto** con `BackofficeGateway` (mock o HTTP). **Pendiente de CORE**: `backoffice:read` para `analytics-service` | `infrastructure/integrations/backoffice/` |
| Financiero | `aggregates` + `transaction-posted` | **Resuelto**: sólo `aggregates` (los `core.wallet.*` se descartan). **Pendiente de G10**: `wallet:read:aggregates` y semántica de `outstandingBalance` | `financial-stats.builder.ts`, `wallet-snapshot.job.ts` |
| Facultad | `facultyTrends` | **Resuelto**: tendencia y filtro por facultad desde las carreras de Gestión Académica | `academic-stats.builder.ts` |

---

## 7. Impacto en Analítica: qué tendríamos que cambiar

Lista priorizada. Cada punto indica si fuentes posteriores a v1 ya lo cambiaron.

| # | Cambio | Por qué | ¿Modificado por fuentes posteriores a v1? | Estado (2026-11-05) |
|---|---|---|---|---|
| 1 | **Decidir la vía de ingesta** y pedir la cola. Opciones: (a) consumir `analytics.all-events.v1` de RabbitMQ con inbox; (b) webhooks por `eventType` (no sirven para wallet); (c) mantener `POST /api/analytics/events` como entrada paralela y mapear envelope v1. Pedir a G10 la cola con dueño, `eventTypes`, entorno y responsable, y credenciales de **lectura** | Es la dependencia de todo lo demás. Hoy no hay constancia de que la cola exista | **Sí.** Trello (2026-10-20): se pide por canal y no por PR; credenciales de consumo de solo lectura; el NACK no reintenta solo; wallet no por webhook | **Resuelto**: consumer RabbitMQ y POST mock (`infrastructure/messaging/`). **Pendiente de G10**: cola, credencial de lectura y entorno (pregunta 1) |
| 2 | **Adaptar el envelope y los nombres**: aceptar `source`/`eventType` con `.v1`/`data`; mapear los eventos de v1 a los de nuestras queries (6.1-6.3); montos string; ids UUID; `siteId` | Nuestro contrato difiere en todo (sección 6). Un mapeo en el normalizador existente evita reescribir las queries | No | **Resuelto**: `event-catalog.ts` y `event-envelope-validator.service.ts`; sin normalizador |
| 3 | **Financiero desde `GET /internal/v1/wallets/aggregates`**: saldo = `outstandingBalance`; ingresos/egresos y sueldos por `concept`. Guardar cada consulta mensual (el endpoint da una foto, no una serie). Pedir `wallet:read:aggregates` para `analytics-service`. **Se pierde el filtro por sede del financiero** salvo comedor y tienda (que sí traen sede) | Cambia cómo se calculan saldo acumulado, ingresos y egresos | **Parcial.** Trello (2026-10-22) fija que sueldos salen de `PAYROLL`; las Novedades (04/11) confirman que `FINANCE_ADMIN` tiene `wallet:read:aggregates`, pero **no dicen nada del cliente de servicio de Analítica** | **Resuelto**: `financial-stats.builder.ts`, `CoreWalletGateway`, `wallet-snapshot.job.ts`. **Pendiente de G10**: `wallet:read:aggregates`, Swagger, `siteId`, semántica de `outstandingBalance` (preguntas 2, 7, 8) |
| 4 | **Login real contra CORE**: validar JWT con JWKS (RS256, `iss` = URL de Railway, `aud` = `uadenet`, `exp`), autorizar con `permissions`, leer `X-User-*`; reemplazar el mock. Mapear roles: académica ← `ACADEMIC_ADMIN`; financiera ← `FINANCE_ADMIN` (o permisos `analytics:*` si CORE los crea). Pedir identidades de prueba con esos roles | CORE ya está en Railway y tiene usuarios de prueba solo `ADMIN`/`STUDENT`/`TEACHER` | **Sí.** Novedades 04/11: cambió `iss`; no hay permisos de analítica ni usuarios de prueba académico/financiero | **Resuelto**: proxy `/api/auth`, `jwks-token-verifier.ts`, mapeo en `role.entity.ts`. **Pendiente de G10**: identidades de prueba, permisos `analytics:*`, `iss` real (preguntas 3, 4, 32) |
| 5 | **Sedes por REST**: `GET /internal/v1/sites` (carga inicial + cache) con `backoffice:read`, `sedeId` UUID, `timezone` para agrupar por mes local; resolver `locationId`→`siteId` con `backoffice.location.upserted.v1`. Retirar `sede.definida` | Backoffice no emite `sede.definida` ni eventos de sede | **Sí.** Trello (2026-10-20/27, 2026-11-04) cambió `/api/v1/sites` a `/internal/v1/sites` y exige `backoffice:read` (pendiente de CORE) | **Resuelto**: `BackofficeGateway` y `backoffice.location.upserted.v1`. **Pendiente de G8/G10**: `backoffice:read` y histórico de locaciones (preguntas 13, 34) |
| 6 | **Académico: pedir a G9** el evento de resultado final de curso y las rutas `/cursos`, `/cursos/{id}`, `/sedes` (con `backofficeSiteId`) bajo `/internal/v1` + permiso a `analytics-service`. Mientras tanto la tasa de aprobación por materia, docente y sede no tiene fuente confirmada | El xlsx de G9 no tiene esas rutas ni emite eventos | No (no hay respuesta de G9) | **Pedido hecho, pendiente de G9** (evento y rutas, preguntas 17 y 18). Implementado contra la ruta propuesta y mocks; sin el evento el tablero no muestra tasas |
| 7 | **Eventos académicos**: pedir a G6 `tipoEvento` (o definir otro criterio de agrupación), `amount` en la inscripción y los nombres v1 (`events.*.v1`); G6 aún no emite | Las estadísticas por tipo no se pueden calcular | No | **Resuelto de nuestro lado**: catálogo `events.*.v1`, `category` opcional y, sin ella, tipo aproximado por clase de precio con un `warning`. **Pendiente de G6**: que emita (preguntas 21 y 22) |
| 8 | **Estudiantes con cursada activa**: sin fuente (nadie emite `inscripcion.*`); evaluar `inscriptosActivos` de `/cursos` o pedir a G1 | — | No | **Resuelto en parte**: se usa `inscriptosActivos` de `/cursos` con la nota «Cuenta inscripciones activas, no alumnos distintos». **Pendiente de G1/G9** (pregunta 27) |
| 9 | **Gateway y rutas**: servir bajo `/api/v1/analytics/*` (el gateway reescribe a `/api/v1/*`), pasar a CORE la URL base por entorno y el secreto de firma | CORE v1, §6 | **Sí.** Trello (2026-10-20/11-04): el secreto va por privado; `X-Core-Signature` HMAC-SHA256 documentado | **Resuelto en parte**: rutas montadas bajo `/api/v1`. **Pendiente de G10**: URL base y secreto de firma; la autorización sale del JWT, no de `X-Core-Signature` |
| 10 | **Errores `problem+json`**, `GET /health/live` y `/health/ready`, propagar `X-Correlation-Id` | CORE v1, §6 y §13 | Solo se agregan los códigos de gateway (Trello 2026-10-20) | **Resuelto**: `problem-json.ts`, `health.routes.ts`, `correlation.middleware.ts` |
| 11 | **Inbox**: llevar `inbox_events` a la estructura de CORE (`event_id` UUID PK, ack tras persistir, DLQ para esquema inválido) y decidir qué hacer con eventos que no usamos (ack y descartar, según nuestro xlsx M7) | CORE v1, §10 | **Sí.** Trello (2026-10-20): cada módulo implementa su retry | **Resuelto**: `inbox.repository.prisma.ts`, migración `inbox_v1`, ack / `nack` a DLQ y reintentos en el consumer |
| 12 | **Dinero y tipos**: pasar a string decimal + `currency` en la validación y las queries | CORE v1, §2 | No (Trello 2026-10-20 lo reafirma) | **Resuelto**: el validador exige dinero como string con 2 decimales y ids UUID |
| 13 | **Retirar del contrato propio** los eventos sin emisor posible: `sede.definida`, `docente.alta`, `sueldos.liquidados`, `gasto.registrado`, `prestamo.*`, `compra.devuelta`, `evento.cancelado`, `inscripcion.cancelada` (eventos) | Backoffice, Biblioteca, Tienda y Eventos dijeron o muestran que no los emiten | **Sí** (xlsx M8, Trello 2026-10-22, xlsx M6) | **Resuelto**: el catálogo sólo tiene eventos v1; se borró el contrato propio |
| 14 | **Documentar la API** con OpenAPI/Swagger además de Postman, y actualizar el diagrama de arquitectura | Consigna, pp. 1 y 6 | No | **Pendiente**: sólo hay colección de Postman (`docs/postman/`); no hay OpenAPI |

Lista original del 2026-11-04 (cuando todavía no se había tocado código); la última columna refleja lo implementado el 2026-11-05. Lo que funciona hoy: ingesta v1 por cola o POST mock, tableros desde el inbox y los gateways (con mocks hasta que los otros módulos estén listos) y login contra CORE o su mock.

---

## 8. Diseño y prototipo vigente

**Origen:** prototipo de Claude Design (proyecto `765c19da-4ce2-463d-a247-6b5a76ceb465`;
artefacto publicado: `https://claude.ai/code/artifact/171b45fc-06ce-4d9f-932e-681ae49b6428`).
El prototipo se autodescribe como "datos de ejemplo, sin backend" y define 4 pantallas con un modelo de datos más rico que el original.

### 8.1 Pantallas vigentes

| Pantalla | Contenido |
|---|---|
| **Login** | Mail `@uade.edu.ar` contra el mock de CORE; panel izquierdo navy con "Analítica / Institucional" y los módulos fuente |
| **Shell** | Sidebar de 232 px navy con acento azul (Académica, Eventos académicos, Financiera, Fuentes de datos con hint, card "INGESTA" al pie); header con eyebrow = rol, título, filtros propios de cada sección, botón **Actualizar** por sección y "Cerrar sesión". Debajo de `lg` el sidebar es un drawer (el prototipo es solo desktop con ancho mínimo de 1180 px) |
| **Académica** | 4 KPI (Materias en curso, Tasa de aprobación general, Comisiones activas, Estudiantes con cursada activa) con delta contra el cuatrimestre anterior; barras agrupadas de aprobación por materia en 3 cuatrimestres con tooltip; líneas de tendencia por facultad; grilla de docentes de 2 columnas con barra y delta; nota de ingesta. Filtros: sede, cuatrimestre, facultad |
| **Eventos académicos** | Sección propia, habilitada por el rol académica. 4 KPI (Eventos realizados, Concurrencia total, Presentismo promedio, Ocupación de cupo); frecuencia y concurrencia por mes (barras + área); presentismo por tipo con mejor y peor; tabla con barras. Filtros: sede y mes, independientes del resto |
| **Financiera** | 4 KPI (Saldo acumulado, Ingresos, Egresos con semántica invertida —subir es rojo—, Resultado operativo con margen); balance mensual (barras ingresos/egresos con tooltip + área del saldo acumulado); gastos administrativos en barra apilada 100 %; productos más vendidos con **selector Unidades / Facturación**; comedores por sede (facturación, tickets y ticket promedio). Filtros: sede y mes |
| **Fuentes de datos** | Los 9 módulos emisores con etiqueta, estado, última ingesta y tablero que alimentan; la ven todos los usuarios |

### 8.2 Sistema visual

- Colores: navy `#1A2B48`, azul `#2D5DA1`, verde `#127453`, rojo `#A51C30`, fondo `#F8F9FA`, borde `#E2E6EC`; escala de barras `#D7E1F0` / `#6D94C7` / `#2D5DA1`; deltas positivo `#127453` sobre `#E4F1EB`, negativo `#A51C30` sobre `#F7E4E7`, neutro `#647188` sobre `#F1F3F6`; gastos administrativos en 7 azules de `#1A2B48` a `#DCE5F1` (definidos por backend en `infrastructure/config/dashboard.config.ts`).
- Tipografías: Libre Caslon Text (titulares) y Hanken Grotesk (cuerpo); `font-variant-numeric: tabular-nums`; cards con borde de 1 px y radio de 10 px.
- **Sin librería de gráficos:** todo es `div` con altura proporcional o `<svg>` con geometría calculada (primitivas en `frontend/src/presentation/components/charts/`: barras agrupadas, líneas, área, bar-list, barra apilada, tooltip, leyenda). Hay dos componentes de delta distintos: chip con fondo en los KPI (`TrendPill`) y texto de color plano en el resto (`DeltaLabel`).
- Dinero en pesos con formato corto; montos menores a un millón se muestran en pesos completos (commit `afd7f7f`, 2026-11-04).

### 8.3 Decisiones vigentes de comportamiento

- Los números salen de eventos (inbox) y de las consultas a CORE, Backoffice y Gestión Académica; sin datos para un recorte, ceros y listas vacías, y si una fuente falla el bloque sale vacío con un aviso. Los deltas son neutros si no hay período anterior con datos.
- Sede viaja como `sedeId`; "Todas las sedes" (`todas-las-sedes`) siempre primera. Cuatrimestres desde `periodos` de Gestión Académica, meses desde `DASHBOARD_FIRST_MONTH` (hora de Argentina); facultad desde las carreras de Gestión Académica (el id es el nombre).
- Cada rol ve solo sus secciones; "Fuentes de datos" es la única que no depende del rol. Los permisos los asigna Backoffice/CORE, no Analítica.

### 8.4 Historial de decisiones

| Fecha | Decisión |
|---|---|
| 2026-08-27 | Auditoría contra el prototipo y plan de 8 pasos (entidades, backend, sistema visual, sesión, shell, gráficos, tableros); backend con datasets mock 1:1 con el diseño y sin base |
| 2026-10-12/14 | Login `@uade.edu.ar` contra mock de CORE (reemplaza el selector de rol "Acceso simulado"); sedes por `sedeId`; payloads validados por tipo; Fuentes de datos como pantalla real; se quita "Permisos por rol" del menú |
| 2026-11-04 | Postgres + Prisma; se elimina el dataset mock; períodos dinámicos; comisiones activas desde `curso.abierto`/`curso.cerrado`; dataset de demo (`npm run db:demo`); Eventos académicos pasa a sección propia (antes ancla dentro del financiero); botón Actualizar por sección; selector Unidades/Facturación en productos; filtro de facultad en el académico |
| 2026-11-05 | Integración con CORE v1 implementada (fases A a E): envelope v1, consumer RabbitMQ, gateways con mocks por flag, auth contra CORE, tableros sobre inbox y gateways, demo y Postman en formato v1; se retira el contrato propio |
| 2026-10-22 / 11-04 | Se documenta el diseño objetivo alineado a CORE v1 (xlsx M7 del 21/10) y se reúnen en este documento las fuentes de la consigna, CORE, los equipos y Trello |

---

## 9. Pendientes y preguntas abiertas

La lista vigente, con la prioridad de cada pregunta (B bloquea, C condiciona lo que se puede probar con mocks) y las preguntas nuevas (32 a 39), está en [`docs/INTEGRACION.md`, sección 9](docs/INTEGRACION.md#9-preguntas-abiertas): usa **esta misma numeración**. Acá se conserva el texto original de cada pregunta; las marcadas **Resuelto (2026-11-05)** se cerraron con la implementación y las demás siguen **pendientes de terceros**.

### Para CORE (G10)
1. ¿Existe la cola `analytics.all-events.v1` (owner analytics, `#`, DLQ, `maxRetries 3`)? ¿Con qué entorno, credenciales de lectura y responsable? (Trello no registra ninguna card nuestra; el xlsx M7 la pide "a G10".)
2. ¿Tiene `analytics-service` el permiso para `GET /internal/v1/wallets/aggregates` (`wallet:read:aggregates`)? Las Novedades del 04/11 solo lo asignan a `FINANCE_ADMIN`. ¿Cuál es la respuesta exacta en el Swagger?
3. ¿Se crean permisos `analytics:academic:read` y `analytics:finance:read`? Si no, ¿qué roles/permisos usamos para los tableros: `ACADEMIC_ADMIN` / `FINANCE_ADMIN`? El catálogo de las Novedades (p. 4) no los incluye.
4. ¿Pueden crear identidades de prueba con `ACADEMIC_ADMIN` y `FINANCE_ADMIN`? Hoy solo hay `ADMIN`, `STUDENT` y `TEACHER` (Novedades CORE 04/11, p. 2).
5. **Resuelto (2026-11-05):** se reciben por la cola pero se descartan con ack (`event-catalog.ts`); los totales salen de `aggregates`. ¿Recibimos los eventos `core.wallet.*` por la cola con `#`, dado que los webhooks de wallet están frenados por el aislamiento de movimientos ajenos? ¿Y alguno trae sede?
6. **Pendiente de G10/G9 (ver 17):** ¿Registran en el catálogo un evento de resultado final de curso (`academic.course-result.published.v1`, nombre propuesto en nuestro xlsx) y los eventos de Gestión Académica de `curso`? (No figura ninguno en v1.)
7. ¿Se agrega `siteId` a los eventos de wallet, o al menos a `aggregates`? Hoy el financiero por sede solo se puede para comedor y tienda.
8. ¿`GET /internal/v1/wallets/aggregates` devuelve una foto a la fecha (`outstandingBalance`) o puede devolver el saldo a fin de cada mes del rango? Las Novedades no lo aclaran.
9. Credenciales de prueba en texto plano en la card «G6 --> G10 #34» del Trello (2026-11-04): rotarlas.
10. Fecha y ambiente estable para integrar (Trello, «G8→G10 · Entorno de CORE…», 2026-11-04: "esta semana confirman cuándo queda estable el despliegue").
11. ¿Cómo se carga el histórico desde 2026-1C: `GET /internal/v1/events` o `replay` de IT? ¿Con qué permiso (`events:read`)?
12. Cualquier cosa que figure en el Swagger y no en v1/Novedades: contrastar `wallets/aggregates`, el formato del catálogo de eventos y `contracts/events/*.schema.json` (no los tenemos).

### Para Backoffice (G8)
13. Confirmar que `analytics-service` tiene `backoffice:read` (G8 lo aprobó el 04/11; falta CORE).
14. **Resuelto:** el cambio aditivo de `careers` en `GET /internal/v1/users/{userId}` (Trello, «G8→G7 · ¿Consumen eventos…», 2026-11-03) no nos afecta porque solo usamos el nombre.
15. Respuesta nuestra a «G8→Todos» (implementado, falta contestar la card): no publicamos eventos; consumimos `location.upserted`, `user.upserted` y `user.disabled` de Backoffice y consultamos sedes y usuarios por REST.
16. **Pendiente de G8:** `timezone` de la sede para agrupar por mes local; confirmar que está en `GET /internal/v1/sites` (sí, según xlsx M8).

### Para Gestión Académica (G9)
17. Evento de resultado final de curso con `eventId` UUID, `courseId`, `subjectId`, `periodId`, sede, docente, nota y estado (hoy mandan `academica.resultado.publicado` sin `eventId`, `materia`, sede ni `docenteId`).
18. Rutas `GET /internal/v1/cursos?periodoId=`, `/cursos/{id}` (con docentes), `/periodos`, `/sedes` con `backofficeSiteId`, carreras, planes y asignaturas, con token de servicio y autorización del `clientId` `analytics-service`. G9 hoy solo autoriza `backoffice-service` y todavía no expone los alias `/internal/v1`.
19. Ids numéricos (Long) en todo: confirmar cómo viajan en eventos (CORE exige UUID).
20. **Resuelto (2026-11-05):** el cuatrimestre sale de `GET /periodos`; `academic.term-defined.v1` se descarta. Falta que G9 exponga la ruta `/internal/v1/periodos`.

### Para Eventos (G6)
21. `tipoEvento`: no está en `events.event.created.v1` ni en `evento.creado`; ¿lo agregan (campo opcional en el catálogo) o agrupamos por `categoriaPrecio`/`esPago`?
22. Emitir los nombres del catálogo (`events.event.created.v1`, `events.registration.completed.v1`, `events.attendance.recorded.v1`) con `amount` en la inscripción y `present`; hoy declaran que aún no emiten ninguno y "falta que Analítica confirme los tres eventos" (xlsx M6): **respuesta nuestra pendiente**.
23. **Resuelto de nuestro lado:** la sede de un evento sale de `locationId` + `backoffice.location.upserted.v1`; falta que G6 lo emita así.

### Para Tienda (G5), Comedor (G4), Biblioteca (G3), Portales (G1, G2)
24. **Tienda:** confirmar `items[]` (`productId`, `productName`, `category`, `quantity`, `subtotal`) y `siteId` opcional; cerrar las cinco cards «G5→G7 #26–#30» que están «En revisión». No hay xlsx de G5 en la carpeta.
25. **Comedor:** definir "facturación" (cobrado vs. cobrado menos restitución) y la compra de comida (sin concepto en CORE v1); pedirles el xlsx actualizado si cambia.
26. **Biblioteca:** confirmar que `library.penalty.applied.v1` sale por el bus y que no hay `prestamo.*`; en su xlsx no figura Analítica como destino.
27. **Portal Estudiante (G1):** sin xlsx; ¿emiten `inscripcion.*`? Hoy no hay fuente de "estudiantes con cursada activa". **Portal Docente (G2):** sus eventos no usan los nombres de v1 (`teacher.*`).

### Para la cátedra / equipo
28. ¿La entrega del 11/11 y la final del 2/12 admiten integraciones mockeadas, como dijo G8 que dijo la cátedra? La consigna pide integración real en la final (Consigna, p. 6). ¿Qué criterios de evaluación se aplican? La consigna no los trae.
29. **Resuelto (2026-11-05):** vía de ingesta decidida: cola de CORE (consumer) más `POST /api/analytics/events` sólo como mock de la cola (`EVENTS_HTTP_INGEST`), que en producción debe quedar apagado, como dijimos en Trello.
30. **Contradicciones internas (resueltas el 2026-11-05):** (a) eventos pertenece al rol académico en `role.entity.ts`, la ruta, el frontend y el README; (b) `backend/EVENTOS.md` se reescribió para el envelope v1 y la persistencia en Postgres.

### Contradicciones entre fuentes (y cuál manda)

| Tema | Fuentes | Cuál manda |
|---|---|---|
| `iss` del JWT | CORE v1 no fija valor; Trello 2026-11-03 muestra `http://localhost:3000` en Railway | **Novedades 04/11**: URL de la API en Railway |
| Cantidad de roles | Trello 2026-10-20: 9; Novedades y Trello 2026-11-04: 11 | Novedades 04/11 |
| Origen de sueldos | xlsx G7 del 04/10: `movimiento.registrado` de Backoffice; Trello 2026-10-22: `PAYROLL` de CORE | Trello 2026-10-22 |
| Ruta de sedes de Backoffice | xlsx M7 (21/10) y xlsx M8: `/api/v1/sites`; Trello 2026-10-27 y 2026-11-04: `/internal/v1/sites` | Trello |
| `core.wallet.transaction-rejected.v1` | CORE v1 lo lista | Trello 2026-10-20: emisión no implementada |
| Caché de revocación del gateway | doc CORE (Trello 2026-10-20 cita 30 s) | CORE 2026-10-20: consulta en cada request |
| Evento de resultado de curso | xlsx M7 (propuesto) vs. G9 real vs. catálogo v1 (no existe) | **Abierta** |
| Entrega final integrada | Consigna p. 6 vs. G8 citando a la cátedra (2/12 mockeado) | **Abierta**, confirmar con la cátedra |
| Rol que ve eventos | README viejo/`ROLES` (financiero) vs. frontend, ruta y xlsx M7 (académico) | Código y xlsx M7 (**resuelto**: `ROLES` ya dice académico) |
| Credenciales de prueba "por privado" | Novedades 04/11, p. 2 | Trello 2026-11-04 las muestra en texto plano |
