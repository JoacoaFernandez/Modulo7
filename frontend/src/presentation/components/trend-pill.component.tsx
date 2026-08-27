// Presentation components: primitivas de gráficos, reutilizables entre los 3 tableros.
// El diseño usa dos patrones de color por Delta.tone, ambos con los mismos 3 pares de colores
// (chipOf/sign en Analitica Institucional.dc.html): un chip con fondo (solo en los KPI cards) y
// texto de color plano en todo lo demás (deltas de materia, docente, facultad, saldo, gastos...).
import type { DeltaTone } from "@/domain/entities/analytics.entity";

// bg/fg exactos del prototipo: `chipBg: g===POS?"#E4F1EB":(g===NEG?"#F7E4E7":"#F1F3F6")`.
const toneColors: Record<DeltaTone, { bg: string; fg: string }> = {
  positive: { bg: "#E4F1EB", fg: "#127453" },
  negative: { bg: "#F7E4E7", fg: "#A51C30" },
  neutral: { bg: "#F1F3F6", fg: "#647188" },
};

interface TrendPillProps {
  label: string;
  tone: DeltaTone;
}

// Chip con fondo: solo el delta de los 4 KPI cards de cada tablero.
export function TrendPill({ label, tone }: TrendPillProps) {
  const { bg, fg } = toneColors[tone];
  return (
    <span
      className="inline-flex w-fit items-center whitespace-nowrap rounded text-[11.5px] font-medium"
      style={{ background: bg, color: fg, padding: "4px 6px" }}
    >
      {label}
    </span>
  );
}

interface DeltaLabelProps {
  label: string;
  tone: DeltaTone;
  className?: string;
}

// Texto de color plano, sin fondo: el patrón que usa todo lo demás (leyendas de gráficos,
// filas de bar-list, ejes de barras agrupadas).
export function DeltaLabel({ label, tone, className }: DeltaLabelProps) {
  return (
    <span className={className} style={{ color: toneColors[tone].fg }}>
      {label}
    </span>
  );
}
