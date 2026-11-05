// Domain entities: core business objects, independent of frameworks and infrastructure.

// Tipos de dato que puede llevar un campo de `data`. `date` es AAAA-MM-DD (sin hora); `datetime` es ISO 8601 UTC
// con `Z`; `money` es un string decimal (`^\d+\.\d{2}$`, nunca número); `uuid` y `integer` se validan por formato.
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "object"
  | "array"
  | "uuid"
  | "datetime"
  | "money"
  | "integer";

export interface FieldSpec {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  // Valores admitidos cuando el campo es un enum de strings.
  oneOf?: readonly string[];
  // Rango admitido (inclusive) cuando el campo es `number` o `integer`.
  min?: number;
  max?: number;
  // Campos de cada elemento (type "array") o del objeto (type "object").
  fields?: readonly FieldSpec[];
  // Valor de ejemplo para armar los requests de Postman y la documentación.
  example?: unknown;
}
