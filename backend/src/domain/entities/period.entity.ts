// Domain entities: core business objects, independent of frameworks and infrastructure.

// El tablero académico se filtra por cuatrimestre; el financiero y el de eventos, por mes.
export type PeriodKind = "quarter" | "month";

export interface Period {
  // Identificador tal como viaja en la query: "2026-1C" o "Ago 2026".
  id: string;
  label: string;
  kind: PeriodKind;
  // Posición en la serie histórica; 0 es el período más antiguo.
  index: number;
}
