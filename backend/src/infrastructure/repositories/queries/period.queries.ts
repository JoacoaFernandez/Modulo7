// Queries del catálogo de períodos sobre inbox_events: qué cuatrimestres y meses tienen actividad real.
import { PrismaClient } from "@prisma/client";
import { argentinaMonth } from "./query-helpers";

// Cuatrimestres que Gestión Académica definió (cuatrimestre.definido), tal como llegaron en el payload.
export async function queryDefinedQuarters(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ cuatrimestre: string }[]>`
    SELECT DISTINCT payload->>'cuatrimestre' AS cuatrimestre
    FROM inbox_events
    WHERE source_module = 'gestion-academica'
      AND event_type = 'cuatrimestre.definido'
      AND payload->>'cuatrimestre' IS NOT NULL`;

  return rows.map((row) => row.cuatrimestre);
}

// Meses calendario (AAAA-MM, hora de Argentina) en los que ocurrió algún evento, de cualquier módulo.
export async function queryEventMonths(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ ym: string }[]>`
    SELECT DISTINCT ${argentinaMonth()} AS ym FROM inbox_events`;

  return rows.map((row) => row.ym);
}
