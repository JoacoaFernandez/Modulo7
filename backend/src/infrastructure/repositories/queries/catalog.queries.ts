// Queries de catálogos sobre inbox_events: sedes, períodos con actividad y última ingesta por módulo.
import { PrismaClient } from "@prisma/client";
import { isCoreSource, SOURCE_BY_CORE, SourceModule } from "../../../domain/entities/event-source.entity";
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
      SELECT DISTINCT ON (data->>'sedeId')
        data->>'sedeId' AS sede_id,
        data->>'nombre' AS nombre,
        MIN(occurred_at) OVER (PARTITION BY data->>'sedeId') AS first_at
      FROM inbox_events
      WHERE source = 'backoffice' AND event_type = 'sede.definida'
        AND data->>'sedeId' IS NOT NULL AND data->>'nombre' IS NOT NULL
      ORDER BY data->>'sedeId', occurred_at DESC
    ) latest
    ORDER BY first_at, sede_id`;

  return rows.map((row) => ({ id: row.sede_id, name: row.nombre }));
}

// Facultades que informó algún curso.abierto (`facultad` no vacía), ordenadas alfabéticamente. Es el catálogo del
// filtro del tablero académico y fija el color estable de cada facultad en el gráfico de tendencias.
export async function queryFacultyNames(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ facultad: string }[]>`
    SELECT DISTINCT data->>'facultad' AS facultad
    FROM inbox_events
    WHERE source = 'gestion-academica' AND event_type = 'curso.abierto'
      AND btrim(data->>'facultad') <> ''`;

  return rows.map((row) => row.facultad).sort((a, b) => a.localeCompare(b, "es"));
}

// Cuatrimestres que nombra cualquier evento: los de cuatrimestre.definido y los de todo payload que lo traiga.
export async function queryQuarterIds(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ cuatrimestre: string }[]>`
    SELECT DISTINCT data->>'cuatrimestre' AS cuatrimestre
    FROM inbox_events
    WHERE data->>'cuatrimestre' IS NOT NULL`;

  return rows.map((row) => row.cuatrimestre);
}

// Meses calendario (AAAA-MM, hora de Argentina) con eventos que alimentan los tableros mensuales: financiero
// (core, backoffice, tienda, comedor) y estadísticas de eventos (eventos). No cuentan los eventos de catálogo
// (sede.definida, docente.alta, etc.) ni los académicos, que se filtran por cuatrimestre.
export async function queryEventMonths(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ ym: string }[]>`
    SELECT DISTINCT ${argentinaMonth()} AS ym
    FROM inbox_events
    WHERE (source, event_type) IN (
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

// Última recepción por módulo emisor (source_ingestions, incluye los eventos descartados); los módulos que nunca
// mandaron nada no aparecen. `source` de CORE se traduce al módulo de nuestro dominio.
export async function queryModuleIngestions(prisma: PrismaClient): Promise<ModuleIngestion[]> {
  const rows = await prisma.sourceIngestion.findMany();

  return rows.flatMap((row) =>
    isCoreSource(row.source)
      ? [{ module: SOURCE_BY_CORE[row.source], lastReceivedAt: row.lastReceivedAt.toISOString() }]
      : [],
  );
}
