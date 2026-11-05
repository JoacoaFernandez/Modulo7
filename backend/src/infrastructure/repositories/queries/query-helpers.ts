// Queries de agregación sobre inbox_events: helpers comunes de sede y período para las queries crudas.
import { Prisma } from "@prisma/client";
import { ARGENTINA_TZ, MONTH_LABELS } from "../../../domain/services/period-catalog.service";

// Las fechas de los tableros son hora de Argentina; occurred_at es timestamptz (se guarda en UTC).
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
export function siteFilter(sedeId: string | null, column: Prisma.Sql = Prisma.sql`data->>'sedeId'`): Prisma.Sql {
  return sedeId === null ? Prisma.empty : Prisma.sql`AND ${column} = ${sedeId}`;
}

// Filtro de facultad; null (todas) no filtra. La facultad sólo existe en curso.abierto, así que el resto de los
// eventos se atribuye por (cursoId, cuatrimestre) del curso que abrió esa facultad. `cursoId` y `cuatrimestre`
// son las columnas del evento que se filtra; el nombre viaja bindeado, nunca concatenado.
export function facultyFilter(facultad: string | null, cursoId: Prisma.Sql, cuatrimestre: Prisma.Sql): Prisma.Sql {
  return facultad === null
    ? Prisma.empty
    : Prisma.sql`AND (${cursoId}, ${cuatrimestre}) IN (
        SELECT fa.data->>'cursoId', fa.data->>'cuatrimestre'
        FROM inbox_events fa
        WHERE fa.source = 'gestion-academica' AND fa.event_type = 'curso.abierto'
          AND fa.data->>'facultad' = ${facultad}
      )`;
}

// Mes calendario (AAAA-MM, hora de Argentina) de occurred_at.
export function argentinaMonth(column: Prisma.Sql = Prisma.sql`occurred_at`): Prisma.Sql {
  return Prisma.sql`to_char(${column} AT TIME ZONE ${ARGENTINA_TZ}, 'YYYY-MM')`;
}
