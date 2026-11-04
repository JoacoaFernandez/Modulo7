// Queries de agregación sobre inbox_events: helpers comunes de sede y período para las queries crudas.
import { Prisma } from "@prisma/client";
import { ARGENTINA_TZ, MONTH_LABELS } from "../../../domain/services/period-catalog.service";

// Las fechas de los tableros son hora de Argentina; occurred_at se guarda en UTC (timestamp sin zona).
const ARGENTINA_UTC_OFFSET_HOURS = 3;

export interface MonthRange {
  // AAAA-MM, el mismo formato que `periodo` en sueldos.liquidados.
  ym: string;
  // Límites en UTC (ISO 8601): [start, end).
  start: string;
  end: string;
}

// "Ago 2026" → rango del mes en hora de Argentina; null si el id no tiene ese formato.
export function parseMonthId(id: string): MonthRange | null {
  const [label, yearText] = id.split(" ");
  const monthIndex = MONTH_LABELS.indexOf(label);
  const year = Number(yearText);
  if (monthIndex < 0 || !Number.isInteger(year)) return null;

  const start = new Date(Date.UTC(year, monthIndex, 1, ARGENTINA_UTC_OFFSET_HOURS));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, ARGENTINA_UTC_OFFSET_HOURS));

  return {
    ym: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// Filtro de sede; null (sede agregada) no filtra. `column` permite calificar el alias en los joins.
export function siteFilter(sedeId: string | null, column: Prisma.Sql = Prisma.sql`payload->>'sedeId'`): Prisma.Sql {
  return sedeId === null ? Prisma.empty : Prisma.sql`AND ${column} = ${sedeId}`;
}

// Mes calendario (AAAA-MM, hora de Argentina) de occurred_at.
export function argentinaMonth(column: Prisma.Sql = Prisma.sql`occurred_at`): Prisma.Sql {
  return Prisma.sql`to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${ARGENTINA_TZ}, 'YYYY-MM')`;
}
