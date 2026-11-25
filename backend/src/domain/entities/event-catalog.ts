// Catálogo de eventos que consume Analítica (docs/INTEGRACION.md, sección 3). Es la fuente de verdad del contrato:
// el validador de ingesta lo aplica y EVENTOS.md y la colección de Postman se generan de acá (npm run docs).
import { createHash } from "node:crypto";
import { FieldSpec } from "./event-schema.entity";
import { CoreSource } from "./event-source.entity";

// persist: se guarda en la bandeja; side-effect: se procesa y no se guarda; ignore: ack y descarte.
export type EventHandling = "persist" | "side-effect" | "ignore";
// core: figura en el catálogo de CORE v1; declared: lo declara el equipo emisor; proposed: lo propusimos nosotros.
export type EventOrigin = "core" | "declared" | "proposed";

export interface EventCatalogEntry {
  // Con sufijo .v1
  eventType: string;
  source: CoreSource;
  origin: EventOrigin;
  declaredBy?: string;
  handling: EventHandling;
  // Campos de `data` que no se guardan.
  redact?: readonly string[];
  // Saneamiento previo al guardado, después de `redact`: devuelve `data` sin datos personales que no son un campo propio.
  sanitize?: (data: Record<string, unknown>) => Record<string, unknown>;
  // Texto para EVENTOS.md.
  feeds: string;
  // `data`; los campos que CORE lista y no usamos van como opcionales.
  fields: readonly FieldSpec[];
}

const uuid = (name: string, description: string, required = true, example?: string): FieldSpec => ({
  name, type: "uuid", required, description, example: example ?? "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90",
});
const str = (name: string, description: string, required = true, example?: string): FieldSpec => ({
  name, type: "string", required, description, example,
});
const oneOf = (name: string, description: string, values: readonly string[], required = true): FieldSpec => ({
  name, type: "string", required, description, oneOf: values, example: values[0],
});
const datetime = (name: string, description: string, required = true, example = "2026-10-15T18:00:00.000Z"): FieldSpec => ({
  name, type: "datetime", required, description, example,
});
const money = (name: string, description: string, required = true, example = "1500.00"): FieldSpec => ({
  name, type: "money", required, description, example,
});
const int = (name: string, description: string, required = true, example = 10): FieldSpec => ({
  name, type: "integer", required, description, example,
});
const currency = str("currency", "Moneda (ISO 4217).", false, "ARS");
const userIdRedacted = uuid("userId", "Id del usuario. No se guarda (redact).", false);

// Reemplaza cada segmento /user/<uuid> de un texto por /user/* (p. ej. el externalReference de sueldos
// payroll/2026-11/user/<uuid>/teacher), conservando el resto.
const MASK_USER_SEGMENT = /\/user\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const maskUserInExternalReference = (data: Record<string, unknown>): Record<string, unknown> =>
  typeof data.externalReference === "string"
    ? { ...data, externalReference: data.externalReference.replace(MASK_USER_SEGMENT, "/user/*") }
    : data;

// Reemplaza `studentId` por `studentRef` (SHA-256 truncado del id): no se guarda el id del alumno, pero la bandeja puede
// seguir quedándose con el último resultado de cada (alumno, curso).
export const hashStudentId = (studentId: string): string =>
  createHash("sha256").update(`uadenet-analytics:student:${studentId.toLowerCase()}`).digest("hex").slice(0, 32);
function pseudonymizeStudent(data: Record<string, unknown>): Record<string, unknown> {
  const { studentId, ...rest } = data;
  return typeof studentId === "string" ? { ...rest, studentRef: hashStudentId(studentId) } : data;
}

const entry = (e: EventCatalogEntry): EventCatalogEntry => e;

export const EVENT_CATALOG: readonly EventCatalogEntry[] = [
  // --- Eventos que se persisten (sección 3.2) ---
  entry({
    eventType: "academic.course-result.published.v1",
    source: "academic",
    origin: "proposed",
    declaredBy: "G9",
    handling: "persist",
    // studentId no se guarda: se reemplaza por un hash (studentRef) que alcanza para quedarse con el último resultado
    // por (alumno, curso) sin conservar el id de CORE (ver pseudonymizeStudent).
    sanitize: pseudonymizeStudent,
    feeds: "Tasa de aprobación (KPI, por materia, por facultad, por docente)",
    fields: [
      uuid("studentId", "Id del alumno (userId de CORE). Se guarda sólo su hash (`studentRef`), no el id."),
      str("courseId", "Id del curso (texto).", true, "42"),
      str("subjectId", "Id de la asignatura (texto).", true, "15"),
      str("periodId", "Id del período (texto).", true, "8"),
      str("subjectCode", "Código de la asignatura (agrupa la materia entre planes).", false, "ISI-101"),
      str("subjectName", "Nombre de la asignatura.", false, "Análisis Matemático I"),
      str("careerId", "Id de la carrera (G9).", false, "1"),
      str("planId", "Id del plan de estudios (G9).", false, "11"),
      uuid("siteId", "Id de la sede en Backoffice (backofficeSiteId). Puede ser null: el resultado sólo cuenta en «Todas las sedes».", false),
      {
        name: "teachers", type: "array", required: false, allowEmpty: true,
        description: "Docentes del curso; todos los roles cuentan para la tasa por docente.",
        example: [{ teacherId: "5f0a8e21-4c7b-4d19-9a3e-61b2c8d7f034", role: "TITULAR" }],
        fields: [
          str("teacherId", "Id del docente (userId de CORE / Backoffice).", true, "5f0a8e21-4c7b-4d19-9a3e-61b2c8d7f034"),
          oneOf("role", "Rol en el curso.", ["TITULAR", "ADJUNTO", "AUXILIAR"]),
        ],
      },
      oneOf("status", "Estado final de la cursada. Cuentan APROBADO, DESAPROBADO y LIBRE; REGULAR y BAJA no.", ["APROBADO", "DESAPROBADO", "REGULAR", "LIBRE", "BAJA"]),
      { name: "finalGrade", type: "number", required: false, description: "Nota final (0 a 10); null en REGULAR, LIBRE y BAJA.", min: 0, max: 10, example: 8 },
      { name: "resultDate", type: "date", required: false, description: "Fecha del resultado (AAAA-MM-DD).", example: "2026-09-30" },
    ],
  }),
  entry({
    eventType: "events.event.created.v1",
    source: "events",
    origin: "core",
    declaredBy: "G6",
    handling: "persist",
    feeds: "Frecuencia, ocupación de cupo y tipo de evento",
    fields: [
      uuid("eventId", "Id del evento."),
      str("title", "Título.", false, "Jornada de bienvenida"),
      uuid("locationId", "Id de la locación en Backoffice."),
      datetime("startAt", "Inicio.", false, "2026-10-15T17:00:00.000Z"),
      datetime("endAt", "Fin.", true, "2026-10-15T19:00:00.000Z"),
      int("capacity", "Cupo.", true, 100),
      money("price", "Precio (puede ser null).", false, "0.00"),
      currency,
      str("category", "Tipo de evento (propuesto, opcional).", false, "Charla"),
    ],
  }),
  entry({
    eventType: "events.registration.completed.v1",
    source: "events",
    origin: "core",
    declaredBy: "G6",
    handling: "persist",
    feeds: "Inscriptos y presentismo",
    fields: [
      uuid("eventId", "Id del evento."),
      uuid("registrationId", "Id de la inscripción."),
      uuid("userId", "Id del usuario inscripto."),
      money("amount", "Importe cobrado.", false, "0.00"),
      currency,
    ],
  }),
  entry({
    eventType: "events.attendance.recorded.v1",
    source: "events",
    origin: "core",
    declaredBy: "G6",
    handling: "persist",
    feeds: "Concurrencia y presentismo",
    fields: [
      uuid("eventId", "Id del evento."),
      uuid("userId", "Id del usuario."),
      { name: "present", type: "boolean", required: true, description: "Si estuvo presente.", example: true },
      datetime("checkedAt", "Momento del registro.", false),
    ],
  }),
  entry({
    eventType: "backoffice.location.upserted.v1",
    source: "backoffice",
    origin: "core",
    declaredBy: "G8",
    handling: "persist",
    feeds: "Resolver la sede de un evento (locationId a siteId)",
    fields: [
      uuid("locationId", "Id de la locación.", true, "7a41c2d8-0b6e-4f53-8d19-5e2a9c0f1b37"),
      uuid("siteId", "Id de la sede."),
      str("name", "Nombre de la locación.", false, "Aula Magna"),
      int("capacity", "Capacidad.", false, 120),
      oneOf("status", "Estado.", ["ACTIVE", "INACTIVE", "MAINTENANCE"], false),
      str("type", "Tipo de locación (pedido de G8, opcional).", false, "AULA"),
    ],
  }),
  entry({
    eventType: "dining.reservation.created.v1",
    source: "dining",
    origin: "core",
    declaredBy: "G4",
    handling: "persist",
    redact: ["userId"],
    feeds: "Facturación y tickets por sede",
    fields: [
      uuid("reservationId", "Id de la reserva."),
      userIdRedacted,
      uuid("siteId", "Id de la sede."),
      datetime("slotAt", "Turno reservado.", false),
      money("amount", "Importe.", true, "2500.00"),
      currency,
    ],
  }),
  entry({
    eventType: "dining.reservation.cancelled.v1",
    source: "dining",
    origin: "core",
    declaredBy: "G4",
    handling: "persist",
    redact: ["userId"],
    feeds: "Descuenta la reserva cancelada",
    fields: [
      uuid("reservationId", "Id de la reserva."),
      userIdRedacted,
      datetime("slotAt", "Turno reservado.", false),
      datetime("cancelledAt", "Momento de la cancelación.", false),
      str("reason", 'Motivo (opcional). "NO_SHOW" es una ausencia, sin reintegro: la reserva se sigue facturando.', false, "NO_SHOW"),
    ],
  }),
  entry({
    eventType: "dining.attendance.recorded.v1",
    source: "dining",
    origin: "core",
    declaredBy: "G4",
    handling: "persist",
    redact: ["userId"],
    feeds: "Sólo con DINING_REVENUE_NET_OF_ATTENDANCE=true",
    fields: [
      uuid("reservationId", "Id de la reserva."),
      userIdRedacted,
      datetime("attendedAt", "Momento de la asistencia.", false),
      uuid("siteId", "Id de la sede (opcional).", false),
      money("refundAmount", "Importe reintegrado por la asistencia (opcional).", false, "2500.00"),
      currency,
    ],
  }),
  entry({
    eventType: "dining.purchase.completed.v1",
    source: "dining",
    origin: "declared",
    declaredBy: "G4",
    handling: "persist",
    redact: ["userId"],
    feeds: "Facturación y tickets de comedores por sede (compras del comedor, concepto DINING_PURCHASE)",
    fields: [
      uuid("purchaseId", "Id de la compra."),
      userIdRedacted,
      uuid("siteId", "Id de la sede."),
      money("total", "Total de la compra.", true, "3500.00"),
      str("currency", "Moneda (ISO 4217).", true, "ARS"),
      {
        name: "items",
        type: "array",
        required: false,
        allowEmpty: true,
        description: "Ítems de la compra (sin forma definida: se acepta cualquier lista de objetos).",
        example: [{ name: "Menú del día", quantity: 1 }],
      },
    ],
  }),
  entry({
    eventType: "store.purchase.completed.v1",
    source: "store",
    origin: "core",
    declaredBy: "G5",
    handling: "persist",
    redact: ["userId"],
    feeds: "Productos más vendidos (unidades y facturación)",
    fields: [
      uuid("purchaseId", "Id de la compra."),
      userIdRedacted,
      money("total", "Total de la compra.", false, "5000.00"),
      currency,
      uuid("siteId", "Id de la sede (opcional).", false),
      {
        name: "items",
        type: "array",
        required: true,
        description: "Ítems de la compra (propuesto: no está en CORE v1).",
        example: [
          { productId: "c2a91d34-77ab-4e0f-8a55-1f3b9d6e2c10", productName: "Cuaderno A4", category: "Papelería", quantity: 2, unitPrice: "2500.00", subtotal: "5000.00" },
        ],
        fields: [
          uuid("productId", "Id del producto."),
          str("productName", "Nombre del producto al momento de la compra.", true, "Cuaderno A4"),
          str("category", "Categoría.", false, "Papelería"),
          int("quantity", "Unidades.", true, 2),
          money("unitPrice", "Precio unitario.", false, "2500.00"),
          money("subtotal", "Importe de la línea.", true, "5000.00"),
        ],
      },
    ],
  }),

  // --- Efecto lateral: se procesan y no se guardan (sección 3.3) ---
  ...["upserted", "disabled"].map((action) =>
    entry({
      eventType: `backoffice.user.${action}.v1`,
      source: "backoffice",
      origin: "core",
      declaredBy: "G8",
      handling: "side-effect",
      feeds: "Invalida el nombre cacheado del usuario (no se guarda: lleva mail y permisos)",
      fields: [uuid("userId", "Id del usuario.")],
    }),
  ),

  // --- Wallet de CORE: se guardan sin userId y con el externalReference saneado (reserva para separar sueldos) ---
  entry({
    eventType: "core.wallet.transaction-posted.v1",
    source: "core",
    origin: "core",
    declaredBy: "CORE",
    handling: "persist",
    redact: ["userId"],
    sanitize: maskUserInExternalReference,
    feeds: "Reserva para separar sueldos docentes y administrativos (hoy ningún tablero; los totales salen de aggregates)",
    fields: [
      uuid("transactionId", "Id de la transacción."),
      userIdRedacted,
      str("type", "Tipo (CREDIT o DEBIT).", false, "CREDIT"),
      str("concept", "Concepto (PAYROLL, TOP_UP...).", false, "PAYROLL"),
      money("amount", "Importe.", false, "250000.00"),
      currency,
      str("sourceModule", "Módulo que originó la transacción.", false, "backoffice"),
      str("externalReference", "Referencia externa. Se guarda sin el userId: /user/<uuid> pasa a /user/*.", false, "payroll/2026-11/user/3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90/teacher"),
      str("status", "Estado.", false, "POSTED"),
    ],
  }),
  entry({
    eventType: "core.wallet.transaction-reversed.v1",
    source: "core",
    origin: "core",
    declaredBy: "CORE",
    handling: "persist",
    redact: ["userId"],
    sanitize: maskUserInExternalReference,
    feeds: "Reserva para separar sueldos docentes y administrativos (hoy ningún tablero; los totales salen de aggregates)",
    fields: [
      uuid("transactionId", "Id de la transacción de reverso."),
      uuid("originalTransactionId", "Id de la transacción revertida.", false),
      userIdRedacted,
      str("concept", "Concepto.", false, "REFUND"),
      money("amount", "Importe.", false, "250000.00"),
      currency,
    ],
  }),

  // --- Se descartan con ack (sección 3.3) ---
  ...[
    ["core.wallet.transaction-rejected.v1", "core", "core", "Los totales oficiales salen de aggregates"],
    ["library.penalty.applied.v1", "library", "core", "Ningún tablero lo usa (las multas ya están en aggregates)"],
    ["teacher.exam-result.published.v1", "teacher", "declared", "Es por examen, no resultado final de curso"],
    ["teacher.attendance.recorded.v1", "teacher", "declared", "Es por clase; ningún tablero lo usa"],
    ["academic.term-defined.v1", "academic", "core", "Los cuatrimestres salen de GET periodos"],
    ["academic.exam-scheduled.v1", "academic", "core", "No es de Analítica"],
    ["backoffice.rate.changed.v1", "backoffice", "core", "No es de Analítica"],
    ["events.reminder.requested.v1", "events", "core", "No es de Analítica"],
    ["core.notification.created.v1", "core", "core", "No es de Analítica"],
  ].map(([eventType, source, origin, feeds]) =>
    entry({
      eventType,
      source: source as CoreSource,
      origin: origin as EventOrigin,
      handling: "ignore",
      feeds,
      fields: [],
    }),
  ),
];

export function findCatalogEntry(eventType: string): EventCatalogEntry | undefined {
  return EVENT_CATALOG.find((candidate) => candidate.eventType === eventType);
}
