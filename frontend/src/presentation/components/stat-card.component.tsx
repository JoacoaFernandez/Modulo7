// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// KPI card del prototipo: label, valor + unidad, y un pie de dos formas posibles —
// chip de delta + "vs. {período anterior}" (académico y financiero) o un badge de texto
// plano sin delta (eventos: sus 4 KPIs no tienen `Delta` en la entidad, el diseño tampoco
// les pone chip — solo un badge con el mes o una aclaración fija).
import type { DeltaTone } from "@/domain/entities/analytics.entity";
import { TrendPill } from "./trend-pill.component";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  // "vs. 2025-2C" / "vs. Jul 2026": exclusivo con `caption`.
  delta?: { formatted: string; tone: DeltaTone };
  comparisonLabel?: string;
  // Badge de texto plano sin color de tono, p. ej. "Ago 2026" o "sobre 8.450 inscriptos".
  caption?: string;
  // El tablero académico usa valores más grandes (30px) que el financiero y eventos (26px).
  size?: "default" | "compact";
}

export function StatCard({ label, value, unit, delta, comparisonLabel, caption, size = "default" }: StatCardProps) {
  const isCompact = size === "compact";

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-[var(--app-border)] bg-white px-[18px] py-4">
      <p className="text-[11px] leading-[1.3] font-medium text-[#5B6980]">{label}</p>

      <div className="flex items-end gap-2">
        <p
          className="leading-none font-semibold tracking-[-0.02em] whitespace-nowrap text-[#16243C]"
          style={{ fontSize: isCompact ? "26px" : "30px" }}
        >
          {value}
        </p>
        {unit && (
          <p className="pb-[3px] leading-[1.4] text-[#6E7A90]" style={{ fontSize: isCompact ? "11px" : "12px" }}>
            {unit}
          </p>
        )}
      </div>

      {delta && comparisonLabel && (
        <div className="flex items-center gap-[7px]">
          <TrendPill label={delta.formatted} tone={delta.tone} />
          <span className="text-[11.5px] whitespace-nowrap text-[#6E7A90]">{comparisonLabel}</span>
        </div>
      )}

      {caption && (
        <span
          className="w-fit self-start rounded text-[11.5px] font-medium whitespace-nowrap"
          style={{ background: "#F1F3F6", color: "#4A5870", padding: "4px 6px" }}
        >
          {caption}
        </span>
      )}
    </div>
  );
}
