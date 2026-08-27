# Auditoría: proyecto actual vs. diseño «UADEnet Analítica Institucional»

## Contexto

El proyecto (Módulo 7 — Analítica Institucional, React + Vite + shadcn en `frontend/`, Node/Express 5 + TypeScript en `backend/`, ambos con arquitectura por capas) fue armado antes de que existiera el diseño. El diseño ya está cerrado en Claude Design (`765c19da-4ce2-463d-a247-6b5a76ceb465`) y define 4 pantallas, un sistema visual propio (paleta UADE navy/azul, tipografías serif + grotesk) y — sobre todo — un **modelo de datos mucho más rico** que el que hoy expone el backend: series por período, deltas contra el período anterior, filtro de sede que reescala todos los números, y desagregaciones (por materia × 3 cuatrimestres, por facultad, por tipo de evento, por mes) que las entidades actuales no pueden representar.

El objetivo de esta etapa es **alinear el código con el prototipo**: mismo layout, mismos datos, mismos filtros. El backend sigue con datos mock (sin DB), pero deja de ser un mock plano y pasa a servir exactamente los datasets y los cálculos del prototipo, con los filtros aplicados server-side.

### Decisiones ya tomadas (respuestas del usuario)

| Tema | Decisión |
|---|---|
| Alcance backend | **Mocks 1:1 con el diseño**. Sin DB. Filtros de sede/período resueltos en el backend. |
| Ingesta de eventos | **No definida todavía**. Diseño yo el contrato (`POST /events`), lo documento, y queda como stub funcional para que los otros módulos lo implementen. |
| Auth y roles | **Simulado, como el diseño**. Selector de rol en el front, sin backend de auth. |
| Sección Eventos | **Como el diseño**: sub-sección dentro del tablero Financiero, con ancla `#eventos` y scroll suave desde el sidebar. |

### Estado actual (actualizado 27/08/2026)

Desde que se escribió este análisis (commit `da33231`) hubo dos commits más en `main` (`5facbae`, `aa2e3ce`) que implementaron **todo el backend del plan**. Falta el frontend completo.

| Paso del plan | Estado |
|---|---|
| Paso 0 — doc en el repo | ✅ Hecho |
| Paso 1 — contrato compartido (entidades) | ✅ Hecho en backend y espejado en `frontend/src/domain/entities/analytics.entity.ts` |
| Paso 2 — backend (datasets, calculadora, repos, endpoints, validación, CORS, `EVENTOS.md`) | ✅ Hecho |
| Paso 3 — frontend: sistema visual (fuentes, tokens de color) | ✅ Hecho |
| Paso 4 — frontend: estado y contexto de sesión (rol/sede/período) | ⏳ Pendiente, sin empezar |
| Paso 5 — frontend: shell (sidebar/header con los datos y filtros reales) | ⏳ Pendiente, sin empezar |
| Paso 6 — frontend: primitivas de gráficos | ⏳ Pendiente, sin empezar |
| Paso 7 — frontend: los 3 tableros | ⏳ Pendiente, sin empezar |

**Hallazgo nuevo (no estaba en la versión anterior de este documento):** el Paso 1 se completó del lado del contrato (`analytics.entity.ts` en el front ya tiene los tipos nuevos: `kpis`, `Delta`, `subjectApprovalRates[].series`, `facultyTrends`, etc.), pero **nada más del frontend se migró a ese contrato**. Como consecuencia, ahora mismo el frontend está roto contra su propio dominio:

- `academic-dashboard.component.tsx`, `financial-dashboard.component.tsx` y `events-dashboard.component.tsx` siguen leyendo campos que ya no existen (`stats.activeSubjectsCount`, `stats.overallApprovalRateTrend`, `row.subjectName` en vez de `row.name`, `stats.approvalRateHistory`, etc.).
- `analytics.client.ts` sigue llamando a los 3 endpoints originales **sin los query params** (`?sede=&cuatrimestre=`/`?sede=&periodo=`) y tipa `getEventsStats` como `EventStats[]`, pero el backend ahora devuelve un **objeto agregado único** (`EventStats`), no un array.
- `use-institutional-analytics.hook.ts` no conoce sede/período ni refetchea ante cambios de filtro.
- No hay `role-selector.page.tsx`, `session.context.tsx` ni `presentation/components/charts/`: la Pantalla 0 y las primitivas de gráficos del Paso 6 todavía no existen como archivos.

Es decir: **el trabajo pendiente es exactamente el Paso 3 al 7 tal como estaban planeados**, más la migración de `analytics.client.ts` y `use-institutional-analytics.hook.ts` al nuevo contrato (que en rigor es parte del Paso 4, punto 4, pero conviene remarcarlo porque hoy el build de `frontend` no compila contra los tipos actuales).

El resto de este documento (secciones 1 y 2) se dejó tal cual se escribió originalmente, como registro de la auditoría inicial contra el diseño; los pendientes que describe ahí ya están resueltos en el backend salvo que se indique lo contrario en la tabla de arriba.

### Qué es cada archivo del diseño

- **`Analitica Institucional.dc.html`** (847 líneas) — la fuente de verdad. Template declarativo (`<sc-if>`, `<sc-for>`, `{{ }}`) + un `<script data-dc-script>` con la clase `Component extends DCLogic` que contiene **todos los datasets y toda la lógica de cálculo** (`renderVals()`, `finVals()`, `sign()`, `clamp()`, `money()`).
- **`support.js`** (1911 líneas) — runtime genérico de Claude Design (parser del template, `DCLogic`, bindings a React). **No tiene lógica del proyecto**: no hay nada que portar de acá.
- **`uploads/*.pdf`** — el TPO y el manual de marca están en el proyecto pero son binarios; el MCP no los puede leer. Si contienen requisitos que no estén en el `.dc.html`, hay que pasarlos aparte.

---

## 1. Auditoría pantalla por pantalla

### Pantalla 0 — Selector de rol («Acceso simulado»)

**Estado: FALTA COMPLETA.** No existe ningún equivalente en el código. Hoy `App.tsx` renderiza directamente `InstitutionalAnalyticsPage`.

El diseño define un layout split `minmax(360px,0.85fr) / 1.15fr`:
- Panel izquierdo navy `#1A2B48`: logo UADEnet, `<h1>` "Analítica / Institucional" (Libre Caslon 44px), bajada, y al pie la lista de **9 chips de módulos** (`académica, inscripciones, evaluaciones, docencia, finanzas, biblioteca, campus, soporte, identidad`) bajo el label "FUENTES DE EVENTOS".
- Panel derecho blanco: eyebrow "ACCESO SIMULADO", `<h2>` "Elegí un rol para continuar", y **2 botones de rol** (`ROLES`: `academica` → "Dirección Académica" / iniciales "DA", `financiera` → "Dirección Financiera" / "DF"), cada uno con avatar cuadrado, nombre, descripción y chip "Disponible". Footer con punto verde: "Última ingesta de eventos: 26/08 04:12 · 9 módulos conectados".

### Shell del dashboard (sidebar + header)

**Estado: EXISTE PERO DISTINTO** — `sidebar.component.tsx`, `dashboard-header.component.tsx`.

| Elemento | Diseño | Código actual |
|---|---|---|
| Sidebar ancho/color | 232px, `#1A2B48`, acento `#2D5DA1` | `w-64`, `#12131a`, acento indigo |
| Ítems nav | Académica · Financiera · **Eventos académicos** (sub-ítem indentado, scroll a `#eventos`) · Fuentes de datos (hint "9", inactivo) · Permisos por rol (inactivo) | Resumen (disabled) · Académico · Financiero · Eventos · Pipeline de eventos (disabled) |
| Ítem activo | fondo `#2D5DA1`, texto blanco | `bg-white/10` + punto indigo |
| Bloque inferior | Card "INGESTA / Eventos recolectados de los 9 módulos de UADEnet." | no existe |
| Header eyebrow | rol actual ("Dirección Académica") | mismo concepto ✅ |
| Header título | "Rendimiento académico" / "Situación económica y financiera" | "Dashboard Académico" / "Dashboard Financiero" / "Estadísticas de Eventos" |
| Filtro Sede | 5 opciones: Todas las sedes, Sede Centro, Sede Belgrano, Sede Pilar, Campus Online. **Funcional**: reescala todos los datos | 3 opciones distintas (Todas, Recoleta, Villa María). **Sin estado ni `onChange`** — decorativo |
| Filtro Período | Label dinámico: "Cuatrimestre" (académica, `2023-2C`…`2026-1C`) / "Período" (financiera, `Mar 2026`…`Ago 2026`). **Funcional** | Siempre "Cuatrimestre", 3 opciones hardcodeadas, **sin estado** |
| Botón derecha | "Cambiar rol" (logout → vuelve al selector) | "Exportar reporte" (**no existe en el diseño**) |
| Ancho mínimo | `min-width:1180px` en header y contenido (layout de escritorio, scroll horizontal) | responsive con `flex-wrap` |

### Pantalla 1 — Tablero Académico

**Estado: EXISTE PERO MUY DISTINTO** — `academic-dashboard.component.tsx`.

| Bloque | Diseño | Código actual | Veredicto |
|---|---|---|---|
| KPIs | **4 cards**: Materias en curso · Tasa de aprobación general · Comisiones activas · Estudiantes con cursada activa. Cada una con valor + unidad + chip de delta coloreado + "vs. {cuatrimestre anterior}" | **3 cards**: Materias en curso · Tasa de aprobación general · Docentes evaluados. Trend como string libre del backend | Distinto: faltan 2 KPIs, sobra 1, el delta es texto plano en vez de calculado |
| Aprobación por materia | **Barras agrupadas**: 8 materias × 3 cuatrimestres (`#D7E1F0` / `#6D94C7` / `#2D5DA1`), grilla punteada, leyenda de períodos, **tooltip en hover** con los 3 valores, y eje X con código + nombre + delta en pp. Orden por tasa ascendente | `ApprovalRateBarList`: lista de barras horizontales de **una sola serie**, color por umbral (verde/ámbar/rojo) | Distinto en forma y en datos (falta la dimensión temporal) |
| Tendencia por facultad | **Gráfico de líneas SVG**: 3 series (`Ingeniería y Tecnología` `#2D5DA1`, `Ciencias Económicas` `#127453`, `Derecho` `#1A2B48`) × 6 cuatrimestres, grilla 50–90%, puntos, y leyenda con último valor + delta | `ApprovalHistoryChart`: barras verticales de **la tasa general**, sin desagregar por facultad | Falta: no hay dimensión "facultad" en ningún lado |
| Aprobación por docente | **Grid de 2 columnas**, 8 docentes: nombre + materia, barra de progreso con color por umbral (≥85 verde, ≥70 azul, resto rojo), tasa, delta en pp. Encabezado "N docentes · muestra de 8" | `<Table>` de 3 columnas con un `<Badge>` de porcentaje | Distinto: forma, delta y total de docentes |
| Footer | Nota con punto verde: "agregados desde eventos de Académica, Docencia y Evaluaciones · última ingesta 26/08 04:12" | no existe | Falta |

### Pantalla 2 — Tablero Financiero

**Estado: EXISTE PERO MUY DISTINTO** — `financial-dashboard.component.tsx` (hoy son 4 tablas; el diseño no tiene ninguna tabla acá).

| Bloque | Diseño | Código actual | Veredicto |
|---|---|---|---|
| KPIs | **4 cards**: Saldo acumulado · Ingresos del período · Egresos del período · Resultado operativo (margen %). Formato `$ 1.842,9 M`. **Egresos usa semántica invertida** (subir = rojo) | **3 cards**: Saldo total institucional · Gastos administrativos · Facturación de comedores. Formato `Intl.NumberFormat` ARS completo, sin deltas | Distinto |
| Balance de saldo | **Barras agrupadas** ingresos `#2D5DA1` / egresos `#A51C30` × 6 meses + tooltip (Ingresos / Egresos / **Resultado**), y debajo un **gráfico de área + línea SVG** del saldo acumulado con su propia grilla y labels | no existe | Falta completo |
| Gastos administrativos | **Barra apilada 100%** (7 categorías, paleta `GASTO_COLORS` de 7 azules) + lista con color, label, monto y % | `<Table>` de 3 filas (Salarios, Mantenimiento, Licencias) | Distinto en forma y en datos (7 categorías con % fijos vs. 3 montos) |
| Productos más vendidos | 6 filas: nombre, "categoría · N u", barra de progreso, facturación | `<Table>` de 3 filas | Distinto |
| Comedores por sede | **Gráfico de barras** por 4 sedes + bajo cada barra: sede, facturación, tickets, **ticket promedio**, delta. Campus Online sin servicio (`fact: 0`, nota) | `<Table>` de 2 filas (sede, facturación) | Distinto: faltan tickets, ticket promedio, delta, y el caso "sin servicio" |
| Footer | Nota "agregados desde eventos de Finanzas, Tienda y Comedores · valores en millones de ARS" | no existe | Falta |

### Pantalla 3 — Estadísticas de Eventos

**Estado: EXISTE PERO MÍNIMO** — `events-dashboard.component.tsx` es una sola tabla.

Además, **cambia de lugar**: en el diseño no es una sección propia, va **dentro del tablero Financiero** (`esEventos = st.rol === "financiera"`), con `id="eventos"` y el sub-ítem del sidebar haciendo `window.scrollTo` al ancla.

| Bloque | Diseño | Código actual |
|---|---|---|
| Encabezado | `<h2>` "Estadísticas de eventos académicos" + bajada con el mes | está como `CardTitle` |
| KPIs | **4 cards**: Eventos realizados · Concurrencia total ("sobre N inscriptos") · Presentismo promedio · Ocupación de cupo | ninguna |
| Frecuencia y concurrencia por mes | **Barras** × 6 meses + tooltip (Eventos / Concurrencia / Presentismo) + **área/línea SVG** de concurrencia | no existe |
| Presentismo por tipo | 6 barras de progreso + resumen "Mayor / Menor presentismo" | no existe |
| Tabla de eventos | 4 columnas: Tipo · Frecuencia (**barra** + "N / mes") · Concurrencia · Presentismo (**barra** + %) | 5 columnas de texto plano (Evento, Frecuencia, Concurrencia, Cupo, Presentismo con Badge) |
| Clave de agrupación | **tipo de evento** ("Clases magistrales abiertas", "Talleres de empleabilidad"…) | nombre de evento puntual ("Semana de la Ingeniería") |

### Sistema visual (transversal)

| Token | Diseño | Código actual |
|---|---|---|
| Tipografía titulares | `Libre Caslon Text` (serif) | `system-ui` |
| Tipografía cuerpo | `Hanken Grotesk` | `Geist` / `system-ui` |
| Fondo app | `#F8F9FA` | `bg-muted/30` (oklch por defecto de shadcn) |
| Navy / azul / verde / rojo | `#1A2B48` / `#2D5DA1` / `#127453` / `#A51C30` | indigo, green-500, amber-500, red-500 de Tailwind |
| Números | `font-variant-numeric: tabular-nums` | no seteado |
| Cards | `border:1px solid #E2E6EC; border-radius:10px` | shadcn `Card` por defecto |

**Nota:** el diseño **no usa ninguna librería de gráficos** — todo es `div` con `height:%` y `<svg>` inline con geometría calculada. Recomiendo mantener ese enfoque: replica el diseño exactamente, no agrega dependencias, y el `.dc.html` ya trae las fórmulas de escala listas para portar.

---

## 2. Backend: qué falta

### Endpoints

| Endpoint | Estado |
|---|---|
| `GET /api/analytics/dashboard/academic` | Existe, **sin query params**. Necesita `?sede=&cuatrimestre=` |
| `GET /api/analytics/dashboard/financial` | Existe, **sin query params**. Necesita `?sede=&periodo=` |
| `GET /api/analytics/events/stats` | Existe, **sin query params**. Necesita `?sede=&periodo=` y devolver un objeto (KPIs + series), no un array plano |
| `POST /api/analytics/events` | Existe pero **sin ninguna validación** — `req.body` va directo al use case |
| `GET /api/analytics/filters` | **FALTA** — sedes y períodos disponibles (hoy están hardcodeados en el front, con valores distintos a los del diseño) |
| `GET /api/analytics/sources` | **FALTA** — los 9 módulos + estado + `lastIngestionAt` (el diseño los muestra en 3 lugares) |
| `GET /api/analytics/roles` | **FALTA** — los 2 roles del selector con nombre, iniciales, descripción |

### Modelos de datos

`academic-stats.entity.ts` — le falta todo lo que el diseño necesita:
- `activeCommissionsCount` y `activeStudentsCount` (KPIs 3 y 4) — no existen.
- `SubjectApprovalRate` tiene un solo `approvalRate`; el diseño necesita **3 valores por materia** (períodos t-2, t-1, t) + `code` + `delta`.
- **No existe el concepto de facultad.** `approvalRateHistory` es global; el diseño necesita `FacultyTrendSeries[]` (nombre, color, 6 puntos, último, delta).
- `TeacherApprovalRate` no tiene `delta`; falta `totalTeachersCount`.
- Los `*Trend` son strings pre-formateados desde el mock; el diseño calcula deltas numéricos con signo y color (`sign()` → `+2.1 pp` / verde-rojo-neutro).

`financial-stats.entity.ts` — es un modelo puntual, el diseño necesita series:
- Faltan `incomeSeries` / `expenseSeries` / `balanceSeries` (6 meses cada una) — hoy solo hay un balance por sede.
- `AdministrativeExpense` no tiene `percentage` ni orden ni color.
- `TopSellingProduct` no tiene `category`.
- `DiningRevenue` no tiene `ticketsCount`, `averageTicket`, `delta` ni el caso "sin servicio".
- Faltan los KPIs derivados: resultado operativo, margen, deltas mes contra mes.

`event-stats.entity.ts` — es una sola interfaz plana:
- Falta el agregado: `totalEvents`, `totalAttendees`, `totalRegistered`, `averageAttendanceRate`, `capacityOccupancy`, `best`/`worst`.
- Falta la serie mensual (`EventMonthlyPoint[]`: mes, eventos, concurrencia, presentismo).
- `eventName` debería ser `eventType`.

**Faltan entidades enteras:** `Site` (sede con `studentsCount` y el `adj` en pp que el diseño usa para reescalar), `Period` (cuatrimestre / mes), `Role`, `EventSource` (módulo + estado + última ingesta), y un tipo `Delta { value, formatted, tone }` compartido.

### Manejo de eventos

Lo que hoy existe: `POST /api/analytics/events` → `RecordEventUseCase` → `AnalyticsRepositoryMock.recordEvent()` → `push` a un array privado que **nadie lee nunca**.

Lo que falta:
- **Validación del body.** `RecordEventDto` no se valida: cualquier JSON entra y se guarda.
- **El enum `SourceModule` no coincide con el diseño.** Código: `portal-estudiante, portal-docente, biblioteca, comedor, tienda, eventos-academicos, backoffice, gestion-academica` (8). Diseño: `académica, inscripciones, evaluaciones, docencia, finanzas, biblioteca, campus, soporte, identidad` (9). **Hay que unificar** — propongo adoptar los 9 del diseño, que son los que la UI muestra.
- **No hay catálogo de tipos de evento** ni esquema por tipo de payload.
- **No hay `lastIngestionAt`** por módulo, que el diseño muestra en 3 lugares.
- **No hay consulta de eventos** (`GET /events`) ni idempotencia (`eventId` del emisor) ni `occurredAt` provisto por el emisor — hoy se pisa con `new Date()`.

### Otros

- CORS a mano en `index.ts` con `Access-Control-Allow-Origin: *` y sin responder `OPTIONS` — funciona para GET/POST simples, se rompe con preflight.
- Sin manejo de errores: si un use case tira, Express 5 devuelve 500 sin cuerpo. Sin validación de query params.
- Scaffolding `example.*` sin usar en ambos proyectos (7 archivos back, 6 front).
- `frontend/src/domain/repositories/analytics.repository.ts` no declara `recordEvent`, aunque el backend lo expone.
- `backend/src/infrastructure/database/example.connection.ts` está vacío (solo un comentario) — coherente con "sin DB", conviene borrarlo.

---

## 3. Plan de implementación

> Estado por paso al 27/08/2026: ver la tabla en «Estado actual» al inicio del documento. Los pasos 0 a 2 están hechos; el detalle de cada uno queda abajo como referencia de lo que efectivamente se implementó. Los pasos 3 a 7 siguen siendo el plan a ejecutar, sin cambios.

### Paso 0 — Dejar el análisis en el repo ✅
Copiar este documento a `ANALISIS-DISENO.md` en la raíz del proyecto (lo pediste explícitamente; en modo plan solo puedo escribir el archivo de plan).

### Paso 1 — Contrato compartido (hacer primero: define todo lo demás) ✅
Reescribir las entidades del backend y espejarlas en el front. Es el paso que desbloquea los otros dos.

- `backend/src/domain/entities/`:
  - `site.entity.ts` — `Site { id, name, studentsCount, subjectsCount, commissionsCount, teachersCount, rateAdjustment }` (los 5 registros de `SEDES`).
  - `period.entity.ts` — `Quarter[]` (`2023-2C`…`2026-1C`) y `Month[]` (`Mar 2026`…`Ago 2026`).
  - `delta.value-object.ts` — `Delta { value, formatted, tone: "positive"|"negative"|"neutral" }` + el helper `sign()` portado del diseño. **Se usa en los tres tableros.**
  - `role.entity.ts` — `Role { id, name, initials, description, availableDashboards }`.
  - `event-source.entity.ts` — los 9 módulos + `lastIngestionAt`.
  - Reescribir `academic-stats`, `financial-stats`, `event-stats` según la sección 2.
  - **Rehacer `SourceModule`** con los 9 valores del diseño.
- Copiar los mismos tipos a `frontend/src/domain/entities/analytics.entity.ts` (hoy ya es una copia manual del backend; mantener esa convención).

### Paso 2 — Backend ✅
1. `backend/src/infrastructure/data/` — portar los datasets del `.dc.html` como constantes tipadas: `SEDES`, `MATERIAS` (8 × 6 valores), `DOCENTES`, `SERIES` (3 facultades), `FIN` (saldo/ingresos/egresos × 6 meses), `GASTOS` + `GASTO_COLORS`, `TIENDA`, `COMEDORES`, `EV_MES`, `EVENTOS`, `ROLES`, `MESES`, `P`.
2. `backend/src/domain/services/analytics-calculator.service.ts` — portar `renderVals()` y `finVals()` del diseño: escalado por sede (`f = alumnos/6842`, `adj` en pp), `clamp(35..97)`, `sign()`, `money()`, deltas contra el período anterior, cálculo de series y máximos para las barras. **Este servicio es el corazón del paso**: es lógica de negocio pura y testeable, sin Express.
3. `analytics.repository.mock.ts` — pasar a recibir filtros: `getAcademicStats(filters)`, `getFinancialStats(filters)`, `getEventsStats(filters)`; agregar `getSites()`, `getPeriods()`, `getRoles()`, `getEventSources()`, `getEvents()`.
4. Use cases: agregar el DTO de filtros a los 3 existentes; nuevos `get-filters`, `get-roles`, `get-event-sources`.
5. `analytics.controller.ts` + `analytics.routes.ts` — parsear y validar `?sede=&periodo=` (fallback a los defaults del diseño: `Todas las sedes`, `2026-1C`, `Ago 2026`); agregar `GET /filters`, `/sources`, `/roles`; validar el body de `POST /events` contra `RecordEventDto`; devolver 400 con mensaje ante entrada inválida.
6. `index.ts` — reemplazar el CORS manual por el paquete `cors` (o al menos responder `OPTIONS`) y agregar un error handler final.
7. Documentar el contrato de ingesta en `backend/EVENTOS.md`: envelope (`eventId`, `sourceModule`, `eventType`, `occurredAt`, `payload`), los 9 módulos, los tipos de evento que cada tablero consumiría, y ejemplos `curl`. Es lo que van a leer los otros equipos.
8. Borrar el scaffolding `example.*` y `database/example.connection.ts`.

### Paso 3 — Frontend: sistema visual ✅ Hecho
1. `index.html` — `lang="es"`, `<title>UADEnet · Analítica Institucional</title>`, y `<link>` a Google Fonts (Libre Caslon Text 400/700 + Hanken Grotesk 400/500/600/700), tal como el `<helmet>` del diseño.
2. `index.css` — definir los tokens del diseño (`--navy #1A2B48`, `--blue #2D5DA1`, `--green #127453`, `--red #A51C30`, `--app-bg #F8F9FA`, `--app-border #E2E6EC`, la escala `#D7E1F0/#6D94C7/#2D5DA1` de las barras, los 7 `--gasto-color-*`), mapearlos a las variables de shadcn (incluida la paleta del sidebar, navy con acento azul), y setear `font-variant-numeric: tabular-nums`. Reemplaza a `@fontsource-variable/geist` (se sacó del `package.json`).

   Notas de la implementación:
   - Los 7 `GASTO_COLORS` exactos del `.dc.html` no habían quedado registrados en la auditoría original (solo "paleta de 7 azules"); se implementó una escala interpolada dentro de la misma familia navy/blue, documentada con un comentario en `index.css` para ajustar si se detecta diferencia contra el prototipo.
   - Se aprovechó para borrar los tokens sueltos que traía el scaffolding por defecto de Vite/shadcn (`--text`, `--text-h`, `--code-bg`, `--accent-bg`, `--shadow`, el bloque `@media (prefers-color-scheme: dark)` y la clase `.dark`), porque no correspondían al proyecto y el diseño no define modo oscuro.
   - Falta `npm install` en `frontend/` para que el lockfile refleje la baja de `@fontsource-variable/geist` (no se pudo correr en este entorno: no hay `node_modules` instalado).
   - Los componentes (`sidebar.component.tsx`, etc.) todavía tienen colores hardcodeados (`bg-[#12131a]`, `indigo-500`) sin migrar a estos tokens — eso es específicamente el Paso 5, no este paso.

### Paso 4 — Frontend: estructura y estado ⏳ Pendiente
1. `frontend/src/presentation/context/session.context.tsx` — rol activo + `sede` + `cuatrimestre` + `mes`, persistido en `localStorage`. Sin router: el diseño usa una sola pantalla con estado (`screen: login|dash`), replicarlo tal cual.
2. `role-selector.page.tsx` — pantalla 0 completa (split navy/blanco, chips de módulos desde `GET /sources`, roles desde `GET /roles`).
3. `App.tsx` — renderizar `RoleSelectorPage` o `InstitutionalAnalyticsPage` según haya rol.
4. `use-institutional-analytics.hook.ts` — **cambio importante**: hoy hace un `Promise.all` único en el mount sin parámetros. Pasar a refetchear cuando cambian sede/período, con `AbortController` para descartar respuestas fuera de orden. Agregar `use-filters.hook.ts`.
5. `analytics.client.ts` — agregar query params y los 3 endpoints nuevos.

### Paso 5 — Frontend: shell ⏳ Pendiente
1. `sidebar.component.tsx` — navy `#1A2B48`, 232px, los 5 ítems del diseño (con "Eventos académicos" como sub-ítem que hace scroll a `#eventos`, y los 2 inactivos), card "INGESTA" al pie. Filtrar ítems según el rol activo.
2. `dashboard-header.component.tsx` — títulos del diseño; `SiteFilter` y `PeriodFilter` **controlados** contra el contexto y alimentados por `GET /filters`; label del período dinámico; **reemplazar `ExportReportButton` por "Cambiar rol"**.

### Paso 6 — Frontend: primitivas de gráficos (reutilizables entre los 3 tableros) ⏳ Pendiente
Crear en `presentation/components/charts/`:
- `grouped-bar-chart.component.tsx` — barras agrupadas + grilla punteada + tooltip en hover. **Lo usan 3 bloques**: aprobación por materia (3 series), balance ingresos/egresos (2 series), frecuencia de eventos (1 serie).
- `line-chart.component.tsx` — SVG multi-serie con grilla y puntos (tendencia por facultad).
- `area-line-chart.component.tsx` — variante con `<polygon>` de relleno (saldo acumulado, concurrencia).
- `bar-list.component.tsx` — reemplazo del actual `approval-rate-bar-list`, generalizado para docentes, tienda, presentismo por tipo.
- `stacked-bar.component.tsx` — barra apilada 100% (gastos).
- Portar las funciones de escala del diseño (`x(n) = 44 + n*(584/5)`, `y(v) = 16 + (1-(v-50)/42)*160`, etc.) a `lib/chart-scale.ts`.

`stat-card.component.tsx` y `trend-pill.component.tsx` se rehacen contra el nuevo `Delta` (chip con `chipBg`/`chipFg` en vez de `tone` de Tailwind). `approval-rate-badge.component.tsx` queda sin uso — borrarlo.

### Paso 7 — Frontend: los 3 tableros ⏳ Pendiente
1. `academic-dashboard.component.tsx` — 4 KPIs, barras agrupadas por materia con eje X de código/nombre/delta, líneas por facultad con leyenda, grid de 2 columnas de docentes, footer de ingesta.
2. `financial-dashboard.component.tsx` — 4 KPIs (con la semántica invertida en Egresos), balance + saldo acumulado, gastos apilados, tienda, comedores, footer. **Renderiza `EventsDashboard` al final**, dentro de `<section id="eventos">`.
3. `events-dashboard.component.tsx` — 4 KPIs, barras + área de concurrencia, presentismo por tipo con mejor/peor, tabla con barras.
4. Borrar el scaffolding `example.*` del front.

---

## Verificación

> El punto 1 ya se puede correr hoy contra el backend implementado. Los puntos 2 a 4 dependen de los pasos 3-7, todavía pendientes.

1. **Backend aislado** — `cd backend && npm run dev`, y contra `http://localhost:3000`:
   - `GET /api/analytics/filters` → 5 sedes y los períodos del diseño.
   - `GET /api/analytics/dashboard/academic?sede=Todas%20las%20sedes&cuatrimestre=2026-1C` → contrastar contra el prototipo: tasa general ≈ 74,3%, 8 materias ordenadas por tasa ascendente empezando por AM-101, 3 series de facultad.
   - Repetir con `?sede=Sede%20Pilar` → todos los valores bajan (`f = 1988/6842`) y las tasas caen 2 pp (`adj: -2`). **Esta comparación es la prueba de que el port de `renderVals()` quedó bien.**
   - `GET /api/analytics/dashboard/financial?periodo=Ago%202026` → saldo `$ 1.842,9 M`, ingresos `$ 2.394,7 M`, egresos `$ 2.196,3 M`.
   - `POST /api/analytics/events` con body válido → 201; con `sourceModule` inexistente → 400.
2. **Frontend** — `cd frontend && npm run dev`. Comparar contra el preview del diseño (`render_preview` del MCP, o el `.dc.html` en el navegador) pantalla por pantalla: selector de rol → tablero académico → cambiar sede a Pilar y verificar que todo se reescala → cambiar cuatrimestre → cambiar a Financiera → click en "Eventos académicos" y verificar el scroll al ancla → "Cambiar rol" vuelve al selector.
3. **Tipos** — `cd frontend && npm run build` y `cd backend && npm run build` sin errores.
4. **Regresión visual manual** — a 1280px y 1440px de ancho, verificando que el `min-width:1180px` del diseño no rompa el layout.

## Riesgos y notas

- **El frontend no compila contra el contrato nuevo.** Ver «Estado actual» arriba: los componentes de los 3 tableros, el `analytics.client.ts` y el hook usan campos del modelo viejo que el backend ya no expone. Hasta que se ejecute el Paso 4 (punto 4-5) y el Paso 7, `cd frontend && npm run build` va a fallar por tipos. No es una regresión del diseño: es consecuencia esperada de haber implementado el contrato del backend antes que su consumidor.
- **Los PDFs del diseño (`TPO - DEA II 2Q 2026.pdf`, manual de marca) no los pude leer** — son binarios y el MCP solo devuelve texto. Si tienen requisitos que no están en el `.dc.html`, este plan no los cubre.
- **El diseño se autodescribe como "Prototipo · datos de ejemplo · sin backend"**; el timestamp "26/08 04:12" y "9 módulos conectados" son literales del prototipo. Los voy a servir desde `GET /sources` como datos mock, no como estado real de ingesta.
- El diseño tiene `hint-placeholder-count="3"` en el `<sc-for>` de roles pero `ROLES` define solo 2. **Implemento 2**, que es lo que el dato manda.
- `POST /events` va a quedar aceptando y guardando eventos en memoria que **ningún tablero lee** (los tableros salen de los datasets mock). Es consecuencia directa de la decisión "mocks 1:1"; queda como base para cuando se defina la ingesta real.
