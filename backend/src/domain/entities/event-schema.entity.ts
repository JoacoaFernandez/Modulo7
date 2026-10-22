// Domain entities: core business objects, independent of frameworks and infrastructure.
import { SourceModule } from "./event-source.entity";

// Tipos de dato que puede llevar un campo de `data`. `date` es AAAA-MM-DD, `datetime` es
// ISO 8601 y `decimal` es dinero como string con dos decimales ("1500.00").
export type FieldType = "string" | "number" | "boolean" | "date" | "datetime" | "decimal" | "object" | "array";

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
  // eventType del catálogo de CORE: único en todo UADEnet.
  eventType: string;
  // Módulo que lo publica; coincide con el prefijo del eventType.
  source: SourceModule;
  // Qué tablero o métrica alimenta.
  usage: string;
  fields: readonly FieldSpec[];
}
