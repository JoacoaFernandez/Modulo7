// Pisa con métricas reales (inbox_events) las del tablero de eventos académicos que se derivan de eventos.
import { PrismaClient } from "@prisma/client";
import { EventMonthlyPoint, EventStats, EventTypeStats } from "../../../domain/entities/event-stats.entity";
import { HeldEventRow, queryHeldEvents } from "../queries/events.queries";
import { MonthRange, parseMonthId } from "../queries/query-helpers";
import { capitalize, round1 } from "./overlay-format";

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

const attendance = (present: number, registered: number) => (present * 100) / registered;

export async function overlayEventStats(
  prisma: PrismaClient,
  base: EventStats,
  sedeId: string | null,
): Promise<EventStats> {
  const selected = parseMonthId(base.month);
  const seriesMonths = base.monthlySeries.map((point) => parseMonthId(point.month));
  if (!selected || seriesMonths.some((month) => month === null)) return base;
  const months = seriesMonths as MonthRange[];

  const rows = await queryHeldEvents(prisma, months[0].start, months[months.length - 1].end, sedeId);
  if (rows.length === 0) return base;

  // Frecuencia mensual, concurrencia (presentes) y presentismo sobre inscriptos por mes con eventos.
  const monthlySeries = base.monthlySeries.map((point, index): EventMonthlyPoint => {
    const monthRows = rows.filter((row) => row.ym === months[index].ym);
    if (monthRows.length === 0) return point;

    const totals = sum(monthRows);
    return {
      ...point,
      eventsCount: totals.events,
      attendeesCount: totals.present,
      attendanceRate: totals.registered > 0 ? round1(attendance(totals.present, totals.registered)) : point.attendanceRate,
    };
  });

  const selectedRows = rows.filter((row) => row.ym === selected.ym);
  if (selectedRows.length === 0) return { ...base, monthlySeries };

  // Totales del mes elegido. Sin inscriptos o sin cupo informado no hay tasa real: queda la del mock.
  const totals = sum(selectedRows);
  const byType = new Map<string, HeldEventRow[]>();
  for (const row of selectedRows) byType.set(row.tipoEvento, [...(byType.get(row.tipoEvento) ?? []), row]);

  const typeEntries = [...byType].map(([type, typeRows]) => {
    const typeTotals = sum(typeRows);
    const stats: EventTypeStats = {
      eventType: capitalize(type),
      frequency: typeTotals.events,
      attendeesCount: Math.round(typeTotals.present / typeTotals.events),
      attendanceRate: typeTotals.registered > 0 ? round1(attendance(typeTotals.present, typeTotals.registered)) : 0,
    };
    return { stats, hasRegistered: typeTotals.registered > 0 };
  });
  const eventTypes = typeEntries.map((entry) => entry.stats);

  // El ranking solo considera tipos con inscriptos: sin ellos la tasa 0 no significa "nadie fue".
  const ranked = typeEntries
    .filter((entry) => entry.hasRegistered)
    .map((entry) => entry.stats)
    .sort((a, b) => b.attendanceRate - a.attendanceRate);

  return {
    ...base,
    totalEvents: totals.events,
    totalAttendees: totals.present,
    totalRegistered: totals.registered,
    averageAttendanceRate:
      totals.registered > 0 ? round1(attendance(totals.present, totals.registered)) : base.averageAttendanceRate,
    capacityOccupancy: totals.cupo > 0 ? round1(attendance(totals.present, totals.cupo)) : base.capacityOccupancy,
    bestAttendance:
      ranked.length > 0
        ? { eventType: ranked[0].eventType, attendanceRate: ranked[0].attendanceRate }
        : base.bestAttendance,
    worstAttendance:
      ranked.length > 0
        ? { eventType: ranked[ranked.length - 1].eventType, attendanceRate: ranked[ranked.length - 1].attendanceRate }
        : base.worstAttendance,
    monthlySeries,
    eventTypes,
  };
}
