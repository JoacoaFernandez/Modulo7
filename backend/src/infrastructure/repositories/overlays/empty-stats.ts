// Bases vacías para los períodos que el mock no conoce: KPIs en cero y listas sin filas, con las series sobre los períodos pedidos.
// El mock solo aporta la estructura (ids, etiquetas, colores, sedes); ningún número suyo llega a un período nuevo.
import { AcademicStats } from "../../../domain/entities/academic-stats.entity";
import { createDelta } from "../../../domain/entities/delta.value-object";
import { EventMonthlyPoint, EventStats } from "../../../domain/entities/event-stats.entity";
import { FinancialStats, MonthlyBalancePoint } from "../../../domain/entities/financial-stats.entity";
import { KpiCard } from "../../../domain/entities/kpi.value-object";
import { Period } from "../../../domain/entities/period.entity";
import { recalculateFinancialKpis } from "./financial.overlay";
import { money } from "./overlay-format";

// "Nov 2026" → "Nov", como el eje X del mock.
const shortMonth = (month: Period) => month.id.slice(0, 3);

export function zeroBalancePoint(month: Period, isSelected: boolean): MonthlyBalancePoint {
  return {
    month: month.id,
    shortMonth: shortMonth(month),
    income: 0,
    expense: 0,
    result: 0,
    balance: 0,
    formattedIncome: money(0),
    formattedExpense: money(0),
    formattedResult: money(0),
    formattedBalance: money(0),
    isSelected,
  };
}

export function zeroEventPoint(month: Period): EventMonthlyPoint {
  return { month: month.id, shortMonth: shortMonth(month), eventsCount: 0, attendeesCount: 0, attendanceRate: 0 };
}

function zeroAcademicKpi(kpi: KpiCard): KpiCard {
  if (kpi.id === "overall-approval-rate") {
    return { ...kpi, value: 0, formattedValue: "0.0%", delta: createDelta(0, { suffix: " pp" }) };
  }
  const suffix = kpi.id === "active-students" ? "%" : "";
  return { ...kpi, value: 0, formattedValue: "0", delta: createDelta(0, { suffix, integer: suffix === "" }) };
}

export function emptyAcademicStats(
  template: AcademicStats,
  period: { quarter: string; previousQuarter: string; comparedQuarters: string[] },
): AcademicStats {
  return {
    ...template,
    ...period,
    kpis: template.kpis.map(zeroAcademicKpi),
    subjectApprovalRates: [],
    facultyTrends: [],
    teacherApprovalRates: [],
    totalTeachersCount: 0,
  };
}

export function emptyFinancialStats(
  template: FinancialStats,
  period: { month: string; previousMonth: string },
  series: MonthlyBalancePoint[],
): FinancialStats {
  return {
    ...template,
    ...period,
    kpis: recalculateFinancialKpis(template.kpis, series, period.month, period.previousMonth),
    monthlyBalance: series,
    // Las categorías y las sedes son estructura del tablero: se conservan con valores en cero.
    administrativeExpenses: template.administrativeExpenses.map((expense) => ({
      ...expense,
      percentage: 0,
      amount: 0,
      formattedAmount: money(0),
    })),
    topSellingProducts: [],
    diningRevenues: template.diningRevenues.map((dining) => ({
      ...dining,
      revenue: 0,
      formattedRevenue: dining.hasService ? money(0) : "—",
      ticketsCount: 0,
      averageTicket: 0,
      formattedAverageTicket: dining.hasService ? "$ 0" : "—",
      delta: createDelta(0, { suffix: "%" }),
    })),
  };
}

export function emptyEventStats(template: EventStats, month: string, series: EventMonthlyPoint[]): EventStats {
  const none = { eventType: "—", attendanceRate: 0 };

  return {
    ...template,
    month,
    totalEvents: 0,
    totalAttendees: 0,
    totalRegistered: 0,
    averageAttendanceRate: 0,
    capacityOccupancy: 0,
    bestAttendance: none,
    worstAttendance: none,
    monthlySeries: series,
    eventTypes: [],
  };
}
