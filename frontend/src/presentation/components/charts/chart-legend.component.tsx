// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// Fila de leyenda (swatch + label) para el encabezado de una sección con gráfico. En el
// prototipo va *al lado* del título, no arriba del gráfico — por eso es un componente aparte
// en vez de vivir dentro de grouped-bar-chart/line-chart: cada tablero la compone en su propio
// header junto con `<h2>`/`<p>`.
export interface ChartLegendItem {
  key: string;
  // Swatch cuadrado (barras) o de línea (series de line-chart / area-line-chart).
  shape?: "square" | "line";
  color: string;
  label: string;
}

interface ChartLegendProps {
  items: ChartLegendItem[];
}

export function ChartLegend({ items }: ChartLegendProps) {
  return (
    <div className="flex shrink-0 gap-3">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-[5px] text-[11px] text-[#52607A]">
          {item.shape === "line" ? (
            <span className="h-0.5 w-3.5 shrink-0 rounded-sm" style={{ background: item.color }} />
          ) : (
            <span className="size-[9px] shrink-0 rounded-sm" style={{ background: item.color }} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}
