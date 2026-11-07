// Arma el tablero de eventos académicos (docs/INTEGRACION.md, 6.3) desde los eventos de G6 y las locaciones de G8 en inbox_events; sin eventos, todo en cero.
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
import { WarningCollector } from "./warning-collector";

export interface EventsContext {
  sites: Site[];
  months: Period[];
  warnings: WarningCollector;
  meta: SourceMeta;
}

interface Totals {
  events: number;
  capacity: number;
  registered: number;
  present: number;
}

function sum(rows: HeldEventRow[]): Totals {
  return rows.reduce(
    (total, row) => ({
      events: total.events + 1,
      capacity: total.capacity + row.capacity,
      registered: total.registered + row.registered,
      present: total.present + row.present,
    }),
    { events: 0, capacity: 0, registered: 0, present: 0 },
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
  const siteId = site.isAggregate ? null : site.id;
  const current = indexOfPeriod(context.months, filters.month, "periodo");
  const window = periodWindow(context.months, current, SERIES_LENGTH);
  const selected = monthRange(context.months[current]);

  const rows = await queryHeldEvents(prisma, monthRange(window[0]).start, selected.end, siteId);

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
  for (const row of selectedRows) byType.set(row.eventType, [...(byType.get(row.eventType) ?? []), row]);

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

  // Mientras G6 no informe `category`, el tipo es la clase de precio: se declara en un aviso.
  if (selectedRows.some((row) => row.typeFromPrice)) {
    context.warnings.add(
      "events",
      "Tipo de evento aproximado por clase de precio (Pago / Gratuito): G6 todavía no informa `category` en events.event.created.v1.",
    );
  }

  return {
    siteName: site.name,
    month: filters.month,
    totalEvents: totals.events,
    totalAttendees: totals.present,
    totalRegistered: totals.registered,
    averageAttendanceRate: attendanceRate(totals.present, totals.registered),
    // Concurrencia sobre el cupo ofrecido (`capacity`); sin cupo informado no hay tasa.
    capacityOccupancy: totals.capacity > 0 ? percentage(totals.present, totals.capacity) : 0,
    bestAttendance: highlight(ranked[0]),
    worstAttendance: highlight(ranked[ranked.length - 1]),
    monthlySeries,
    eventTypes,
    ...(context.warnings.warnings ? { warnings: context.warnings.warnings } : {}),
    ...context.meta,
  };
}
