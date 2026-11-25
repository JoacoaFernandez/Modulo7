// Armado de los rangos de fechas de `wallets/aggregates` de CORE: ISO-8601 con el offset de Argentina (-03:00, sin horario
// de verano), `from` incluido y `to` excluido, siempre en límites de mes calendario argentino.
import { WalletAggregatesQuery } from "../gateways/core-wallet.gateway";

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

// "2026-11" → "2026-12"; "2026-12" → "2027-01".
export function nextMonthYm(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

// "2026-11" → "2026-10".
export function previousMonthYm(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

// Inicio del mes en hora argentina: "2026-10" → "2026-10-01T00:00:00-03:00".
export function argentinaMonthStart(ym: string): string {
  if (!YM.test(ym)) throw new Error(`Mes inválido: ${ym}`);
  return `${ym}-01T00:00:00-03:00`;
}

// Mes calendario argentino al que pertenece un instante.
export function argentinaYmOf(instant: Date): string {
  return new Date(instant.getTime() - 3 * 3_600_000).toISOString().slice(0, 7);
}

// Consulta que cubre de `firstYm` a `lastYm` inclusive: `to` es el inicio del mes siguiente a `lastYm` (excluido), así que
// `outstandingBalance` es el saldo al cierre de `lastYm`.
export function walletMonthsQuery(firstYm: string, lastYm: string, groupBy?: "month"): WalletAggregatesQuery {
  return { from: argentinaMonthStart(firstYm), to: argentinaMonthStart(nextMonthYm(lastYm)), ...(groupBy ? { groupBy } : {}) };
}
