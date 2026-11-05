// Builders de tableros: formatos y cálculos compartidos (montos en millones de ARS, tasas con un decimal).
import { Period } from "../../../domain/entities/period.entity";
import { Site } from "../../../domain/entities/site.entity";

export const MILLION = 1_000_000;

// Redondeo a un decimal, como las tasas de los tableros.
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Tasa porcentual con un decimal.
export function percentage(part: number, total: number): number {
  return round1((part * 100) / total);
}

export function toMillions(amountArs: number): number {
  return amountArs / MILLION;
}

// Recibe millones de ARS. Desde un millón se muestra en millones con un decimal ("$ 1,1 M");
// por debajo, en pesos enteros ("$ 1.000"), para que una venta chica no quede como "$ 0,0 M".
export function money(amountMillions: number): string {
  if (Math.abs(amountMillions) >= 1) {
    const formatted = amountMillions.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `$ ${formatted} M`;
  }

  const pesos = Math.round(amountMillions * MILLION);
  return `$ ${pesos.toLocaleString("es-AR")}`;
}

export function count(value: number): string {
  return value.toLocaleString("es-AR");
}

// Variación porcentual entre dos valores; 0 cuando no hay base de comparación.
export function growth(current: number, previous: number): number {
  return previous === 0 ? 0 : (current / previous - 1) * 100;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "Nov 2026" → "Nov", el eje X de los gráficos mensuales.
export function shortMonth(month: Period): string {
  return month.id.slice(0, 3);
}

// Sede del filtro. Un id que no está en el catálogo sólo llega acá si Backoffice no respondió (el validador lo acepta
// con un aviso): se conserva el id y el nombre queda genérico, sin romper el tablero.
export function findSite(sites: Site[], siteId: string): Site {
  return sites.find((candidate) => candidate.id === siteId) ?? { id: siteId, name: `Sede ${siteId.slice(0, 8)}`, isAggregate: false };
}

export function indexOfPeriod(periods: Period[], id: string, label: string): number {
  const index = periods.findIndex((period) => period.id === id);
  if (index < 0) throw new Error(`Valor desconocido para ${label}: ${id}`);

  return index;
}
