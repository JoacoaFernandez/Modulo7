// Presentation components: sección "Estadísticas de eventos académicos" del prototipo. No es
// un tablero aparte: vive dentro del tablero financiero (mismo rol "financiera"), en un
// <section id="eventos"> — lo compone `institutional-analytics.page.tsx`, no este componente.
import type { EventStats } from "@/domain/entities/analytics.entity";
import { StatCard } from "./stat-card.component";
import { SectionCard } from "./dashboard/section-card.component";
import { SectionHeader } from "./dashboard/section-header.component";
import { DataSourceNote } from "./dashboard/data-source-note.component";
import { ChartLegend } from "./charts/chart-legend.component";
import { ChartTooltip } from "./charts/chart-tooltip.component";
import { GroupedBarChart, type GroupedBarCategory } from "./charts/grouped-bar-chart.component";
import { AreaLineChart } from "./charts/area-line-chart.component";
import { BarList, type BarListRow } from "./charts/bar-list.component";
import { createScale, buildPolylinePoints, buildAreaPoints, buildDots, buildGridRows } from "@/lib/chart-scale";
import { formatCount, formatPercent } from "@/lib/format";

interface EventsDashboardProps {
  stats: EventStats;
}

const FREQUENCY_COLOR = "#2D5DA1";
const ATTENDANCE_COLOR = "#127453";

function attendanceBarColor(rate: number): string {
  if (rate >= 80) return "#127453";
  if (rate >= 65) return "#2D5DA1";
  return "#A51C30";
}

export function EventsDashboard({ stats }: EventsDashboardProps) {
  const maxEventsCount = Math.max(...stats.monthlySeries.map((m) => m.eventsCount));
  const frequencyCategories: GroupedBarCategory[] = stats.monthlySeries.map((month) => {
    const height = `${(month.eventsCount / maxEventsCount) * 100}%`;
    return {
      key: month.month,
      barHeights: [height],
      tooltipAnchorHeight: height,
      tooltip: (
        <ChartTooltip
          minWidth={180}
          rows={[
            { color: FREQUENCY_COLOR, label: "Eventos", value: formatCount(month.eventsCount) },
            { color: ATTENDANCE_COLOR, label: "Concurrencia", value: formatCount(month.attendeesCount) },
            { label: "Presentismo", value: formatPercent(month.attendanceRate), emphasized: true },
          ]}
        />
      ),
      footer: <span className="text-[10.5px] text-[#6E7A90]">{month.shortMonth}</span>,
    };
  });

  const attendeeValues = stats.monthlySeries.map((m) => m.attendeesCount);
  const attendanceLo = Math.min(...attendeeValues) * 0.85;
  const attendanceHi = Math.max(...attendeeValues) * 1.05;
  const attendanceScale = createScale({
    pointCount: 6,
    domainMin: attendanceLo,
    domainMax: attendanceHi,
    marginLeft: 46,
    plotWidth: 578,
    marginTop: 14,
    plotHeight: 104,
  });
  const attendanceGridValues = [0, 1, 2, 3].map((k) => attendanceHi - ((attendanceHi - attendanceLo) * k) / 3);
  const attendanceGrid = buildGridRows(
    attendanceGridValues,
    { domainMin: attendanceLo, domainMax: attendanceHi, marginTop: 14, plotHeight: 104 },
    (value) => formatCount(Math.round(value)),
  );

  const attendanceRows: BarListRow[] = stats.eventTypes.map((event) => ({
    key: event.eventType,
    primaryLabel: event.eventType,
    valueLabel: formatPercent(event.attendanceRate),
    bar: { color: attendanceBarColor(event.attendanceRate), widthPercent: event.attendanceRate },
  }));

  const maxFrequency = Math.max(...stats.eventTypes.map((e) => e.frequency));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 pt-2">
        <h2 className="font-heading text-[21px] leading-[1.2] text-[#16243C]">Estadísticas de eventos académicos</h2>
        <p className="text-[12.5px] text-[#647188]">Frecuencia, concurrencia y tasa de presentismo · {stats.month}</p>
      </div>

      <div className="grid grid-cols-4 gap-3.5">
        <StatCard label="Eventos realizados" value={formatCount(stats.totalEvents)} unit="eventos" caption={stats.month} />
        <StatCard
          label="Concurrencia total"
          value={formatCount(stats.totalAttendees)}
          unit="asistentes"
          caption={`sobre ${formatCount(stats.totalRegistered)} inscriptos`}
        />
        <StatCard
          label="Presentismo promedio"
          value={formatPercent(stats.averageAttendanceRate)}
          caption="ponderado por frecuencia"
        />
        <StatCard
          label="Ocupación de cupo"
          value={formatPercent(stats.capacityOccupancy)}
          caption="inscriptos sobre cupo ofrecido"
        />
      </div>

      <div className="grid grid-cols-[1.32fr_1fr] items-start gap-4">
        <SectionCard className="px-5 pt-[18px] pb-3.5">
          <SectionHeader
            title="Frecuencia y concurrencia por mes"
            description="Eventos realizados por mes y asistentes acumulados"
            right={
              <ChartLegend
                items={[
                  { key: "eventos", color: FREQUENCY_COLOR, label: "Eventos realizados" },
                  { key: "concurrencia", shape: "line", color: ATTENDANCE_COLOR, label: "Concurrencia" },
                ]}
              />
            }
          />
          <GroupedBarChart
            seriesColors={[FREQUENCY_COLOR]}
            categories={frequencyCategories}
            heightPx={180}
            columnGap="16px"
            columnPadding="0 20%"
          />
          <AreaLineChart
            label="Concurrencia por mes"
            valueLabel={`${formatCount(stats.totalAttendees)} asistentes`}
            grid={attendanceGrid}
            points={buildPolylinePoints(attendeeValues, attendanceScale)}
            areaPoints={buildAreaPoints(attendeeValues, attendanceScale, 118)}
            dots={buildDots(attendeeValues, attendanceScale)}
            color={ATTENDANCE_COLOR}
            viewBoxHeight={130}
            heightPx={104}
          />
        </SectionCard>

        <SectionCard className="px-5 py-[18px]">
          <SectionHeader title="Presentismo por tipo" description={`Asistentes verificados sobre inscriptos · ${stats.month}`} />
          <BarList rows={attendanceRows} variant="stacked" />
          <div className="mt-4 flex flex-col gap-1.5 border-t border-[#E7EAEF] pt-3">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-[11.5px] text-[#647188]">Mayor presentismo</span>
              <span className="text-[11.5px] font-medium text-[#104C30]">
                {stats.bestAttendance.eventType} · {formatPercent(stats.bestAttendance.attendanceRate)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-[11.5px] text-[#647188]">Menor presentismo</span>
              <span className="text-[11.5px] font-medium text-[#A51C30]">
                {stats.worstAttendance.eventType} · {formatPercent(stats.worstAttendance.attendanceRate)}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="px-5 pt-[18px] pb-5">
        <div className="mb-[18px] flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-[17px] leading-[1.25] text-[#16243C]">Eventos académicos</h2>
            <p className="text-xs leading-[1.4] text-[#647188]">
              Frecuencia, concurrencia y presentismo sobre inscriptos · {stats.month}
            </p>
          </div>
          <div className="flex shrink-0 gap-7">
            <div className="flex flex-col items-end gap-[3px]">
              <span className="text-[10.5px] text-[#6E7A90]">Eventos realizados</span>
              <span className="text-xl font-semibold text-[#16243C]">{formatCount(stats.totalEvents)}</span>
            </div>
            <div className="flex flex-col items-end gap-[3px]">
              <span className="text-[10.5px] text-[#6E7A90]">Concurrencia total</span>
              <span className="text-xl font-semibold text-[#16243C]">{formatCount(stats.totalAttendees)}</span>
            </div>
            <div className="flex flex-col items-end gap-[3px]">
              <span className="text-[10.5px] text-[#6E7A90]">Presentismo promedio</span>
              <span className="text-xl font-semibold text-[#16243C]">{formatPercent(stats.averageAttendanceRate)}</span>
            </div>
          </div>
        </div>

        <div
          className="grid gap-3 border-b border-[#E7EAEF] pb-2"
          style={{ gridTemplateColumns: "1.6fr 1.2fr 0.9fr 1.4fr" }}
        >
          <span className="text-[10px] font-medium tracking-[0.1em] text-[#6E7A90] uppercase">Tipo de evento</span>
          <span className="text-[10px] font-medium tracking-[0.1em] text-[#6E7A90] uppercase">Frecuencia</span>
          <span className="text-right text-[10px] font-medium tracking-[0.1em] text-[#6E7A90] uppercase">Concurrencia</span>
          <span className="text-[10px] font-medium tracking-[0.1em] text-[#6E7A90] uppercase">Presentismo</span>
        </div>

        <div className="flex flex-col">
          {stats.eventTypes.map((event) => (
            <div
              key={event.eventType}
              className="grid items-center gap-3 border-b border-[#F1F3F6] py-2.5"
              style={{ gridTemplateColumns: "1.6fr 1.2fr 0.9fr 1.4fr" }}
            >
              <span className="text-[12.5px] font-medium text-[#1A2B48]">{event.eventType}</span>
              <div className="flex items-center gap-2.5">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1F3F6]">
                  <div
                    className="h-2 rounded-full"
                    style={{ background: "#6D94C7", width: `${(event.frequency / maxFrequency) * 100}%` }}
                  />
                </div>
                <span className="w-[62px] text-xs font-medium whitespace-nowrap text-[#243755]">{event.frequency} / mes</span>
              </div>
              <span className="text-right text-[12.5px] font-medium text-[#1A2B48]">{formatCount(event.attendeesCount)}</span>
              <div className="flex items-center gap-2.5">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1F3F6]">
                  <div
                    className="h-2 rounded-full"
                    style={{ background: attendanceBarColor(event.attendanceRate), width: `${event.attendanceRate}%` }}
                  />
                </div>
                <span className="w-9 text-right text-xs font-semibold text-[#1A2B48]">{formatPercent(event.attendanceRate)}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <DataSourceNote>
        Datos de ejemplo · agregados desde eventos del módulo Eventos Académicos · presentismo verificado en el ingreso
      </DataSourceNote>
    </div>
  );
}
