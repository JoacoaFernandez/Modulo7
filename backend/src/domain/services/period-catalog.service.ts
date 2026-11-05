// Domain services: business rules that span entities and don't belong to a single one.
// Catálogo de períodos de los filtros: arma cuatrimestres y meses a partir de lo que dicen los eventos.
import { Period } from "../entities/period.entity";

// Los tableros hablan en hora de Argentina; los eventos se guardan en UTC.
export const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

export const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// "2026-2C" → posición cronológica; null si el id no tiene formato AAAA-1C / AAAA-2C.
function quarterOrder(id: string): number | null {
  const match = /^(\d{4})-([12])C$/.exec(id);
  return match ? Number(match[1]) * 2 + Number(match[2]) : null;
}

function toPeriods(ids: string[], kind: Period["kind"]): Period[] {
  return ids.map((id, index) => ({ id, label: id, kind, index }));
}

// "2026-11" → "Nov 2026", el id que usa el catálogo de períodos; null si no tiene ese formato.
export function monthIdFromYm(ym: string): string | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
  return match ? `${MONTH_LABELS[Number(match[2]) - 1]} ${match[1]}` : null;
}

// Año y mes (hora de Argentina) del instante dado.
function argentinaYearMonth(now: Date): { year: number; month: number } {
  const [year, month] = now.toLocaleDateString("en-CA", { timeZone: ARGENTINA_TZ }).split("-");
  return { year: Number(year), month: Number(month) };
}

// Cuatrimestre en curso según la fecha: ago–dic = 2C, mar–jul = 1C, ene–feb = 2C del año anterior.
export function currentQuarterId(now: Date): string {
  const { year, month } = argentinaYearMonth(now);
  if (month >= 8) return `${year}-2C`;
  if (month >= 3) return `${year}-1C`;
  return `${year - 1}-2C`;
}

export function currentMonthYm(now: Date): string {
  const { year, month } = argentinaYearMonth(now);
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Cuatrimestres ordenados y sin repetir; los ids con otro formato se descartan. Sin ninguno
// (base vacía) se devuelve el cuatrimestre actual para que el filtro tenga una opción válida.
export function buildQuarterCatalog(ids: string[], now: Date): Period[] {
  const valid = [...new Set(ids)]
    .map((id) => ({ id, order: quarterOrder(id) }))
    .filter((quarter): quarter is { id: string; order: number } => quarter.order !== null)
    .sort((a, b) => a.order - b.order)
    .map((quarter) => quarter.id);

  return toPeriods(valid.length > 0 ? valid : [currentQuarterId(now)], "quarter");
}

// Meses (AAAA-MM) ordenados y sin repetir, con el id "Ago 2026". Sin ninguno devuelve el mes actual.
export function buildMonthCatalog(yms: string[], now: Date): Period[] {
  const valid = [...new Set(yms)].filter((ym) => monthIdFromYm(ym) !== null).sort();
  const ids = (valid.length > 0 ? valid : [currentMonthYm(now)]).map((ym) => monthIdFromYm(ym) as string);

  return toPeriods(ids, "month");
}

// Hasta `size` períodos consecutivos que terminan en `endIndex`: la ventana de las series de los gráficos.
export function periodWindow(periods: Period[], endIndex: number, size: number): Period[] {
  return periods.slice(Math.max(0, endIndex - size + 1), endIndex + 1);
}

// Meses (AAAA-MM) desde `firstYm` hasta el mes actual inclusive, con el id "Ago 2026" (DASHBOARD_FIRST_MONTH). Si
// `firstYm` es inválido o futuro, devuelve sólo el mes actual.
export function buildMonthRange(firstYm: string, now: Date): Period[] {
  const current = currentMonthYm(now);
  const yms: string[] = [];

  if (monthIdFromYm(firstYm) !== null && firstYm <= current) {
    let [year, month] = firstYm.split("-").map(Number);
    for (;;) {
      const ym = `${year}-${String(month).padStart(2, "0")}`;
      yms.push(ym);
      if (ym === current) break;
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  }

  return buildMonthCatalog(yms, now);
}

// Id de cuatrimestre de un período de Gestión Académica: { anio: 2026, numero: 1 } → "2026-1C".
export function quarterIdOf(period: { anio: number; numero: number }): string {
  return `${period.anio}-${period.numero}C`;
}

// Fecha (AAAA-MM-DD) de hoy en Argentina.
export function argentinaToday(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: ARGENTINA_TZ });
}
