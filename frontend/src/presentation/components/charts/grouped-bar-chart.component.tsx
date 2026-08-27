// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// Barras agrupadas + grilla punteada + tooltip on-hover. Porta 1:1 los tres usos del
// prototipo: aprobación por materia (3 series), balance ingresos/egresos (2 series) y
// frecuencia de eventos (1 serie) — mismo layout, cambia la cantidad de series por columna.
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GroupedBarCategory {
  key: string;
  // Un alto por serie, en el mismo orden que `seriesColors` ("74%", ya listo para `height`).
  barHeights: string[];
  // Alto (%) de la barra sobre la que se ancla el tooltip: el prototipo no siempre usa la
  // última (materias ancla en el período más reciente, balance ancla en "Ingresos").
  tooltipAnchorHeight: string;
  tooltip?: ReactNode;
  // Contenido debajo de la barra: una etiqueta de mes, o (materias) código + nombre + delta.
  footer: ReactNode;
}

interface GroupedBarChartProps {
  heightPx?: number;
  seriesColors: string[];
  categories: GroupedBarCategory[];
  columnGap?: string;
  columnPadding?: string;
  barGap?: string;
  gridLines?: number;
}

export function GroupedBarChart({
  heightPx = 216,
  seriesColors,
  categories,
  columnGap = "10px",
  columnPadding = "0 6%",
  barGap = "4px",
  gridLines = 4,
}: GroupedBarChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <div className="relative border-b border-[#DCE1E8]" style={{ height: heightPx }}>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {Array.from({ length: gridLines }, (_, index) => (
            <div key={index} className="border-t border-dashed border-[#DCE1E8]" />
          ))}
        </div>

        <div
          className="relative grid items-end"
          style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)`, gap: columnGap, height: heightPx }}
        >
          {categories.map((category) => {
            const isHovered = hoveredKey === category.key;
            return (
              <div
                key={category.key}
                className="relative flex cursor-default flex-col items-center justify-end"
                style={{ height: heightPx }}
                onMouseEnter={() => setHoveredKey(category.key)}
                onMouseLeave={() => setHoveredKey((current) => (current === category.key ? null : current))}
              >
                <div
                  className={cn("absolute inset-0 rounded", isHovered ? "opacity-100" : "opacity-0")}
                  style={{ background: "rgba(45,93,161,0.06)" }}
                />

                <div
                  className="relative flex h-full w-full items-end justify-center"
                  style={{ gap: barGap, padding: columnPadding }}
                >
                  {category.barHeights.map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t"
                      style={{ background: seriesColors[index], height }}
                    />
                  ))}
                </div>

                {isHovered && category.tooltip && (
                  <div
                    className="absolute left-1/2 z-10 -translate-x-1/2"
                    style={{ bottom: `calc(${category.tooltipAnchorHeight} + 12px)` }}
                  >
                    {category.tooltip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="grid pt-[9px]"
        style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)`, gap: columnGap }}
      >
        {categories.map((category) => (
          <div key={category.key} className="flex flex-col items-center gap-1 text-center">
            {category.footer}
          </div>
        ))}
      </div>
    </div>
  );
}
