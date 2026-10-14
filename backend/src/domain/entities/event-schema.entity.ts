// Domain entities: core business objects, independent of frameworks and infrastructure.
import { SourceModule } from "./event-source.entity";

// Tipos de dato que puede llevar un campo del payload. `date` es AAAA-MM-DD (sin hora).
export type FieldType = "string" | "number" | "boolean" | "date" | "object" | "array";

export interface FieldSpec {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  // Valores admitidos cuando el campo es un enum de strings.
  oneOf?: readonly string[];
  // Campos de cada elemento (type "array") o del objeto (type "object").
  fields?: readonly FieldSpec[];
}

export interface EventSchema {
  sourceModule: SourceModule;
  eventType: string;
  fields: readonly FieldSpec[];
}
