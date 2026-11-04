// Queries de catálogos sobre inbox_events: sedes, períodos con actividad y última ingesta por módulo.
import { PrismaClient } from "@prisma/client";
import { SourceModule } from "../../../domain/entities/event-source.entity";
import { argentinaMonth } from "./query-helpers";

export interface DefinedSite {
  id: string;
  name: string;
}

export interface ModuleIngestion {
  module: SourceModule;
  // Último received_at de ese módulo (ISO 8601).
  lastReceivedAt: string;
}

// Sedes que Backoffice definió (sede.definida): el nombre es el del último evento de cada sedeId y el
// orden, el de su primera definición.
export async function queryDefinedSites(prisma: PrismaClient): Promise<DefinedSite[]> {
  const rows = await prisma.$queryRaw<{ sede_id: string; nombre: string }[]>`
    SELECT sede_id, nombre FROM (
      SELECT DISTINCT ON (payload->>'sedeId')
        payload->>'sedeId' AS sede_id,
        payload->>'nombre' AS nombre,
        MIN(occurred_at) OVER (PARTITION BY payload->>'sedeId') AS first_at
      FROM inbox_events
      WHERE source_module = 'backoffice' AND event_type = 'sede.definida'
        AND payload->>'sedeId' IS NOT NULL AND payload->>'nombre' IS NOT NULL
      ORDER BY payload->>'sedeId', occurred_at DESC
    ) latest
    ORDER BY first_at, sede_id`;

  return rows.map((row) => ({ id: row.sede_id, name: row.nombre }));
}

// Cuatrimestres que nombra cualquier evento: los de cuatrimestre.definido y los de todo payload que lo traiga.
export async function queryQuarterIds(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ cuatrimestre: string }[]>`
    SELECT DISTINCT payload->>'cuatrimestre' AS cuatrimestre
    FROM inbox_events
    WHERE payload->>'cuatrimestre' IS NOT NULL`;

  return rows.map((row) => row.cuatrimestre);
}

// Meses calendario (AAAA-MM, hora de Argentina) con eventos que alimentan los tableros mensuales: financiero
// (core, backoffice, tienda, comedor) y estadísticas de eventos (eventos). No cuentan los eventos de catálogo
// (sede.definida, docente.alta, etc.) ni los académicos, que se filtran por cuatrimestre.
export async function queryEventMonths(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ ym: string }[]>`
    SELECT DISTINCT ${argentinaMonth()} AS ym
    FROM inbox_events
    WHERE (source_module, event_type) IN (
      ('core', 'saldo.movimiento'),
      ('backoffice', 'sueldos.liquidados'),
      ('backoffice', 'gasto.registrado'),
      ('tienda', 'compra.realizada'),
      ('tienda', 'compra.devuelta'),
      ('comedor', 'reserva.confirmada'),
      ('eventos', 'evento.realizado'),
      ('eventos', 'inscripcion.confirmada'),
      ('eventos', 'asistencia.registrada')
    )`;

  return rows.map((row) => row.ym);
}

// Última recepción por módulo emisor; los módulos que nunca mandaron nada no aparecen.
export async function queryModuleIngestions(prisma: PrismaClient): Promise<ModuleIngestion[]> {
  const rows = await prisma.$queryRaw<{ source_module: string; last_received_at: Date }[]>`
    SELECT source_module, MAX(received_at) AS last_received_at
    FROM inbox_events
    GROUP BY source_module`;

  return rows.map((row) => ({
    module: row.source_module as SourceModule,
    lastReceivedAt: row.last_received_at.toISOString(),
  }));
}
