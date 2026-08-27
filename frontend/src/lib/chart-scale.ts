// Helpers de escala para las primitivas SVG (line-chart, area-line-chart). Portados de las
// funciones x()/y() del prototipo (Analitica Institucional.dc.html): el diseño las recalcula
// inline por gráfico con sus propias constantes —
//   facultades:      x = n => 44 + n*(584/5),  y = v => 16 + (1-(v-50)/42)*160
//   saldo acumulado: x = n => 46 + n*(578/5),  y = v => 14 + (1-(v-lo)/(hi-lo))*128
//   concurrencia:    x = n => 46 + n*(578/5),  y = v => 14 + (1-(v-clo)/(chi-clo))*104
// acá quedan generalizadas a los mismos parámetros (dominio, margen, tamaño del área de ploteo)
// para que Paso 7 arme cualquiera de los tres sin repetir la fórmula.

export interface ChartScale {
  x: (index: number) => number;
  y: (value: number) => number;
}

export interface ScaleConfig {
  // Cantidad de puntos de la serie (períodos en el eje X).
  pointCount: number;
  domainMin: number;
  domainMax: number;
  marginLeft: number;
  plotWidth: number;
  marginTop: number;
  plotHeight: number;
}

export function createScale({
  pointCount,
  domainMin,
  domainMax,
  marginLeft,
  plotWidth,
  marginTop,
  plotHeight,
}: ScaleConfig): ChartScale {
  const step = pointCount > 1 ? plotWidth / (pointCount - 1) : 0;
  const domainSize = domainMax - domainMin || 1;
  return {
    x: (index) => marginLeft + index * step,
    y: (value) => marginTop + (1 - (value - domainMin) / domainSize) * plotHeight,
  };
}

// "x1,y1 x2,y2 ..." listo para el atributo `points` de <polyline>.
export function buildPolylinePoints(values: number[], scale: ChartScale): string {
  return values.map((value, index) => `${scale.x(index).toFixed(1)},${scale.y(value).toFixed(1)}`).join(" ");
}

export interface ChartDot {
  x: string;
  y: string;
}

export function buildDots(values: number[], scale: ChartScale): ChartDot[] {
  return values.map((value, index) => ({ x: scale.x(index).toFixed(1), y: scale.y(value).toFixed(1) }));
}

// Polígono cerrado para el relleno de área bajo la línea: sube por los puntos de la serie y
// vuelve por la línea de base (mismo patrón que `saldoLine.area` / `evLinea.area` del prototipo).
export function buildAreaPoints(values: number[], scale: ChartScale, baselineY: number): string {
  const start = `${scale.x(0).toFixed(1)},${baselineY}`;
  const end = `${scale.x(values.length - 1).toFixed(1)},${baselineY}`;
  return [start, buildPolylinePoints(values, scale), end].join(" ");
}

export interface ChartGridRow {
  // Posición de la línea punteada.
  y: string;
  // Posición del label de texto (el prototipo la corre ~4px respecto de `y` para centrarla
  // verticalmente contra la línea: `ty` en la serie de facultades, `dy="3.5"` en saldo/eventos).
  textY: string;
  label: string;
}

// Grilla horizontal punteada + su label, en `values` explícitos (no en pasos automáticos):
// el prototipo por ejemplo fija [90,80,70,60,50] para el gráfico de facultades en vez de
// derivarlos del dominio real de los datos.
export function buildGridRows(
  values: number[],
  { marginTop, plotHeight, domainMin, domainMax }: Pick<ScaleConfig, "marginTop" | "plotHeight" | "domainMin" | "domainMax">,
  formatLabel: (value: number) => string,
  textOffset = 4,
): ChartGridRow[] {
  const domainSize = domainMax - domainMin || 1;
  return values.map((value) => {
    const y = marginTop + (1 - (value - domainMin) / domainSize) * plotHeight;
    return { y: y.toFixed(1), textY: (y + textOffset).toFixed(1), label: formatLabel(value) };
  });
}
