// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// KPI card del prototipo: label, valor + unidad, chip de delta + "vs. {período anterior}".
// Reemplaza la versión anterior (shadcn Card + TrendTone de Tailwind) por los colores y
// tamaños exactos del diseño, contra el `Delta` real que ya sirve el backend.
import type { DeltaTone } from "@/domain/entities/analytics.entity";
import { TrendPill } from "./trend-pill.component";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  delta: { formatted: string; tone: DeltaTone };
  // "vs. 2025-2C" / "vs. Jul 2026".
  comparisonLabel: string;
  // El tablero académico usa valores más grandes (30px) que el financiero y eventos (26px).
  size?: "default" | "compact";
}

export function StatCard({ label, value, unit, delta, comparisonLabel, size = "default" }: StatCardProps) {
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

      <div className="flex items-center gap-[7px]">
        <TrendPill label={delta.formatted} tone={delta.tone} />
        <span className="text-[11.5px] whitespace-nowrap text-[#6E7A90]">{comparisonLabel}</span>
      </div>
    </div>
  );
}
