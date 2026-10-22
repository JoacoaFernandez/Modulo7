// Domain services: reglas de negocio puras. Valida el `data` de un evento contra su esquema.
import { FieldSpec } from "../entities/event-schema.entity";
import { findEventSchema } from "../entities/event-schemas";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_PATTERN = /^-?\d+\.\d{2}$/;

export interface PayloadProblems {
  // Campos obligatorios que no vinieron.
  missing: string[];
  // Campos que vinieron con otro tipo o un valor fuera de lo admitido.
  invalid: string[];
}

// Los campos que el esquema no declara se aceptan y se ignoran: dentro de v1 CORE puede sumar
// campos opcionales sin romper a los consumidores. Si el evento no tiene esquema devuelve
// null: el llamador decide qué hacer (el consumer lo descarta).
export function validateEventPayload(eventType: string, data: Record<string, unknown>): PayloadProblems | null {
  const schema = findEventSchema(eventType);
  if (!schema) return null;

  const problems: PayloadProblems = { missing: [], invalid: [] };
  validateFields(schema.fields, data, "data", problems);
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
    case "datetime":
      return typeof value === "string" && !DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
        ? []
        : [`${path} debe ser una fecha y hora ISO 8601 (UTC).`];
    case "decimal":
      return typeof value === "string" && DECIMAL_PATTERN.test(value)
        ? []
        : [`${path} debe ser un monto como string con dos decimales ("1500.00"), nunca un número.`];
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return [`${path} debe ser un objeto.`];
      validateFields(field.fields ?? [], value as Record<string, unknown>, path, problems);
      return [];
    case "array":
      if (!Array.isArray(value)) return [`${path} debe ser una lista.`];
      // Sin `fields` es una lista de valores simples (roles, permisos).
      if (!field.fields) return [];
      if (value.length === 0) return [`${path} debe tener al menos un elemento.`];
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
