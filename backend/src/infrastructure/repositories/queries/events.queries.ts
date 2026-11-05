// Queries del tablero de eventos académicos sobre inbox_events (módulo eventos).
import { PrismaClient } from "@prisma/client";
import { argentinaMonth, siteFilter } from "./query-helpers";

// Un evento realizado con sus inscriptos y presentes (personas distintas).
export interface HeldEventRow {
  ym: string;
  tipoEvento: string;
  cupo: number;
  registered: number;
  present: number;
}

// Eventos realizados en el rango, con inscripción neta (confirmadas menos canceladas) y presentes.
// asistencia.registrada e inscripcion.* no traen sede ni fecha: se asocian por eventoId al
// evento.realizado, que sí tiene sede.
export async function queryHeldEvents(
  prisma: PrismaClient,
  from: string,
  to: string,
  sedeId: string | null,
): Promise<HeldEventRow[]> {
  const rows = await prisma.$queryRaw<
    { ym: string; tipo_evento: string; cupo: number; registered: number; present: number }[]
  >`
    WITH held AS (
      SELECT DISTINCT ON (data->>'eventoId')
        data->>'eventoId' AS evento_id,
        ${argentinaMonth()} AS ym,
        data->>'tipoEvento' AS tipo_evento,
        COALESCE((data->>'cupo')::numeric, 0) AS cupo
      FROM inbox_events
      WHERE source = 'eventos' AND event_type = 'evento.realizado'
        AND occurred_at >= ${from}::timestamptz AND occurred_at < ${to}::timestamptz
        ${siteFilter(sedeId)}
      ORDER BY data->>'eventoId', occurred_at DESC
    )
    SELECT h.ym, h.tipo_evento, h.cupo::float8 AS cupo,
      (SELECT COUNT(DISTINCT i.data->>'personaId')::int
       FROM inbox_events i
       WHERE i.source = 'eventos' AND i.event_type = 'inscripcion.confirmada'
         AND i.data->>'eventoId' = h.evento_id
         AND NOT EXISTS (
           SELECT 1 FROM inbox_events c
           WHERE c.source = 'eventos' AND c.event_type = 'inscripcion.cancelada'
             AND c.data->>'eventoId' = h.evento_id
             AND c.data->>'personaId' = i.data->>'personaId'
             AND c.occurred_at >= i.occurred_at)) AS registered,
      (SELECT COUNT(DISTINCT a.data->>'personaId')::int
       FROM inbox_events a
       WHERE a.source = 'eventos' AND a.event_type = 'asistencia.registrada'
         AND a.data->>'eventoId' = h.evento_id
         AND (a.data->>'presente')::boolean) AS present
    FROM held h`;

  return rows.map((row) => ({
    ym: row.ym,
    tipoEvento: row.tipo_evento,
    cupo: row.cupo,
    registered: row.registered,
    present: row.present,
  }));
}
