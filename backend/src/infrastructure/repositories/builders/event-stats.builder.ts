// Arma el tablero de eventos académicos desde los eventos de inbox_events; sin eventos, todo en cero.
import { PrismaClient } from "@prisma/client";
import { EventMonthlyPoint, EventStats, EventTypeStats } from "../../../domain/entities/event-stats.entity";
import { FinancialFilters } from "../../../domain/entities/filters.entity";
import { Period } from "../../../domain/entities/period.entity";
import { Site } from "../../../domain/entities/site.entity";
import { periodWindow } from "../../../domain/services/period-catalog.service";
import { SERIES_LENGTH } from "../../config/dashboard.config";
import { HeldEventRow, queryHeldEvents } from "../queries/events.queries";
import { MonthRange, parseMonthId } from "../queries/query-helpers";
import { capitalize, findSite, indexOfPeriod, percentage, shortMonth } from "./format";
import { SourceMeta } from "./source-meta.builder";

export interface EventsContext {
  sites: Site[];
  months: Period[];
  meta: SourceMeta;
}

interface Totals {
  events: number;
  cupo: number;
  registered: number;
  present: number;
}

function sum(rows: HeldEventRow[]): Totals {
  return rows.reduce(
    (total, row) => ({
      events: total.events + 1,
      cupo: total.cupo + row.cupo,
      registered: total.registered + row.registered,
      present: total.present + row.present,
    }),
    { events: 0, cupo: 0, registered: 0, present: 0 },
  );
}

// Presentismo sobre inscriptos; sin inscriptos no hay tasa real y queda en 0.
const attendanceRate = (present: number, registered: number) => (registered > 0 ? percentage(present, registered) : 0);

function monthRange(month: Period): MonthRange {
  const range = parseMonthId(month.id);
  if (!range) throw new Error(`Mes inválido en el catálogo: ${month.id}`);

  return range;
}

export async function buildEventStats(
  prisma: PrismaClient,
  filters: FinancialFilters,
  context: EventsContext,
): Promise<EventStats> {
  const site = findSite(context.sites, filters.siteId);
  const sedeId = site.isAggregate ? null : site.id;
  const current = indexOfPeriod(context.months, filters.month, "periodo");
  const window = periodWindow(context.months, current, SERIES_LENGTH);
  const selected = monthRange(context.months[current]);

  const rows = await queryHeldEvents(prisma, monthRange(window[0]).start, selected.end, sedeId);

  // Frecuencia mensual, concurrencia (presentes) y presentismo por mes de la ventana.
  const monthlySeries = window.map((month): EventMonthlyPoint => {
    const totals = sum(rows.filter((row) => row.ym === monthRange(month).ym));

    return {
      month: month.id,
      shortMonth: shortMonth(month),
      eventsCount: totals.events,
      attendeesCount: totals.present,
      attendanceRate: attendanceRate(totals.present, totals.registered),
    };
  });

  // Totales del mes elegido, agrupados por tipo de evento.
  const selectedRows = rows.filter((row) => row.ym === selected.ym);
  const totals = sum(selectedRows);
  const byType = new Map<string, HeldEventRow[]>();
  for (const row of selectedRows) byType.set(row.tipoEvento, [...(byType.get(row.tipoEvento) ?? []), row]);

  const typeEntries = [...byType].map(([type, typeRows]) => {
    const typeTotals = sum(typeRows);
    const stats: EventTypeStats = {
      eventType: capitalize(type),
      frequency: typeTotals.events,
      attendeesCount: Math.round(typeTotals.present / typeTotals.events),
      attendanceRate: attendanceRate(typeTotals.present, typeTotals.registered),
    };
    return { stats, hasRegistered: typeTotals.registered > 0 };
  });
  const eventTypes = typeEntries.map((entry) => entry.stats).sort((a, b) => b.frequency - a.frequency);

  // El ranking solo considera tipos con inscriptos: sin ellos la tasa 0 no significa "nadie fue".
  const ranked = typeEntries
    .filter((entry) => entry.hasRegistered)
    .map((entry) => entry.stats)
    .sort((a, b) => b.attendanceRate - a.attendanceRate);
  const highlight = (stats: EventTypeStats | undefined) =>
    stats ? { eventType: stats.eventType, attendanceRate: stats.attendanceRate } : { eventType: "—", attendanceRate: 0 };

  return {
    siteName: site.name,
    month: filters.month,
    totalEvents: totals.events,
    totalAttendees: totals.present,
    totalRegistered: totals.registered,
    averageAttendanceRate: attendanceRate(totals.present, totals.registered),
    // Concurrencia sobre el cupo ofrecido; sin cupo informado no hay tasa.
    capacityOccupancy: totals.cupo > 0 ? percentage(totals.present, totals.cupo) : 0,
    bestAttendance: highlight(ranked[0]),
    worstAttendance: highlight(ranked[ranked.length - 1]),
    monthlySeries,
    eventTypes,
    ...context.meta,
  };
}
