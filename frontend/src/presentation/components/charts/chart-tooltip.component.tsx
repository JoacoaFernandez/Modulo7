// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// Tooltip on-hover que usan las barras agrupadas (materias, balance ingresos/egresos,
// frecuencia de eventos): título opcional + filas con swatch/label/valor, y una fila final
// opcional "emphasized" (Resultado, Presentismo) separada por un divisor y en negrita.

export interface ChartTooltipRow {
  // Sin color: la fila no lleva swatch (uso: la fila `emphasized`).
  color?: string;
  label: string;
  value: string;
  emphasized?: boolean;
}

interface ChartTooltipProps {
  title?: string;
  rows: ChartTooltipRow[];
  minWidth?: number;
}

export function ChartTooltip({ title, rows, minWidth = 172 }: ChartTooltipProps) {
  return (
    <div
      className="flex flex-col gap-[7px] rounded-lg border border-[#DCE1E8] bg-white p-[9px_11px] shadow-[0_10px_24px_-12px_rgba(26,43,72,0.28)]"
      style={{ minWidth }}
    >
      {title && <p className="text-[11.5px] font-semibold text-[#16243C]">{title}</p>}
      {rows.map((row, index) =>
        row.emphasized ? (
          <div key={`${row.label}-${index}`} className="flex items-center gap-[7px] border-t border-[#EDF0F4] pt-1.5">
            <span className="flex-1 text-[11px] font-medium text-[#243755]">{row.label}</span>
            <span className="text-[11px] font-semibold text-[#104C30]">{row.value}</span>
          </div>
        ) : (
          <div key={`${row.label}-${index}`} className="flex items-center gap-[7px]">
            {row.color && <span className="size-2 shrink-0 rounded-sm" style={{ background: row.color }} />}
            <span className="flex-1 text-[11px] text-[#5B6980]">{row.label}</span>
            <span className="text-[11px] font-medium text-[var(--navy)]">{row.value}</span>
          </div>
        ),
      )}
    </div>
  );
}
