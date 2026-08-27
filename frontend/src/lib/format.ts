// Formateadores de presentación que el backend no devuelve ya resueltos. La convención del
// proyecto es que el backend formatea (`KpiCard.formattedValue`, `MonthlyBalancePoint.formattedIncome`,
// etc.); estos helpers cubren los pocos casos que quedan del lado del frontend: los 4 KPIs de
// `EventStats` (sin `Delta` ni formato en la entidad — el diseño tampoco les pone chip de delta),
// labels de eje de gráfico (valores sintéticos de grilla, no datos reales), y el timestamp de
// última ingesta que ya usaba `role-selector.page.tsx`.

export function formatCount(value: number): string {
  return value.toLocaleString("es-AR");
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Mismo formato que `money()` en el backend (`analytics-calculator.service.ts`), sin el
// prefijo "$ ": lo usan los labels del eje de los gráficos de área (saldo acumulado).
export function formatMillions(value: number): string {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// "26/08 04:12", en la zona horaria del dato (el mock viaja con su propio offset -03:00).
export function formatLastIngestion(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  })
    .format(date)
    .replace(",", "");
}
