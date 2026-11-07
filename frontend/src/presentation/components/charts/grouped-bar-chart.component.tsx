// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// Barras agrupadas + grilla punteada + tooltip on-hover. Porta 1:1 los tres usos del
// prototipo: aprobación por materia (3 series), balance ingresos/egresos (2 series) y
// frecuencia de eventos (1 serie) — mismo layout, cambia la cantidad de series por columna.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Separación entre el tooltip y la barra, y margen mínimo contra los bordes de la ventana.
const TOOLTIP_OFFSET_PX = 12;
const VIEWPORT_MARGIN_PX = 8;

interface FloatingTooltipProps {
  // Columna sobre la que se ancla (su rectángulo en pantalla se relee al scrollear).
  anchor: HTMLElement;
  // Alto de la barra ancla como porcentaje ("74%") del alto de la columna.
  anchorHeight: string;
  children: ReactNode;
}

// El gráfico vive dentro de un contenedor con overflow-x-auto (scroll en mobile), que también
// recorta en vertical: un tooltip absoluto sobre una barra alta quedaba cortado. Por eso se
// renderiza en un portal con position: fixed, arriba de la barra, o debajo si no entra arriba.
function FloatingTooltip({ anchor, anchorHeight, children }: FloatingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const column = anchor.getBoundingClientRect();
      const { width, height } = tooltip.getBoundingClientRect();
      const barTop = column.bottom - (column.height * parseFloat(anchorHeight)) / 100;

      const above = barTop - TOOLTIP_OFFSET_PX - height;
      const top = above >= VIEWPORT_MARGIN_PX ? above : barTop + TOOLTIP_OFFSET_PX;
      const centered = column.left + column.width / 2 - width / 2;
      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN_PX;
      setPosition({ top, left: Math.max(VIEWPORT_MARGIN_PX, Math.min(centered, maxLeft)) });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, anchorHeight]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed z-50"
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}

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
  // Ancho mínimo por columna: si el contenedor queda más angosto que
  // `categories.length * minColumnPx`, el gráfico scrollea en vez de aplastar cada barra y su
  // footer hasta volverlos ilegibles (pasa en mobile con muchas categorías, p. ej. 8 materias).
  minColumnPx?: number;
}

export function GroupedBarChart({
  heightPx = 216,
  seriesColors,
  categories,
  columnGap = "10px",
  columnPadding = "0 6%",
  barGap = "4px",
  gridLines = 4,
  minColumnPx,
}: GroupedBarChartProps) {
  const [hovered, setHovered] = useState<{ key: string; element: HTMLElement } | null>(null);
  const hoveredKey = hovered?.key ?? null;
  // Si cambian las categorías (otro filtro) y la columna ya no existe, el tooltip no se muestra.
  const hoveredCategory = categories.find((category) => category.key === hoveredKey);

  const minWidth = minColumnPx ? categories.length * minColumnPx : undefined;

  return (
    <div className="flex flex-col overflow-x-auto">
      <div className="relative border-b border-[#DCE1E8]" style={{ height: heightPx, minWidth }}>
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
                onMouseEnter={(event) => setHovered({ key: category.key, element: event.currentTarget })}
                onMouseLeave={() => setHovered((current) => (current?.key === category.key ? null : current))}
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
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="grid pt-[9px]"
        style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)`, gap: columnGap, minWidth }}
      >
        {categories.map((category) => (
          <div key={category.key} className="flex flex-col items-center gap-1 text-center">
            {category.footer}
          </div>
        ))}
      </div>

      {hovered && hoveredCategory?.tooltip && (
        <FloatingTooltip anchor={hovered.element} anchorHeight={hoveredCategory.tooltipAnchorHeight}>
          {hoveredCategory.tooltip}
        </FloatingTooltip>
      )}
    </div>
  );
}
