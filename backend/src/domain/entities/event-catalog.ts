// Catálogo de eventos que consume Analítica (docs/INTEGRACION.md, sección 3). Es la fuente de verdad del contrato:
// el validador de ingesta lo aplica y EVENTOS.md y la colección de Postman se generan de acá (npm run docs).
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

const entry = (e: EventCatalogEntry): EventCatalogEntry => e;

export const EVENT_CATALOG: readonly EventCatalogEntry[] = [
  // --- Eventos que se persisten (sección 3.2) ---
  entry({
    eventType: "academic.course-result.published.v1",
    source: "academic",
    origin: "proposed",
    declaredBy: "G9",
    handling: "persist",
    feeds: "Tasa de aprobación (KPI, por materia, por facultad, por docente)",
    fields: [
      uuid("studentId", "Id del alumno."),
      str("courseId", "Id del curso (texto).", true, "42"),
      str("subjectId", "Id de la asignatura (texto).", true, "15"),
      str("periodId", "Id del período (texto).", true, "8"),
      uuid("siteId", "Id de la sede en Backoffice (backofficeSiteId)."),
      oneOf("status", "Resultado final.", ["APROBADO", "DESAPROBADO"]),
      { name: "finalGrade", type: "number", required: false, description: "Nota final (0 a 10).", min: 0, max: 10, example: 8 },
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

  // --- Se descartan con ack (sección 3.3) ---
  ...[
    ["core.wallet.transaction-posted.v1", "core", "core", "Los totales oficiales salen de aggregates"],
    ["core.wallet.transaction-reversed.v1", "core", "core", "Los totales oficiales salen de aggregates"],
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
