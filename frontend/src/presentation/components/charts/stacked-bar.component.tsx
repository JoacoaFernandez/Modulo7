// Presentation components: primitiva de gráficos, reutilizable entre los 3 tableros.
// Barra apilada 100% (gastos administrativos en el prototipo): una tira de segmentos de
// color proporcionales al `widthPercent` de cada uno. La leyenda debajo va por separado,
// con `BarList` (variant "inline", sin `bar`, swatch + label + monto + %).
export interface StackedBarSegment {
  key: string;
  color: string;
  widthPercent: number;
}

interface StackedBarProps {
  segments: StackedBarSegment[];
  heightPx?: number;
}

export function StackedBar({ segments, heightPx = 10 }: StackedBarProps) {
  return (
    <div className="mb-4 flex overflow-hidden rounded-full" style={{ height: heightPx }}>
      {segments.map((segment) => (
        <div key={segment.key} style={{ background: segment.color, width: `${segment.widthPercent}%`, height: heightPx }} />
      ))}
    </div>
  );
}
