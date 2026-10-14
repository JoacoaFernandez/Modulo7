// Domain services: reglas de negocio puras. Valida un payload contra el esquema de su evento.
import { FieldSpec } from "../entities/event-schema.entity";
import { findEventSchema } from "../entities/event-schemas";
import { SourceModule } from "../entities/event-source.entity";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface PayloadProblems {
  // Campos obligatorios que no vinieron.
  missing: string[];
  // Campos que vinieron con otro tipo o un valor fuera de lo admitido.
  invalid: string[];
}

// Los campos que el esquema no declara se aceptan y se ignoran, así un módulo puede agregar
// datos sin romper la ingesta. Si el evento no tiene esquema devuelve null: el llamador
// decide si lo rechaza.
export function validateEventPayload(
  sourceModule: SourceModule,
  eventType: string,
  payload: Record<string, unknown>,
): PayloadProblems | null {
  const schema = findEventSchema(sourceModule, eventType);
  if (!schema) return null;

  const problems: PayloadProblems = { missing: [], invalid: [] };
  validateFields(schema.fields, payload, "payload", problems);
  return problems;
}

function validateFields(
  fields: readonly FieldSpec[],
  value: Record<string, unknown>,
  path: string,
  problems: PayloadProblems,
): void {
  for (const field of fields) {
    const fieldPath = `${path}.${field.name}`;
    const fieldValue = value[field.name];

    if (fieldValue === undefined || fieldValue === null) {
      if (field.required) problems.missing.push(`${fieldPath} es obligatorio (${describeType(field)}).`);
      continue;
    }

    problems.invalid.push(...validateField(field, fieldValue, fieldPath, problems));
  }
}

// Devuelve los problemas de tipo del campo; los faltantes de objetos anidados van directo a
// `problems.missing`.
function validateField(field: FieldSpec, value: unknown, path: string, problems: PayloadProblems): string[] {
  switch (field.type) {
    case "string":
      if (typeof value !== "string" || value.trim() === "") return [`${path} debe ser un texto no vacío.`];
      if (field.oneOf && !field.oneOf.includes(value)) {
        return [`${path} inválido. Valores admitidos: ${field.oneOf.join(", ")}.`];
      }
      return [];
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? [] : [`${path} debe ser un número.`];
    case "boolean":
      return typeof value === "boolean" ? [] : [`${path} debe ser true o false.`];
    case "date":
      return typeof value === "string" && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
        ? []
        : [`${path} debe ser una fecha AAAA-MM-DD.`];
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return [`${path} debe ser un objeto.`];
      validateFields(field.fields ?? [], value as Record<string, unknown>, path, problems);
      return [];
    case "array":
      if (!Array.isArray(value) || value.length === 0) return [`${path} debe ser una lista con al menos un elemento.`];
      return value.flatMap((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          return [`${path}[${index}] debe ser un objeto.`];
        }
        validateFields(field.fields ?? [], item as Record<string, unknown>, `${path}[${index}]`, problems);
        return [];
      });
  }
}

function describeType(field: FieldSpec): string {
  return field.oneOf ? field.oneOf.join(" | ") : field.type;
}
