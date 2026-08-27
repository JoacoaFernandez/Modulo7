// Domain entities: core business objects, independent of frameworks and infrastructure.

export type DeltaTone = "positive" | "negative" | "neutral";

// Variación de una métrica contra el período anterior, ya formateada para mostrar.
export interface Delta {
  // Diferencia numérica: pp para tasas, % para montos, unidades para conteos.
  value: number;
  // Texto con signo y unidad: "+2.1 pp", "-4.1 pp", "+3".
  formatted: string;
  // Semántica del cambio; la capa de presentación la mapea a color.
  tone: DeltaTone;
}

export interface DeltaOptions {
  // Sufijo de la unidad: " pp", "%" o vacío.
  suffix?: string;
  // Redondea a entero en lugar de un decimal (conteos).
  integer?: boolean;
  // Invierte la semántica: subir es malo (egresos, gastos).
  inverted?: boolean;
}

// Por debajo de este umbral el cambio se considera neutro.
const NEUTRAL_THRESHOLD = 0.05;

export function createDelta(value: number, options: DeltaOptions = {}): Delta {
  const { suffix = "", integer = false, inverted = false } = options;
  const magnitude = integer ? String(Math.round(value)) : value.toFixed(1);

  return {
    value,
    formatted: `${value > 0 ? "+" : ""}${magnitude}${suffix}`,
    tone: resolveTone(value, inverted),
  };
}

function resolveTone(value: number, inverted: boolean): DeltaTone {
  if (value > NEUTRAL_THRESHOLD) return inverted ? "negative" : "positive";
  if (value < -NEUTRAL_THRESHOLD) return inverted ? "positive" : "negative";
  return "neutral";
}
