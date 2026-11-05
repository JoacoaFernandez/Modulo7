// Domain services: reglas de negocio puras. Valida el envelope v1 de CORE y su `data` contra el catálogo.
import { EventCatalogEntry, findCatalogEntry } from "../entities/event-catalog";
import { FieldSpec } from "../entities/event-schema.entity";
import { CORE_SOURCES, isCoreSource } from "../entities/event-source.entity";
import { EventEnvelope } from "../entities/inbox-event.entity";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const MONEY_PATTERN = /^\d+\.\d{2}$/;
const EVENT_TYPE_PATTERN = /^([a-z]+)\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.v\d+$/;

export type EnvelopeValidation =
  // `entry` es undefined si el eventType no está en el catálogo.
  | { envelope: EventEnvelope; entry: EventCatalogEntry | undefined }
  | { problems: string[] };

export function validateEnvelope(raw: unknown): EnvelopeValidation {
  if (!isPlainObject(raw)) return { problems: ["El cuerpo del evento debe ser un objeto JSON."] };

  const problems: string[] = [];

  if (raw.specVersion !== "1.0") problems.push('specVersion es obligatorio y debe ser "1.0".');

  if (!isUuid(raw.eventId)) problems.push("eventId es obligatorio y debe ser un UUID.");

  if (!isCoreSource(raw.source)) {
    problems.push(`source es obligatorio. Valores admitidos: ${CORE_SOURCES.join(", ")}.`);
  }

  const eventType = raw.eventType;
  if (typeof eventType !== "string") {
    problems.push("eventType es obligatorio y debe ser un texto {source}.{entidad}.{acción}.v{n}.");
  } else {
    const match = EVENT_TYPE_PATTERN.exec(eventType);
    if (!match) {
      problems.push(`eventType "${eventType}" inválido: el formato es {source}.{entidad}.{acción}.v{n}.`);
    } else if (isCoreSource(raw.source) && match[1] !== raw.source) {
      problems.push(`eventType "${eventType}" no coincide con source "${raw.source}": el prefijo debe ser el source.`);
    }
  }

  if (typeof raw.occurredAt !== "string" || !isDatetime(raw.occurredAt)) {
    problems.push("occurredAt es obligatorio y debe ser una fecha ISO 8601 UTC con Z (2026-09-30T18:12:03.511Z).");
  }

  if (raw.subject !== undefined && raw.subject !== null && typeof raw.subject !== "string") {
    problems.push("subject debe ser un texto.");
  }
  if (raw.correlationId !== undefined && raw.correlationId !== null && !isUuid(raw.correlationId)) {
    problems.push("correlationId debe ser un UUID.");
  }
  if (raw.causationId !== undefined && raw.causationId !== null && !isUuid(raw.causationId)) {
    problems.push("causationId debe ser un UUID o null.");
  }
  if (raw.actor !== undefined && raw.actor !== null) {
    if (!isPlainObject(raw.actor) || typeof raw.actor.type !== "string" || typeof raw.actor.id !== "string") {
      problems.push("actor debe ser un objeto { type, id } con textos.");
    }
  }

  if (!isPlainObject(raw.data)) problems.push("data es obligatorio y debe ser un objeto.");

  if (problems.length > 0) return { problems };

  const envelope: EventEnvelope = {
    specVersion: "1.0",
    eventId: (raw.eventId as string).toLowerCase(),
    eventType: raw.eventType as string,
    source: raw.source as EventEnvelope["source"],
    occurredAt: raw.occurredAt as string,
    ...(typeof raw.subject === "string" && { subject: raw.subject }),
    ...(typeof raw.correlationId === "string" && { correlationId: raw.correlationId }),
    ...(raw.causationId !== undefined && { causationId: raw.causationId as string | null }),
    ...(isPlainObject(raw.actor) && { actor: { type: raw.actor.type as string, id: raw.actor.id as string } }),
    data: raw.data as Record<string, unknown>,
  };

  const entry = findCatalogEntry(envelope.eventType);
  if (entry && entry.source !== envelope.source) {
    return { problems: [`eventType "${envelope.eventType}" pertenece a source "${entry.source}", no a "${envelope.source}".`] };
  }

  // Los tipos que se ignoran no se validan: no nos importa su contenido. El resto, sí.
  if (entry && entry.handling !== "ignore") {
    const dataProblems: string[] = [];
    validateFields(entry.fields, envelope.data, "data", dataProblems);
    if (dataProblems.length > 0) return { problems: dataProblems };
  }

  return { envelope, entry };
}

// Los campos que el catálogo no declara se aceptan y se ignoran: así un módulo puede agregar datos sin romper la
// ingesta (CORE ya valida al publicar; ser más estrictos mandaría eventos buenos a la DLQ).
function validateFields(
  fields: readonly FieldSpec[],
  value: Record<string, unknown>,
  path: string,
  problems: string[],
): void {
  for (const field of fields) {
    const fieldPath = `${path}.${field.name}`;
    const fieldValue = value[field.name];

    if (fieldValue === undefined || fieldValue === null) {
      if (field.required) problems.push(`${fieldPath} es obligatorio (${describeType(field)}).`);
      continue;
    }

    validateField(field, fieldValue, fieldPath, problems);
  }
}

function validateField(field: FieldSpec, value: unknown, path: string, problems: string[]): void {
  switch (field.type) {
    case "string":
      if (typeof value !== "string" || value.trim() === "") {
        problems.push(`${path} debe ser un texto no vacío.`);
      } else if (field.oneOf && !field.oneOf.includes(value)) {
        problems.push(`${path} inválido. Valores admitidos: ${field.oneOf.join(", ")}.`);
      }
      return;
    case "uuid":
      if (!isUuid(value)) problems.push(`${path} debe ser un UUID.`);
      return;
    case "datetime":
      if (typeof value !== "string" || !isDatetime(value)) {
        problems.push(`${path} debe ser una fecha ISO 8601 UTC con Z.`);
      }
      return;
    case "money":
      if (typeof value !== "string" || !MONEY_PATTERN.test(value)) {
        problems.push(`${path} debe ser un monto como texto con dos decimales ("1500.00"), nunca un número.`);
      }
      return;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) problems.push(`${path} debe ser un entero.`);
      else checkRange(field, value, path, problems);
      return;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) problems.push(`${path} debe ser un número.`);
      else checkRange(field, value, path, problems);
      return;
    case "boolean":
      if (typeof value !== "boolean") problems.push(`${path} debe ser true o false.`);
      return;
    case "date":
      if (typeof value !== "string" || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
        problems.push(`${path} debe ser una fecha AAAA-MM-DD.`);
      }
      return;
    case "object":
      if (!isPlainObject(value)) problems.push(`${path} debe ser un objeto.`);
      else validateFields(field.fields ?? [], value, path, problems);
      return;
    case "array":
      if (!Array.isArray(value) || value.length === 0) {
        problems.push(`${path} debe ser una lista con al menos un elemento.`);
        return;
      }
      value.forEach((item, index) => {
        if (!isPlainObject(item)) problems.push(`${path}[${index}] debe ser un objeto.`);
        else validateFields(field.fields ?? [], item, `${path}[${index}]`, problems);
      });
      return;
  }
}

function checkRange(field: FieldSpec, value: number, path: string, problems: string[]): void {
  if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) {
    problems.push(`${path} debe estar entre ${field.min ?? "-∞"} y ${field.max ?? "∞"}.`);
  }
}

function describeType(field: FieldSpec): string {
  return field.oneOf ? field.oneOf.join(" | ") : field.type;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isDatetime(value: string): boolean {
  return DATETIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
