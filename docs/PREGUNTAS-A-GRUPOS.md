# Preguntas a otros grupos — Módulo 7 · Analítica Institucional

Estado de las preguntas con cada grupo, para seguirlas en el Trello de coordinación
(tablero DesaAp2). Cada pregunta abierta indica **el supuesto que toma el código mientras no
haya respuesta**: el código y el flujo de datos
([Flujo_de_Datos_Modulo_7_Analitica.xlsx](Flujo_de_Datos_Modulo_7_Analitica.xlsx)) ya están
hechos sobre ese supuesto. Si la respuesta lo contradice, se ajusta y se avisa.

Base común: contrato de integración CORE v1 y respuestas de CORE en el Trello (20/10). CORE es
dueño del catálogo de eventos, de roles y de permisos. Los módulos se consultan directo entre
backends con el token de servicio de CORE, y el receptor lo valida con el JWKS.

---

## Respuestas que dimos

### A Tienda (G5) — tarjetas #26 a #30 · en revisión

- **#26:** No del todo. El nombre tiene que ser `store.purchase.completed.v1`, que es el registrado en CORE. En `items[]` necesitamos `productId`, `productName`, `category`, `quantity` y `subtotal` como string decimal.
- **#27:** No necesitamos identificar al comprador, ni `userType`.
- **#28:** `siteId` como campo opcional nos sirve.
- **#29:** No necesitamos eventos de stock.
- **#30:** Sólo eventos, por CORE. No necesitamos API de Tienda.

### A Backoffice (G8) — 3 tarjetas corregidas · en revisión

G8 las había cerrado con respuestas sacadas de nuestro flujo de datos viejo (`movimiento.registrado`, `POST /api/analytics/events`). Las corregimos:
- **Granularidad salarial:** de Backoffice no necesitamos nada. Los sueldos salen de CORE: `GET /internal/v1/wallets/aggregates`, concepto `PAYROLL`, total por mes.
- **¿Eventos o pull?** Ambos:
  - eventos: `backoffice.user.upserted.v1`, `backoffice.user.disabled.v1` y `backoffice.location.upserted.v1`;
  - REST directo a su backend, con token de servicio: sedes y ficha de usuario (sólo el nombre; no copiamos datos de personas).
- **Gastos administrativos:** son todos los sueldos que liquida Backoffice, tomados de CORE. Otros gastos no los produce ningún módulo.

---

## Preguntas abiertas

### A CORE (G10)

1. **Cola de eventos.** Pedimos `analytics.all-events.v1` sobre `uadenet.events.v1`, con binding `#`, DLX `uadenet.dlx.v1` y `maxRetries` 3. Dueño: G7. Entorno y responsable: a completar. ¿O nos conviene ir por webhooks (uno por `eventType`)?
   - *Supuesto:* la cola. Mientras tanto, se simula con `POST /api/v1/dev/events`.
2. **Permisos de Analítica.** ¿Pueden sumar `analytics:academic:read` al rol `ACADEMIC_ADMIN` y `analytics:finance:read` al rol `FINANCE_ADMIN`? El primero da el tablero académico y las estadísticas de eventos; el segundo, el tablero financiero. Así no hay que dar permisos de escritura (`academic:manage`) sólo para ver el tablero.
   - *Supuesto:* sí. Las cuentas demo usan esos roles con esos permisos.
3. **Scope de `analytics-service`.** ¿Nuestro token de servicio trae `wallet:read:aggregates` para `GET /internal/v1/wallets/aggregates`?
   - *Supuesto:* sí.
4. **Evento de resultado de Gestión Académica.** ¿Pueden registrar `academic.course-result.published.v1` en el catálogo? Lo publica G9 cuando se carga o corrige la nota final de un alumno en un curso. Lo consume Analítica.
   - *Supuesto:* se registra con ese nombre y con el `data` de la sección de G9.
5. **`aud` del access token.** ¿Qué valor validamos?
   - *Supuesto:* un único `aud` para todo UADEnet (en el mock, `uadenet`).
6. **Swagger y contratos.** ¿Nos pasan la URL del Swagger (`/docs`) y el JSON Schema de `store.purchase.completed.v1`? Lo necesitamos para confirmar los campos de `items[]`.

### A Gestión Académica (G9) — ya enviado al PO

Los resultados finales, los cursos con sus docentes y los períodos son de G9. Lo que pedimos:

1. **Evento de resultado por CORE.** El `resultado.publicado` que hoy publican en su propia cola (`analitica.resultados`) tiene que pasar a `POST /internal/v1/events`, con el sobre de CORE y el `eventType` registrado (ver pregunta 4 a CORE). En el `data` van IDs: `studentId`, `courseId`, `subjectId`, `periodId`, `siteId` (su `backofficeSiteId`), `finalGrade`, `status` y `resultDate`.
   - *Supuesto:* llega así.
2. **`eventId` por publicación.** Cada vez que se carga o corrige una nota, el evento lleva un `eventId` nuevo (UUID v4); sólo los reintentos de la misma publicación lo repiten. Si una corrección reusa el `eventId`, se descarta como duplicada.
   - *Supuesto:* así. Nos quedamos con el último resultado por alumno y curso, según `occurredAt`.
3. **(Opcional) Asignatura en el listado de cursos.** ¿Pueden sumar `asignatura: {id, codigo, nombre}` en `GET /api/planificacion/cursos?periodoId=`, como proponen en su doc? No es bloqueante: lo resolvemos con el catálogo.

**Lo que ya usamos de su API** (directo, con token de servicio, que validan con JWKS según la regla de CORE):
- `GET /api/planificacion/periodos` → cuatrimestres. El código ya lo consume: con `ACADEMIC_URL` configurada usa la API real; sin ella, el mock.
- `GET /api/planificacion/cursos?periodoId=` → materias en curso: `asignaturaId` distintas con `estado = EN_CURSO`.
- `GET /api/planificacion/cursos/{cursoId}` → docentes de cada curso.
- `GET /api/planificacion/sedes` → `backofficeSiteId` de cada sede.
- Catálogo: carreras (con `facultad`), planes y asignaturas.

### A Eventos Académicos (G6)

1. **Migración al catálogo de CORE.** ¿Van a publicar `events.event.created.v1`, `events.registration.completed.v1` y `events.attendance.recorded.v1` con el `data` de CORE? Hoy figuran `evento.creado`, `inscripcion.registrada` y `asistencia.confirmada`, en castellano y sin versión.
   - *Supuesto:* sí. La sede la resolvemos nosotros por `locationId`.
2. **Categoría.** ¿Pueden sumar `category` (charla, taller…) como campo opcional, para el presentismo por tipo de evento?
   - *Supuesto:* no viene, y ese corte queda vacío.

### A Sistema de Comedor (G4)

1. **Compras de comida.** El TP pide pagar compras con saldo, pero CORE sólo tiene `DINING_RESERVATION`. ¿Va a existir un concepto y un evento de compra?
   - *Supuesto:* no. La facturación es lo cobrado en reservas, menos lo restituido por asistencia y las cancelaciones.
2. **Cancelación.** ¿Cancelar una reserva genera una reversa en la wallet?
   - *Supuesto:* sí. La tomamos de `core.wallet.transaction-reversed.v1`.

### A Backoffice (G8)

1. **Rutas backend a backend.** ¿Las consultas de nuestro backend van a `/api/v1/sites` y `/api/v1/users/{userId}` de su backend, o publican rutas internas? ¿Qué permiso tiene que traer nuestro token?
   - *Supuesto:* esas rutas, con nuestro token de servicio.
2. **Campus Online.** ¿Existe como sede en su catálogo?
   - *Supuesto:* sí, con código `ONLINE` y sin comedor.

### Portal del Docente (G2)

No dependemos de ellos. Los resultados finales y los docentes de cada curso salen de Gestión Académica. Los eventos `teacher.*` nos llegan por el binding `#`, pero se descartan.
