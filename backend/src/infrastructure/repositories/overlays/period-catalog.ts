// Catálogo dinámico de períodos: el historial del mock más los períodos que aparecen en los eventos.
import { Period } from "../../../domain/entities/period.entity";
import { monthIdFromYm, parseMonthId } from "../queries/query-helpers";

// "2026-2C" → posición cronológica; null si el id no tiene formato AAAA-1C / AAAA-2C.
function quarterOrder(id: string): number | null {
  const match = /^(\d{4})-([12])C$/.exec(id);
  return match ? Number(match[1]) * 2 + Number(match[2]) : null;
}

function toPeriods(ids: string[], kind: Period["kind"]): Period[] {
  return ids.map((id, index) => ({ id, label: id, kind, index }));
}

export function mergeQuarters(mock: Period[], defined: string[]): Period[] {
  const byOrder = new Map<number, string>();
  for (const id of [...mock.map((period) => period.id), ...defined]) {
    const order = quarterOrder(id);
    if (order !== null) byOrder.set(order, id);
  }

  const ids = [...byOrder].sort(([a], [b]) => a - b).map(([, id]) => id);
  return toPeriods(ids, "quarter");
}

export function mergeMonths(mock: Period[], eventMonths: string[]): Period[] {
  const byYm = new Map<string, string>();
  for (const period of mock) {
    const range = parseMonthId(period.id);
    if (range) byYm.set(range.ym, period.id);
  }
  for (const ym of eventMonths) {
    const id = monthIdFromYm(ym);
    if (id && !byYm.has(ym)) byYm.set(ym, id);
  }

  const ids = [...byYm].sort(([a], [b]) => a.localeCompare(b)).map(([, id]) => id);
  return toPeriods(ids, "month");
}
