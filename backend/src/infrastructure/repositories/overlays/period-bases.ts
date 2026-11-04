// Base de cada tablero sobre el catálogo dinámico de períodos: el mock para los períodos que conoce,
// una base vacía para los nuevos, y las series (cuatrimestres / meses) armadas sobre el catálogo completo.
import { AcademicStats } from "../../../domain/entities/academic-stats.entity";
import { createDelta } from "../../../domain/entities/delta.value-object";
import { EventStats } from "../../../domain/entities/event-stats.entity";
import { AcademicFilters, FinancialFilters } from "../../../domain/entities/filters.entity";
import { FinancialStats } from "../../../domain/entities/financial-stats.entity";
import { Period } from "../../../domain/entities/period.entity";
import { AnalyticsRepositoryMock } from "../analytics.repository.mock";
import { emptyAcademicStats, emptyEventStats, emptyFinancialStats, zeroBalancePoint, zeroEventPoint } from "./empty-stats";
import { recalculateFinancialKpis } from "./financial.overlay";
import { replaceKpi } from "./overlay-format";

// Tasa de aprobación por cuatrimestre y código de materia, según el mock (solo cuatrimestres del mock).
export type MockApprovalHistory = Map<string, Map<string, number>>;

export interface AcademicBase {
  stats: AcademicStats;
  // Se llena solo cuando entre los cuatrimestres comparados hay alguno nuevo; si no, el tablero es el del mock tal cual.
  history: MockApprovalHistory;
  // Cuatrimestres que conoce el mock: los demás no tienen historial propio.
  mockQuarters: Set<string>;
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

function indexOfPeriod(periods: Period[], id: string, label: string): number {
  const index = periods.findIndex((period) => period.id === id);
  if (index < 0) throw new Error(`Valor desconocido para ${label}: ${id}`);

  return index;
}

export async function buildAcademicBase(
  mock: AnalyticsRepositoryMock,
  filters: AcademicFilters,
  quarters: Period[],
): Promise<AcademicBase> {
  const mockQuarters = new Set((await mock.getQuarters()).map((quarter) => quarter.id));
  const current = indexOfPeriod(quarters, filters.quarter, "cuatrimestre");
  const compared = [Math.max(0, current - 2), Math.max(0, current - 1), current].map((index) => quarters[index].id);
  const isNew = !mockQuarters.has(filters.quarter);

  // Para un período nuevo el mock solo presta la estructura (se pide con su cuatrimestre por defecto).
  const templateQuarter = isNew ? (await mock.getFilterDefaults()).quarter : filters.quarter;
  const template = await mock.getAcademicStats({ siteName: filters.siteName, quarter: templateQuarter });
  const none = { stats: template, history: new Map(), mockQuarters };

  if (!isNew && sameList(template.comparedQuarters, compared)) return none;

  const history: MockApprovalHistory = new Map();
  for (const quarter of new Set(compared)) {
    if (!mockQuarters.has(quarter)) continue;
    const stats = await mock.getAcademicStats({ siteName: filters.siteName, quarter });
    history.set(quarter, new Map(stats.subjectApprovalRates.map((subject) => [subject.code, subject.approvalRate])));
  }

  const period = { quarter: filters.quarter, previousQuarter: compared[1], comparedQuarters: compared };
  if (isNew) return { stats: emptyAcademicStats(template, period), history, mockQuarters };

  // Cuatrimestre del mock cuyos vecinos cambiaron (hay uno nuevo en el medio): se rearman series y deltas.
  const rateOf = (code: string, quarter: string) => history.get(quarter)?.get(code) ?? 0;
  const subjectApprovalRates = template.subjectApprovalRates.map((subject) => {
    const series = compared.map((quarter) => ({ quarter, approvalRate: rateOf(subject.code, quarter) }));
    return { ...subject, series, delta: createDelta(subject.approvalRate - series[1].approvalRate, { suffix: " pp" }) };
  });
  const previousAverage =
    template.subjectApprovalRates.reduce((total, subject) => total + rateOf(subject.code, compared[1]), 0) /
    template.subjectApprovalRates.length;
  const overall = template.kpis.find((kpi) => kpi.id === "overall-approval-rate");

  // Los cuatrimestres nuevos no tienen punto en la tendencia por facultad (no hay dato que mostrar).
  const facultyTrends = template.facultyTrends.map((faculty) => {
    const points = faculty.points.filter((point) => quarters.some((quarter) => quarter.id === point.quarter));
    const previousPoint = points.find((point) => point.quarter === compared[1]);
    return {
      ...faculty,
      points,
      delta: createDelta(faculty.latestApprovalRate - (previousPoint?.approvalRate ?? 0), { suffix: " pp" }),
    };
  });

  return {
    stats: {
      ...template,
      ...period,
      kpis: overall
        ? replaceKpi(template.kpis, "overall-approval-rate", {
            delta: createDelta(overall.value - previousAverage, { suffix: " pp" }),
          })
        : template.kpis,
      subjectApprovalRates,
      facultyTrends,
    },
    history,
    mockQuarters,
  };
}

export async function buildFinancialBase(
  mock: AnalyticsRepositoryMock,
  filters: FinancialFilters,
  months: Period[],
): Promise<FinancialStats> {
  const mockMonths = new Set((await mock.getMonths()).map((month) => month.id));
  const current = indexOfPeriod(months, filters.month, "periodo");
  const previous = months[Math.max(0, current - 1)].id;
  const isNew = !mockMonths.has(filters.month);

  const templateMonth = isNew ? (await mock.getFilterDefaults()).month : filters.month;
  const template = await mock.getFinancialStats({ siteName: filters.siteName, month: templateMonth });
  const monthIds = months.map((month) => month.id);
  if (!isNew && sameList(template.monthlyBalance.map((point) => point.month), monthIds) && template.previousMonth === previous) {
    return template;
  }

  // Meses del mock con su punto del mock; meses nuevos en cero.
  const mockPoints = new Map(template.monthlyBalance.map((point) => [point.month, point]));
  const series = months.map((month, index) => ({
    ...(mockPoints.get(month.id) ?? zeroBalancePoint(month, false)),
    isSelected: index === current,
  }));

  const period = { month: filters.month, previousMonth: previous };
  if (isNew) return emptyFinancialStats(template, period, series);

  return {
    ...template,
    ...period,
    monthlyBalance: series,
    kpis: recalculateFinancialKpis(template.kpis, series, period.month, period.previousMonth),
  };
}

export async function buildEventsBase(
  mock: AnalyticsRepositoryMock,
  filters: FinancialFilters,
  months: Period[],
): Promise<EventStats> {
  const mockMonths = new Set((await mock.getMonths()).map((month) => month.id));
  indexOfPeriod(months, filters.month, "periodo");
  const isNew = !mockMonths.has(filters.month);

  const templateMonth = isNew ? (await mock.getFilterDefaults()).month : filters.month;
  const template = await mock.getEventsStats({ siteName: filters.siteName, month: templateMonth });
  const monthIds = months.map((month) => month.id);
  if (!isNew && sameList(template.monthlySeries.map((point) => point.month), monthIds)) return template;

  const mockPoints = new Map(template.monthlySeries.map((point) => [point.month, point]));
  const series = months.map((month) => mockPoints.get(month.id) ?? zeroEventPoint(month));

  return isNew ? emptyEventStats(template, filters.month, series) : { ...template, monthlySeries: series };
}
