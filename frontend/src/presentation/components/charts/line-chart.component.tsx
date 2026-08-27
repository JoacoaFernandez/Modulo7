// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// SVG multi-serie con grilla punteada, puntos y leyenda con último valor + delta. Porta
// 1:1 la sección "Tendencia por facultad" del prototipo (viewBox 0 0 640 208).
import type { DeltaTone } from "@/domain/entities/analytics.entity";
import type { ChartDot, ChartGridRow } from "@/lib/chart-scale";
import { DeltaLabel } from "../trend-pill.component";

export interface LineChartSeries {
  name: string;
  color: string;
  // "x1,y1 x2,y2 ..." — ya calculado con `chart-scale` (createScale + buildPolylinePoints).
  points: string;
  dots: ChartDot[];
  lastValueLabel: string;
  delta: { formatted: string; tone: DeltaTone };
}

interface LineChartProps {
  grid: ChartGridRow[];
  series: LineChartSeries[];
  // Etiquetas del eje X, debajo del gráfico (un período por columna).
  categories: string[];
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  heightPx?: number;
  gridX1?: number;
  gridX2?: number;
  gridTextX?: number;
}

export function LineChart({
  grid,
  series,
  categories,
  viewBoxWidth = 640,
  viewBoxHeight = 208,
  heightPx = 212,
  gridX1 = 44,
  gridX2 = 628,
  gridTextX = 34,
}: LineChartProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: heightPx, display: "block", overflow: "visible" }}
      >
        {grid.map((row) => (
          <line
            key={`grid-${row.y}`}
            x1={gridX1}
            x2={gridX2}
            y1={row.y}
            y2={row.y}
            stroke="#DCE1E8"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {grid.map((row) => (
          <text
            key={`grid-label-${row.y}`}
            x={gridTextX}
            y={row.textY}
            textAnchor="end"
            style={{ font: "400 10px 'Hanken Grotesk', sans-serif", fill: "#7A8598" }}
          >
            {row.label}
          </text>
        ))}
        {series.map((s) => (
          <polyline
            key={`line-${s.name}`}
            points={s.points}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {series.map((s) =>
          s.dots.map((dot, index) => (
            <circle key={`dot-${s.name}-${index}`} cx={dot.x} cy={dot.y} r={2.6} fill={s.color} />
          )),
        )}
      </svg>

      <div className="grid gap-0 pb-3.5" style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)`, paddingLeft: gridX1 }}>
        {categories.map((label) => (
          <div key={label} className="text-center text-[10px] text-[#6E7A90]">
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[7px] border-t border-[#E7EAEF] pt-3">
        {series.map((s) => (
          <div key={`legend-${s.name}`} className="flex items-center gap-2.5">
            <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 text-xs text-[#41506B]">{s.name}</span>
            <span className="text-xs font-medium text-[var(--navy)]">{s.lastValueLabel}</span>
            <DeltaLabel
              label={s.delta.formatted}
              tone={s.delta.tone}
              className="w-fit flex-none text-right text-[11.5px] font-medium whitespace-nowrap"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
