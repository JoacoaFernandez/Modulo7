// Presentation components: tablero académico. Porta 1:1 la pantalla "Rendimiento académico"
// del prototipo (Analitica Institucional.dc.html) contra las primitivas del Paso 6.
import type { AcademicStats } from "@/domain/entities/analytics.entity";
import { StatCard } from "./stat-card.component";
import { DeltaLabel } from "./trend-pill.component";
import { SectionCard } from "./dashboard/section-card.component";
import { SectionHeader } from "./dashboard/section-header.component";
import { DataSourceNote } from "./dashboard/data-source-note.component";
import { ChartLegend } from "./charts/chart-legend.component";
import { ChartTooltip } from "./charts/chart-tooltip.component";
import { GroupedBarChart, type GroupedBarCategory } from "./charts/grouped-bar-chart.component";
import { LineChart, type LineChartSeries } from "./charts/line-chart.component";
import { BarList, type BarListRow } from "./charts/bar-list.component";
import { createScale, buildPolylinePoints, buildDots, buildGridRows } from "@/lib/chart-scale";
import { formatCount, formatLastIngestion } from "@/lib/format";

interface AcademicDashboardProps {
  stats: AcademicStats;
}

// Escala de 3 tonos para los 3 cuatrimestres comparados (t-2/t-1/t): del prototipo.
const SUBJECT_BAR_COLORS = ["#D7E1F0", "#6D94C7", "#2D5DA1"];
// Dominio fijo del eje Y de "Tendencia por facultad" (no el rango real de los datos): así lo
// calcula el prototipo, con grilla en [90,80,70,60,50]%.
const FACULTY_DOMAIN_MIN = 50;
const FACULTY_DOMAIN_MAX = 92;
const FACULTY_GRID_VALUES = [90, 80, 70, 60, 50];

function teacherBarColor(rate: number): string {
  if (rate >= 85) return "#127453";
  if (rate >= 70) return "#2D5DA1";
  return "#A51C30";
}

export function AcademicDashboard({ stats }: AcademicDashboardProps) {
  const facultyScale = createScale({
    pointCount: 6,
    domainMin: FACULTY_DOMAIN_MIN,
    domainMax: FACULTY_DOMAIN_MAX,
    marginLeft: 44,
    plotWidth: 584,
    marginTop: 16,
    plotHeight: 160,
  });
  const facultyGrid = buildGridRows(
    FACULTY_GRID_VALUES,
    { domainMin: FACULTY_DOMAIN_MIN, domainMax: FACULTY_DOMAIN_MAX, marginTop: 16, plotHeight: 160 },
    (value) => `${value}%`,
  );
  const facultyLineSeries: LineChartSeries[] = stats.facultyTrends.map((faculty) => {
    const rates = faculty.points.map((point) => point.approvalRate);
    return {
      name: faculty.facultyName,
      color: faculty.color,
      points: buildPolylinePoints(rates, facultyScale),
      dots: buildDots(rates, facultyScale),
      lastValueLabel: `${faculty.latestApprovalRate}%`,
      delta: faculty.delta,
    };
  });
  const facultyCategories = stats.facultyTrends[0]?.points.map((point) => point.quarter) ?? [];

  const subjectCategories: GroupedBarCategory[] = stats.subjectApprovalRates.map((subject) => ({
    key: subject.code,
    barHeights: subject.series.map((point) => `${point.approvalRate}%`),
    // Ancla en el período más reciente (t), el último de los 3.
    tooltipAnchorHeight: `${subject.series[2].approvalRate}%`,
    tooltip: (
      <ChartTooltip
        title={subject.name}
        rows={subject.series.map((point, index) => ({
          color: SUBJECT_BAR_COLORS[index],
          label: point.quarter,
          value: `${point.approvalRate}%`,
        }))}
      />
    ),
    footer: (
      <>
        <span className="text-[10.5px] font-semibold text-[#41506B]">{subject.code}</span>
        <span className="text-[10.5px] leading-[1.3] text-[#647188]" style={{ textWrap: "pretty" }}>
          {subject.name}
        </span>
        <DeltaLabel label={subject.delta.formatted} tone={subject.delta.tone} className="text-[10.5px] font-medium" />
      </>
    ),
  }));

  const teacherRows: BarListRow[] = stats.teacherApprovalRates.map((teacher) => ({
    key: `${teacher.teacherName}-${teacher.subjectName}`,
    primaryLabel: teacher.teacherName,
    secondaryLabel: teacher.subjectName,
    bar: { color: teacherBarColor(teacher.approvalRate), widthPercent: teacher.approvalRate },
    valueLabel: `${teacher.approvalRate}%`,
    deltaLabel: teacher.delta.formatted,
    deltaTone: teacher.delta.tone,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.kpis.map((kpi) => (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.formattedValue}
            unit={kpi.unit || undefined}
            delta={kpi.delta}
            comparisonLabel={`vs. ${stats.previousQuarter}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.32fr_1fr]">
        <SectionCard className="px-5 pt-[18px] pb-3.5">
          <SectionHeader
            title="Tasa de aprobación por materia"
            description="Comparación con los dos cuatrimestres anteriores · orden ascendente"
            right={
              <ChartLegend
                items={stats.comparedQuarters.map((quarter, index) => ({
                  key: quarter,
                  color: SUBJECT_BAR_COLORS[index],
                  label: quarter,
                }))}
              />
            }
          />
          <GroupedBarChart seriesColors={SUBJECT_BAR_COLORS} categories={subjectCategories} minColumnPx={72} />
        </SectionCard>

        <SectionCard className="px-5 pt-[18px] pb-3.5">
          <SectionHeader
            title="Tendencia por facultad"
            description="Tasa de aprobación, últimos 6 cuatrimestres"
            marginBottom="14px"
          />
          <LineChart grid={facultyGrid} series={facultyLineSeries} categories={facultyCategories} />
        </SectionCard>
      </div>

      <SectionCard className="px-5 pt-[18px] pb-5">
        <SectionHeader
          title="Tasa de aprobación por docente"
          description={`Docentes con al menos una comisión cerrada en ${stats.quarter}`}
          right={
            <span className="pt-1 text-[11px] text-[#6E7A90]">
              {formatCount(stats.totalTeachersCount)} docentes · muestra de {stats.teacherApprovalRates.length}
            </span>
          }
        />
        <BarList rows={teacherRows} wrapColumns={2} />
      </SectionCard>

      <DataSourceNote>
        Datos de ejemplo · agregados desde eventos de Académica, Docencia y Evaluaciones · última ingesta{" "}
        {formatLastIngestion(stats.lastIngestionAt)}
      </DataSourceNote>
    </div>
  );
}
