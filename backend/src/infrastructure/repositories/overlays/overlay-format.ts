// Overlays de métricas reales sobre el resultado del mock: formatos y cálculos compartidos (mismos criterios que el calculator).
import { KpiCard } from "../../../domain/entities/kpi.value-object";

export const MILLION = 1_000_000;

// Redondeo a un decimal, como las tasas del mock.
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function toMillions(amountArs: number): number {
  return amountArs / MILLION;
}

export function money(amount: number): string {
  const formatted = amount.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `$ ${formatted} M`;
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

// Reemplaza una tarjeta por id conservando el resto del arreglo.
export function replaceKpi(kpis: KpiCard[], id: string, patch: Partial<KpiCard>): KpiCard[] {
  return kpis.map((kpi) => (kpi.id === id ? { ...kpi, ...patch } : kpi));
}
