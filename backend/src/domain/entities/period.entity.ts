// Domain entities: core business objects, independent of frameworks and infrastructure.

// El tablero académico se filtra por cuatrimestre; el financiero y el de eventos, por mes.
export type PeriodKind = "quarter" | "month";

export interface Period {
  // Identificador tal como viaja en la query: termId (id del período de Gestión Académica) o AAAA-MM.
  id: string;
  // Etiqueta para mostrar: "2026-1C" o "Ago 2026".
  label: string;
  kind: PeriodKind;
  // Posición en la serie histórica; 0 es el período más antiguo.
  index: number;
}

// Etiqueta AAAA-NC de un cuatrimestre a partir del año y el número (1 o 2) del período de
// Gestión Académica: 2026 y 2 → "2026-2C".
export function termLabel(year: number, number: number): string {
  return `${year}-${number}C`;
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// "2026-08" → "Ago 2026".
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}
