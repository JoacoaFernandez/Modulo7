// Domain entities: core business objects, independent of frameworks and infrastructure.
import { Delta } from "./delta.value-object";

// Tarjeta de indicador: el valor crudo como string decimal (montos en ARS, tasas en %,
// conteos enteros) y el formateado para mostrar.
export interface KpiCard {
  id: string;
  label: string;
  value: string;
  formattedValue: string;
  // Unidad al lado del valor: "materias", "comisiones", "ARS" o vacío.
  unit: string;
  delta: Delta;
}
