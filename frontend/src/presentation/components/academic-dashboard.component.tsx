// Presentation components: tablero académico. Porta 1:1 la pantalla "Rendimiento académico"
// del prototipo (Analitica Institucional.dc.html) contra las primitivas del Paso 6.
import type { AcademicStats } from "@/domain/entities/analytics.entity";
import { StatCard } from "./stat-card.component";
import { DeltaLabel } from "./trend-pill.component";
import { SectionCard } from "./dashboard/section-card.component";
import { SectionHeader } from "./dashboard/section-header.component";
import { EmptyState } from "./dashboard/empty-state.component";
import { DataWarnings } from "./dashboard/data-warnings.component";
import { DataSourceNote } from "./dashboard/data-source-note.component";
import { ChartLegend } from "./charts/chart-legend.component";
import { ChartTooltip } from "./charts/chart-tooltip.component";
import { GroupedBarChart, type GroupedBarCategory } from "./charts/grouped-bar-chart.component";
import { LineChart, type LineChartSeries } from "./charts/line-chart.component";
import { BarList, type BarListRow } from "./charts/bar-list.component";
import { createScale, buildPolylinePoints, buildGridRows } from "@/lib/chart-scale";
import { formatCount, formatLastIngestion } from "@/lib/format";

interface AcademicDashboardProps {
  stats: AcademicStats;
}

// Escala de 3 tonos para los 3 cuatrimestres comparados (t-2/t-1/t): del prototipo.
const SUBJECT_BAR_COLORS = ["#D7E1F0", "#6D94C7", "#2D5DA1"];
// Eje Y de "Tendencia por facultad": por defecto 50–90% (como el prototipo), pero se amplía en
// pasos de 10 si los datos reales caen fuera de ese rango.
const FACULTY_DEFAULT_MIN = 50;
const FACULTY_DEFAULT_MAX = 90;

function teacherBarColor(rate: number): string {
  if (rate >= 85) return "#127453";
  if (rate >= 70) return "#2D5DA1";
  return "#A51C30";
}

export function AcademicDashboard({ stats }: AcademicDashboardProps) {
  // La serie trae 0 en los cuatrimestres donde la facultad no tuvo resultados: es "sin dato",
  // no una tasa real, así que se corta la línea en vez de bajarla a 0.
  const hasFacultyData = stats.facultyTrends.some((faculty) => faculty.points.some((point) => point.approvalRate > 0));
  const pointCount = Math.max(0, ...stats.facultyTrends.map((faculty) => faculty.points.length));
  const facultyRates = stats.facultyTrends.flatMap((faculty) =>
    faculty.points.map((point) => point.approvalRate).filter((rate) => rate > 0),
  );
  const facultyMin = Math.min(FACULTY_DEFAULT_MIN, Math.floor(Math.min(...facultyRates) / 10) * 10);
  const facultyMax = Math.max(FACULTY_DEFAULT_MAX, Math.ceil(Math.max(...facultyRates) / 10) * 10);
  const facultyDomainMin = Number.isFinite(facultyMin) ? facultyMin : FACULTY_DEFAULT_MIN;
  const facultyDomainMax = Number.isFinite(facultyMax) ? facultyMax : FACULTY_DEFAULT_MAX;
  const facultyGridStep = facultyDomainMax - facultyDomainMin > 60 ? 20 : 10;
  const facultyGridValues: number[] = [];
  for (let value = facultyDomainMax; value >= facultyDomainMin; value -= facultyGridStep) facultyGridValues.push(value);

  const facultyScale = createScale({
    pointCount,
    domainMin: facultyDomainMin,
    domainMax: facultyDomainMax,
    marginLeft: 44,
    plotWidth: 584,
    marginTop: 16,
    plotHeight: 160,
  });
  const facultyGrid = buildGridRows(
    facultyGridValues,
    { domainMin: facultyDomainMin, domainMax: facultyDomainMax, marginTop: 16, plotHeight: 160 },
    (value) => `${value}%`,
  );
  const facultyLineSeries: LineChartSeries[] = stats.facultyTrends.map((faculty) => {
    const segments: string[] = [];
    const dots: LineChartSeries["dots"] = [];
    let run: { index: number; rate: number }[] = [];
    const flush = () => {
      if (run.length > 1) {
        segments.push(
          buildPolylinePoints(
            run.map((p) => p.rate),
            { x: (i) => facultyScale.x(run[i].index), y: facultyScale.y },
          ),
        );
      }
      run = [];
    };
    faculty.points.forEach((point, index) => {
      if (point.approvalRate > 0) {
        run.push({ index, rate: point.approvalRate });
        dots.push({ x: facultyScale.x(index).toFixed(1), y: facultyScale.y(point.approvalRate).toFixed(1) });
      } else {
        flush();
      }
    });
    flush();
    return {
      name: faculty.facultyName,
      color: faculty.color,
      segments,
      dots,
      lastValueLabel: faculty.latestApprovalRate > 0 ? `${faculty.latestApprovalRate}%` : "—",
      delta: faculty.delta,
    };
  });
  const facultyCategories =
    stats.facultyTrends.reduce<string[]>(
      (longest, faculty) => (faculty.points.length > longest.length ? faculty.points.map((point) => point.quarter) : longest),
      [],
    );

  const subjectCategories: GroupedBarCategory[] = stats.subjectApprovalRates.map((subject) => ({
    key: subject.code,
    barHeights: subject.series.map((point) => `${point.approvalRate}%`),
    // Ancla en el período más reciente (t), el último de la serie.
    tooltipAnchorHeight: `${subject.series[subject.series.length - 1]?.approvalRate ?? 0}%`,
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
      <DataWarnings warnings={stats.warnings} />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.kpis.map((kpi) => (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.formattedValue}
            unit={kpi.unit || undefined}
            delta={kpi.delta}
            note={kpi.note}
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
                  // El backend puede repetir un cuatrimestre si el catálogo tiene menos de 3.
                  key: `${quarter}-${index}`,
                  color: SUBJECT_BAR_COLORS[index],
                  label: quarter,
                }))}
              />
            }
          />
          {subjectCategories.length > 0 ? (
            <GroupedBarChart seriesColors={SUBJECT_BAR_COLORS} categories={subjectCategories} minColumnPx={72} />
          ) : (
            <EmptyState message="Todavía no hay materias con resultados para este cuatrimestre y sede" />
          )}
        </SectionCard>

        <SectionCard className="px-5 pt-[18px] pb-3.5">
          <SectionHeader
            title="Tendencia por facultad"
            description="Tasa de aprobación, hasta los últimos 6 cuatrimestres"
            marginBottom="14px"
          />
          {hasFacultyData ? (
            <LineChart grid={facultyGrid} series={facultyLineSeries} categories={facultyCategories} />
          ) : (
            <EmptyState message="Todavía no hay resultados por facultad para mostrar la tendencia" />
          )}
        </SectionCard>
      </div>

      <SectionCard className="px-5 pt-[18px] pb-5">
        <SectionHeader
          title="Tasa de aprobación por docente"
          description={`Docentes con al menos una comisión cerrada en ${stats.quarter}`}
          right={
            <span className="pt-1 text-[11px] text-[#6E7A90]">
              {formatCount(stats.totalTeachersCount)} {stats.totalTeachersCount === 1 ? "docente" : "docentes"}
              {stats.teacherApprovalRates.length > 0 && ` · muestra de ${stats.teacherApprovalRates.length}`}
            </span>
          }
        />
        {teacherRows.length > 0 ? (
          <BarList rows={teacherRows} wrapColumns={2} />
        ) : (
          <EmptyState message="Todavía no hay docentes con comisiones cerradas para este cuatrimestre y sede" />
        )}
      </SectionCard>

      <DataSourceNote>
        Agregados desde eventos de Académica, Docencia y Evaluaciones · última ingesta{" "}
        {formatLastIngestion(stats.lastIngestionAt)}
      </DataSourceNote>
    </div>
  );
}
