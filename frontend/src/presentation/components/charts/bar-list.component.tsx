// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// Lista de barras de progreso horizontales. Generaliza tres patrones del prototipo:
// - "inline" (docentes, tienda, gastos): nombre/subtítulo a la izquierda, barra al medio,
//   valor (y opcionalmente delta) a la derecha, en un grid cuyas columnas varían por uso.
// - "stacked" (presentismo por tipo): etiqueta + valor arriba, barra de ancho completo abajo.
import type { DeltaTone } from "@/domain/entities/analytics.entity";
import { DeltaLabel } from "../trend-pill.component";

export interface BarListRow {
  key: string;
  swatchColor?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  // Sin barra: filas puramente de valor (la lista de gastos ya tiene su barra en el
  // stacked-bar de arriba; acá solo repite el color como swatch).
  bar?: { color: string; widthPercent: number };
  valueLabel: string;
  // Texto plano sin color (el "%" de gastos), distinto de un delta con tono.
  secondaryValueLabel?: string;
  deltaLabel?: string;
  deltaTone?: DeltaTone;
}

interface BarListProps {
  rows: BarListRow[];
  variant?: "inline" | "stacked";
  // grid-template-columns del layout "inline": difiere por uso (docentes "160px 1fr 46px 52px",
  // tienda "180px 1fr 92px", gastos "1fr 96px 52px").
  columns?: string;
  // Envuelve las filas en un grid de N columnas, orden por fila (auto-flow: row) — el patrón
  // "grid-template-columns:1fr 1fr" que usa la lista de docentes del prototipo. No confundir
  // con `columns`: eso son las columnas *internas* de cada fila.
  wrapColumns?: number;
}

function ProgressBar({ color, widthPercent }: { color: string; widthPercent: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EDF0F4]">
      <div className="h-2 rounded-full" style={{ background: color, width: `${widthPercent}%` }} />
    </div>
  );
}

export function BarList({ rows, variant = "inline", columns = "160px 1fr 46px 52px", wrapColumns }: BarListProps) {
  if (variant === "stacked") {
    return (
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-[5px]">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-[12.5px] font-medium text-[var(--navy)]">{row.primaryLabel}</span>
              <span className="text-[12.5px] font-semibold text-[#16243C]">{row.valueLabel}</span>
            </div>
            {row.bar && (
              <div className="h-2 overflow-hidden rounded-full bg-[#F1F3F6]">
                <div className="h-2 rounded-full" style={{ background: row.bar.color, width: `${row.bar.widthPercent}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const items = rows.map((row) => (
    <div
      key={row.key}
      className="grid items-center gap-3 border-b border-[#F1F3F6] py-1.5"
      style={{ gridTemplateColumns: columns }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {row.swatchColor && <span className="size-[9px] shrink-0 rounded-sm" style={{ background: row.swatchColor }} />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[12.5px] font-medium text-[var(--navy)]">{row.primaryLabel}</span>
          {row.secondaryLabel && <span className="truncate text-[10.5px] text-[#7A8598]">{row.secondaryLabel}</span>}
        </div>
      </div>

      {row.bar && <ProgressBar color={row.bar.color} widthPercent={row.bar.widthPercent} />}

      <span className="text-right text-[12.5px] font-semibold text-[#16243C]">{row.valueLabel}</span>

      {row.secondaryValueLabel && <span className="text-right text-xs text-[#6E7A90]">{row.secondaryValueLabel}</span>}

      {row.deltaLabel && row.deltaTone && (
        <DeltaLabel label={row.deltaLabel} tone={row.deltaTone} className="text-right text-[11.5px] font-medium" />
      )}
    </div>
  ));

  // Clase en vez de `style` para poder colapsar a 1 columna en mobile con un breakpoint de
  // Tailwind (un inline style no admite variantes responsive).
  if (wrapColumns === 2) {
    return <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">{items}</div>;
  }

  if (wrapColumns && wrapColumns > 1) {
    return (
      <div className="grid gap-x-10" style={{ gridTemplateColumns: `repeat(${wrapColumns}, 1fr)` }}>
        {items}
      </div>
    );
  }

  return <div className="flex flex-col">{items}</div>;
}
