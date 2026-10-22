# Preguntas a otros grupos — Módulo 7 · Analítica Institucional

Preguntas y respuestas para cargar en el documento compartido de UADEnet, ordenadas por grupo.
Cada pregunta indica **el supuesto que tomamos mientras no haya respuesta**: el código y el
flujo de datos ([Flujo_de_Datos_Modulo_7_Analitica.xlsx](Flujo_de_Datos_Modulo_7_Analitica.xlsx))
ya están hechos sobre ese supuesto. Si la respuesta lo contradice, se ajusta y se avisa.

Base común: contrato de integración CORE v1 (2026-08-05). Analítica consume todo el bus por la
cola `analytics.all-events.v1` (binding `#`) y consulta por REST lo que no viaja en eventos.

---

## Respuestas que les debemos

### A Tienda (Grupo 5) — preguntas 26 a 30

- **26. ¿El payload de `store.order.completed.v1` tiene lo que necesitan?** Usen el nombre del catálogo de CORE, `store.purchase.completed.v1`, con `externalReference` `purchase/{purchaseId}`. Para "productos más vendidos" necesitamos que cada elemento de `items[]` traiga:
  - `productId`;
  - `productName` y `category`, congelados al momento de la compra;
  - `quantity`;
  - `unitPrice` y `subtotal`, como string decimal.
- **27. ¿Necesitan identificar al usuario?** No: no segmentamos compras por persona y no persistimos el `userId`. El catálogo de CORE lo incluye; si quieren sacarlo, acuérdenlo con CORE. `userType` no nos hace falta.
- **28. ¿Necesitan la sede?** Nos sirve `siteId` como campo opcional. Si viene lo usamos para el filtro de sede, pero no es obligatorio: el mínimo del TPO es "productos más vendidos", sin sede.
- **29. ¿Necesitan eventos de stock?** No.
- **30. ¿Sólo eventos o también endpoints?** Sólo eventos, por nuestra cola. No necesitamos API de Tienda. Si en algún momento agregan devoluciones, nos interesaría un evento de reintegro.

### A Backoffice (Grupo 8)

- **¿Tienen granularidad del gasto salarial?** No la necesitamos por persona. Tomamos el total de `PAYROLL` de `GET /internal/v1/wallets/aggregates?groupBy=concept&from=&to=`, como fija CORE. No esperamos ningún evento de sueldos de ustedes.
- **¿Consumen eventos, pulls o ambos?** Ambos:
  - eventos: `backoffice.user.upserted.v1`, `backoffice.user.disabled.v1` y `backoffice.location.upserted.v1`, por el binding `#`;
  - REST, directo a su backend con nuestro token de servicio: `GET /api/v1/sites` (carga inicial y cache, porque las sedes no tienen evento) y `GET /api/v1/users/{userId}` para nombre y apellido. No copiamos datos de personas: los pedimos cuando hacen falta.
- **¿"Gastos administrativos incluyendo salarios" son sólo los de Backoffice?** No: son todos los sueldos que liquida Backoffice (docentes y no docentes). Otros gastos administrativos no los produce ningún módulo, así que por ahora mostramos sólo sueldos.

---

## Preguntas nuestras

### A CORE (Grupo 10)

> Ya resuelto por CORE: tenemos `clientId = analytics-service` con su secret, que va en
> `backend/.env` y nunca al repo. Las consultas a Backoffice y a Gestión Académica van directo
> al backend de cada módulo, con nuestro token de servicio, que ellos validan con el JWKS.

1. **Cola.** ¿Abrimos nosotros el PR a `contracts/topology.yaml` con `analytics.all-events.v1` (binding `#`, DLX `uadenet.dlx.v1`, `maxRetries` 3)?
   - *Supuesto:* sí, lo abrimos nosotros con esos valores.
2. **`teacherId` y `termId` en `teacher.exam-result.published.v1`.** ¿Los pueden sumar como campos opcionales? La regla de compatibilidad de v1 lo permite. Sin `teacherId` no podemos calcular la tasa de aprobación por docente, que es un mínimo del TPO.
   - *Supuesto:* llegan como opcionales. Si faltan, el resultado no cuenta para el ranking por docente, y el cuatrimestre se infiere por `publishedAt`.
3. **`aggregates` por mes.** ¿Alcanza con llamar una vez por mes con `from`/`to`, o hay un `groupBy` por período?
   - *Supuesto:* una llamada por mes.
4. **`aud` del access token.** ¿Qué valor validamos?
   - *Supuesto:* un único `aud` para todo UADEnet (en el mock, `uadenet`) e `iss` del CORE.

### A Portal del Docente (Grupo 2)

1. **Eventos del catálogo.** El catálogo de CORE dice que ustedes publican `teacher.exam-result.published.v1` y `teacher.attendance.recorded.v1`, y que Analítica los consume. En su planilla figuran otros nombres (`nota.publicada`, `acta.cerrada`, `asistencia.registrada`) y sólo para el Portal del Estudiante. ¿Van a publicar los del catálogo?
   - *Supuesto:* sí, con el `data` del catálogo.
2. **Criterio de aprobación.** ¿Qué valores puede tomar `result` y qué examen define que la materia está aprobada (final, cursada, promoción)?
   - *Supuesto:* `result = "APPROVED"` en el examen que cierra la materia cuenta como aprobado.
3. **Docente del curso.** ¿Pueden incluir `teacherId` (UUID de Backoffice) en `teacher.exam-result.published.v1`? Ver la pregunta 3 a CORE.
   - *Supuesto:* viene como campo opcional.
4. **Sede del curso.** ¿El curso tiene sede? Hoy `POST /gateway/academic/courses` no la lleva.
   - *Supuesto:* no tiene; el tablero académico se muestra global.

### A Gestión Académica y Planificación (Grupo 9)

1. **Cuatrimestres.** ¿Van a publicar `academic.term-defined.v1` (`termId`, `startDate`, `endDate`), como pide el catálogo de CORE?
   - *Supuesto:* sí.
   - *Etiqueta:* `2026-1C` la derivamos de `startDate`; si prefieren mandarla ustedes, sumen un campo opcional.
2. **Materias en curso.** ¿Cómo sabemos qué cursos o comisiones hay en el cuatrimestre vigente y de qué asignatura son? Lo necesitamos para "cantidad de materias en curso", que es un mínimo del TPO.
   - *Supuesto:* un `GET` de cursos del período con `courseId`, `subjectId`, `teacherId`, `siteId` y `termId`. Si lo expone Portal Docente, se lo pedimos a ellos.
3. **IDs y rutas.** Su planilla usa IDs numéricos y rutas `/api/academica/...`. CORE pide UUID y rutas bajo el gateway `/api/v1/academic/*`. ¿Van a migrar? ¿El `subjectId` que manda Portal Docente es el id de su asignatura?
   - *Supuesto:* sí a las dos.
4. **Catálogo de asignaturas y carreras.** Para mostrar código y nombre de materia y la facultad, ¿qué endpoints usamos?
   - *Supuesto:* el `GET` de asignaturas por plan y el de carreras (campo `facultad`).

### A Eventos Académicos (Grupo 6)

1. **Migración al catálogo.** ¿Van a publicar `events.event.created.v1`, `events.registration.completed.v1` y `events.attendance.recorded.v1` con el `data` de CORE? En su planilla figuran `evento.creado`, `inscripcion.registrada` y `asistencia.confirmada`, en castellano, sin versión y con otros campos.
   - *Supuesto:* sí, con el sobre y el `data` de CORE.
2. **Sede.** El catálogo no trae `siteId` en `events.event.created.v1`.
   - *Supuesto:* la resolvemos nosotros por `locationId` con `backoffice.location.upserted.v1`; no hace falta que la manden.
3. **Categoría del evento.** ¿Pueden sumar `category` (charla, taller…) como campo opcional? Es para presentismo por tipo de evento.
   - *Supuesto:* no viene, y ese corte queda vacío.
4. **Monto de la inscripción.**
   - *Supuesto:* `amount = "0.00"` en `events.registration.completed.v1` para las inscripciones gratuitas.

### A Sistema de Comedor (Grupo 4)

1. **Compras de comida.** El TPO pide pagar compras con saldo, pero CORE v1 sólo tiene `DINING_RESERVATION`. ¿Van a pedir un `concept` y un evento de compra?
   - *Supuesto:* no hay compras. La facturación del comedor son las reservas cobradas menos las restituidas por asistencia y menos las canceladas.
2. **Cancelación.** ¿Cancelar una reserva genera una reversa en el wallet?
   - *Supuesto:* sí. La tomamos de `core.wallet.transaction-reversed.v1` y la cruzamos por `reservationId`.

### A Backoffice Administrativo (Grupo 8)

1. **Permisos de Analítica.** ¿Pueden dar de alta `analytics:academic:read` (tablero académico y estadísticas de eventos) y `analytics:finance:read` (tablero financiero), y asignarlos al personal de Dirección Académica y Dirección Financiera?
   - *Supuesto:* sí, a personas con rol `ADMIN_STAFF`.
2. **Campus Online.** ¿Existe como sede en su catálogo?
   - *Supuesto:* sí, con código `ONLINE` y sin comedor.
