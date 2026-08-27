// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// SVG de área + línea con grilla y puntos. Porta 1:1 "Saldo acumulado" (tablero financiero) y
// "Concurrencia por mes" (eventos) del prototipo: mismo componente, mismo color (verde), viewBox
// más bajo que el de LineChart.
import type { ChartDot, ChartGridRow } from "@/lib/chart-scale";

interface AreaLineChartProps {
  // Fila de encabezado: "Saldo acumulado" / "$ 1.842,9 M" o "Concurrencia por mes" / "N asistentes".
  label: string;
  valueLabel: string;
  grid: ChartGridRow[];
  points: string;
  areaPoints: string;
  dots: ChartDot[];
  color?: string;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  heightPx?: number;
  gridX1?: number;
  gridX2?: number;
  gridTextX?: number;
  gridStroke?: string;
}

export function AreaLineChart({
  label,
  valueLabel,
  grid,
  points,
  areaPoints,
  dots,
  color = "#127453",
  viewBoxWidth = 640,
  viewBoxHeight = 148,
  heightPx = 116,
  gridX1 = 46,
  gridX2 = 624,
  gridTextX = 38,
  gridStroke = "#E2E6EC",
}: AreaLineChartProps) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[#E7EAEF] pt-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[11.5px] font-medium text-[#41506B]">{label}</span>
        <span className="text-[13px] font-semibold text-[#16243C]">{valueLabel}</span>
      </div>

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
            stroke={gridStroke}
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
            style={{ font: "400 9.5px 'Hanken Grotesk', sans-serif", fill: "#7A8598" }}
          >
            {row.label}
          </text>
        ))}
        <polygon points={areaPoints} fill={color} fillOpacity={0.1} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {dots.map((dot, index) => (
          <circle key={`dot-${index}`} cx={dot.x} cy={dot.y} r={2.6} fill={color} />
        ))}
      </svg>
    </div>
  );
}
