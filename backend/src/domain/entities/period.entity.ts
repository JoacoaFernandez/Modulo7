// Domain entities: core business objects, independent of frameworks and infrastructure.

// El tablero académico se filtra por cuatrimestre; el financiero y el de eventos, por mes.
export type PeriodKind = "quarter" | "month";

export interface Period {
  // Identificador tal como viaja en la query: termId (UUID de Gestión Académica) o AAAA-MM.
  id: string;
  // Etiqueta para mostrar: "2026-1C" o "Ago 2026".
  label: string;
  kind: PeriodKind;
  // Posición en la serie histórica; 0 es el período más antiguo.
  index: number;
}

// Etiqueta AAAA-NC de un cuatrimestre a partir de su fecha de inicio: los que arrancan en el
// primer semestre son 1C y el resto 2C. Gestión Académica no publica la etiqueta.
export function termLabel(startDate: string): string {
  const [year, month] = startDate.split("-").map(Number);
  return `${year}-${month <= 6 ? 1 : 2}C`;
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// "2026-08" → "Ago 2026".
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}
