// Domain services: reglas de negocio puras. Valida el sobre estándar de CORE (§9.1) antes de
// mirar el `data`; es el mismo chequeo sin importar por dónde llegue el mensaje.
import { CoreEventEnvelope } from "../entities/core-event.entity";
import { isSourceModule, SOURCE_MODULES } from "../entities/event-source.entity";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_TYPE_PATTERN = /^[a-z]+\.[a-z0-9-]+(\.[a-z0-9-]+)*\.v\d+$/;

export type EnvelopeParseResult = { envelope: CoreEventEnvelope; problems: [] } | { envelope: null; problems: string[] };

export function parseCoreEnvelope(body: unknown): EnvelopeParseResult {
  if (!isPlainObject(body)) return { envelope: null, problems: ["El evento debe ser un objeto JSON."] };

  const problems: string[] = [];
  const text = (name: string) => {
    const value = body[name];
    if (typeof value !== "string" || value.trim() === "") problems.push(`"${name}" es obligatorio y debe ser un texto.`);
    return typeof value === "string" ? value : "";
  };
  const nullableText = (name: string) => (typeof body[name] === "string" ? (body[name] as string) : null);

  const specVersion = text("specVersion");
  const eventId = text("eventId");
  const eventType = text("eventType");
  const source = text("source");
  const occurredAt = text("occurredAt");
  const subject = text("subject");

  if (eventId && !UUID_PATTERN.test(eventId)) problems.push('"eventId" debe ser un UUID.');
  if (eventType && !EVENT_TYPE_PATTERN.test(eventType)) {
    problems.push('"eventType" debe tener la forma {source}.{entidad}.{acción}.v{n}.');
  }
  if (source && !isSourceModule(source)) {
    problems.push(`"source" inválido. Valores admitidos: ${SOURCE_MODULES.join(", ")}.`);
  }
  // La routing key empieza con el source: un módulo no puede publicar eventos de otro.
  if (source && eventType && !eventType.startsWith(`${source}.`)) {
    problems.push(`"source" (${source}) no coincide con el prefijo de "eventType" (${eventType}).`);
  }
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) problems.push('"occurredAt" debe ser una fecha ISO 8601.');
  if (!isPlainObject(body.data)) problems.push('"data" es obligatorio y debe ser un objeto.');

  const actor = isPlainObject(body.actor) && typeof body.actor.type === "string" && typeof body.actor.id === "string"
    ? { type: body.actor.type, id: body.actor.id }
    : null;

  if (problems.length > 0) return { envelope: null, problems };

  return {
    envelope: {
      specVersion,
      eventId,
      eventType,
      source: source as CoreEventEnvelope["source"],
      occurredAt,
      subject,
      correlationId: nullableText("correlationId"),
      causationId: nullableText("causationId"),
      actor,
      data: body.data as Record<string, unknown>,
    },
    problems: [],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
