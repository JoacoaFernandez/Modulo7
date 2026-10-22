// Catálogo de los eventos que consume Analítica, con el `data` del catálogo de CORE v1 (§11).
// Es la fuente de verdad del consumer: el validador lo aplica y la tabla de EVENTOS.md se
// genera de acá (npm run docs:payloads). Un eventType que no está acá se confirma y se descarta.
import { EventSchema, FieldSpec } from "./event-schema.entity";

const field =
  (type: FieldSpec["type"]) =>
  (name: string, description: string, required = true): FieldSpec => ({ name, type, required, description });

const str = field("string");
const num = field("number");
const bool = field("boolean");
const date = field("date");
const datetime = field("datetime");
const decimal = field("decimal");
const strList = (name: string, description: string): FieldSpec => ({
  name,
  type: "array",
  required: true,
  description,
});

const userId = str("userId", "UUID de la persona (lo genera Backoffice).");
const amount = decimal("amount", "Monto en ARS, string con dos decimales.");
const currency = str("currency", "Moneda: ARS.");
const reservationId = str("reservationId", "UUID de la reserva.");

const WALLET_CONCEPTS = [
  "TOP_UP",
  "PAYROLL",
  "SCHOLARSHIP",
  "ADJUSTMENT",
  "LIBRARY_FINE",
  "DINING_RESERVATION",
  "STORE_PURCHASE",
  "EVENT_REGISTRATION",
  "REFUND",
];
const concept: FieldSpec = { ...str("concept", "Por qué se movió la plata."), oneOf: WALLET_CONCEPTS };
const transactionType: FieldSpec = { ...str("type", "Tipo de movimiento."), oneOf: ["CREDIT", "DEBIT", "REVERSAL"] };

export const EVENT_SCHEMAS: readonly EventSchema[] = [
  // --- Backoffice (8) ---
  {
    eventType: "backoffice.user.upserted.v1",
    source: "backoffice",
    usage: "Aviso de alta o cambio de una persona: invalida el cache de nombres. No se copian datos; el nombre se consulta a Backoffice.",
    fields: [
      userId,
      str("email", "Mail institucional. No se persiste."),
      { ...str("status", "Estado de la identidad."), oneOf: ["PENDING_ACTIVATION", "ACTIVE", "SUSPENDED", "DISABLED"] },
      strList("roles", "Roles: STUDENT, TEACHER, ADMIN_IT, ADMIN_STAFF."),
      { ...strList("permissions", "Permisos {modulo}:{recurso}:{acción}."), required: false },
    ],
  },
  {
    eventType: "backoffice.user.disabled.v1",
    source: "backoffice",
    usage: "Marca al docente como inactivo; sigue en el histórico.",
    fields: [userId, str("reason", "Motivo de la baja.")],
  },
  {
    eventType: "backoffice.location.upserted.v1",
    source: "backoffice",
    usage: "Sede de cada locación: los eventos académicos traen locationId, no siteId.",
    fields: [
      str("locationId", "UUID del espacio."),
      str("siteId", "UUID de la sede."),
      str("name", "Nombre del espacio."),
      num("capacity", "Capacidad física."),
      { ...str("status", "Estado del espacio."), oneOf: ["ACTIVE", "INACTIVE", "MAINTENANCE"] },
    ],
  },

  // --- Portal del Docente (2) ---
  {
    eventType: "teacher.exam-result.published.v1",
    source: "teacher",
    usage: "Tasa de aprobación por materia, por cuatrimestre y por docente.",
    fields: [
      str("studentId", "UUID del estudiante."),
      str("courseId", "UUID del curso."),
      str("subjectId", "UUID de la asignatura (catálogo de Gestión Académica)."),
      str("examId", "UUID del examen."),
      num("grade", "Nota."),
      str("result", "Resultado del examen (valores a confirmar con Portal Docente)."),
      datetime("publishedAt", "Cuándo se publicó la nota."),
      str("teacherId", "UUID del docente. Propuesto, opcional: sin él no hay tasa por docente.", false),
      str("termId", "UUID del cuatrimestre. Propuesto, opcional: sin él se infiere por fecha.", false),
    ],
  },
  {
    eventType: "teacher.attendance.recorded.v1",
    source: "teacher",
    usage: "Cursos con actividad en el cuatrimestre vigente (materias en curso).",
    fields: [
      str("studentId", "UUID del estudiante."),
      str("courseId", "UUID del curso."),
      date("classDate", "Fecha de la clase."),
      bool("present", "Si estuvo presente."),
    ],
  },

  // --- Gestión Académica (9) ---
  {
    eventType: "academic.term-defined.v1",
    source: "academic",
    usage: "Cuatrimestre vigente y anteriores (filtro del tablero académico).",
    fields: [str("termId", "UUID del cuatrimestre."), date("startDate", "Primer día."), date("endDate", "Último día.")],
  },

  // --- Biblioteca (3) ---
  {
    eventType: "library.penalty.applied.v1",
    source: "library",
    usage: "Multas aplicadas por mes.",
    fields: [userId, str("loanId", "UUID del préstamo."), num("daysLate", "Días de atraso."), amount, currency],
  },

  // --- Comedor (4) ---
  {
    eventType: "dining.reservation.created.v1",
    source: "dining",
    usage: "Facturación de comedores por sede, tickets y ticket promedio.",
    fields: [reservationId, userId, str("siteId", "UUID de la sede."), datetime("slotAt", "Turno reservado."), amount, currency],
  },
  {
    eventType: "dining.reservation.cancelled.v1",
    source: "dining",
    usage: "Descuenta la reserva de la facturación (sede y monto por reservationId).",
    fields: [reservationId, userId, datetime("slotAt", "Turno reservado."), datetime("cancelledAt", "Cuándo se canceló.")],
  },
  {
    eventType: "dining.attendance.recorded.v1",
    source: "dining",
    usage: "Asistencia a la reserva; la restitución sale de core.wallet.transaction-reversed.v1.",
    fields: [reservationId, userId, datetime("attendedAt", "Cuándo se presentó.")],
  },

  // --- Tienda (5) ---
  {
    eventType: "store.purchase.completed.v1",
    source: "store",
    usage: "Productos más vendidos (unidades y facturación por producto).",
    fields: [
      str("purchaseId", "UUID de la compra."),
      { ...userId, description: "UUID de quien compró. No se persiste." },
      decimal("total", "Total en ARS."),
      currency,
      {
        name: "items",
        type: "array",
        required: true,
        description: "Ítems de la compra (campos a confirmar con Tienda).",
        fields: [
          str("productId", "UUID del producto."),
          str("productName", "Nombre al momento de la compra."),
          str("category", "Categoría.", false),
          num("quantity", "Unidades."),
          decimal("unitPrice", "Precio unitario en ARS.", false),
          decimal("subtotal", "Subtotal en ARS."),
        ],
      },
      str("siteId", "UUID de la sede. Opcional.", false),
    ],
  },

  // --- Eventos Académicos (6) ---
  {
    eventType: "events.event.created.v1",
    source: "events",
    usage: "Frecuencia por mes y ocupación de cupo; sede por locationId.",
    fields: [
      str("eventId", "UUID del evento."),
      str("title", "Título."),
      str("locationId", "UUID de la locación (Backoffice)."),
      datetime("startAt", "Inicio."),
      datetime("endAt", "Fin."),
      num("capacity", "Cupo máximo."),
      decimal("price", "Precio de inscripción en ARS; null si es gratuito.", false),
      currency,
    ],
  },
  {
    eventType: "events.registration.completed.v1",
    source: "events",
    usage: "Inscriptos por evento e ingresos por inscripción paga.",
    fields: [str("eventId", "UUID del evento."), str("registrationId", "UUID de la inscripción."), userId, amount, currency],
  },
  {
    eventType: "events.attendance.recorded.v1",
    source: "events",
    usage: "Concurrencia y tasa de presentismo.",
    fields: [str("eventId", "UUID del evento."), userId, bool("present", "Si asistió."), datetime("checkedAt", "Cuándo se registró.")],
  },

  // --- CORE (10) ---
  {
    eventType: "core.wallet.transaction-posted.v1",
    source: "core",
    usage: "Movimientos del mes por concepto (los totales salen de wallets/aggregates).",
    fields: [
      str("transactionId", "UUID de la transacción."),
      userId,
      transactionType,
      concept,
      amount,
      currency,
      str("sourceModule", "Módulo que originó el movimiento."),
      str("externalReference", "Referencia estable del módulo originante."),
      str("status", "Estado: POSTED."),
    ],
  },
  {
    eventType: "core.wallet.transaction-rejected.v1",
    source: "core",
    usage: "Cobros rechazados por concepto (informativo).",
    fields: [
      userId,
      transactionType,
      concept,
      amount,
      currency,
      str("sourceModule", "Módulo que originó el movimiento."),
      str("externalReference", "Referencia estable del módulo originante."),
      str("reasonCode", "Motivo, por ejemplo WALLET_INSUFFICIENT_FUNDS."),
    ],
  },
  {
    eventType: "core.wallet.transaction-reversed.v1",
    source: "core",
    usage: "Reintegros: comedor asistido y reversas de Tienda y Eventos.",
    fields: [
      str("transactionId", "UUID de la reversa."),
      str("originalTransactionId", "UUID de la transacción revertida."),
      userId,
      concept,
      amount,
      currency,
    ],
  },
];

export function findEventSchema(eventType: string): EventSchema | undefined {
  return EVENT_SCHEMAS.find((schema) => schema.eventType === eventType);
}
