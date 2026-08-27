// Domain services: business rules that span entities and don't belong to a single one.
// Port de renderVals() y finVals() del prototipo: escalado por sede, deltas y formato.
import {
  AcademicStats,
  FacultyTrendSeries,
  SubjectApprovalRate,
  TeacherApprovalRate,
} from "../entities/academic-stats.entity";
import { AnalyticsDataset } from "../entities/analytics-dataset.entity";
import { createDelta } from "../entities/delta.value-object";
import {
  AdministrativeExpense,
  DiningRevenue,
  FinancialStats,
  MonthlyBalancePoint,
  TopSellingProduct,
} from "../entities/financial-stats.entity";
import { EventStats, EventTypeStats } from "../entities/event-stats.entity";
import { AcademicFilters, FinancialFilters } from "../entities/filters.entity";
import { KpiCard } from "../entities/kpi.value-object";
import { Period } from "../entities/period.entity";
import { Site } from "../entities/site.entity";

// Ninguna tasa del prototipo baja de 35% ni supera 97%, aun después del ajuste por sede.
const MIN_APPROVAL_RATE = 35;
const MAX_APPROVAL_RATE = 97;

// El cupo ofrecido supera a los inscriptos en un 18%.
const CAPACITY_OVER_REGISTERED = 1.18;

export class AnalyticsCalculatorService {
  constructor(private readonly dataset: AnalyticsDataset) {}

  calculateAcademicStats(filters: AcademicFilters): AcademicStats {
    const site = this.resolveSite(filters.siteName);
    const quarters = this.dataset.quarters;
    const current = this.resolvePeriod(quarters, filters.quarter, "cuatrimestre").index;
    const previous = Math.max(0, current - 1);
    const earlier = Math.max(0, current - 2);

    // Tasa de una serie en un cuatrimestre, ya ajustada por la sede.
    const rateAt = (rates: number[], index: number) => clamp(rates[index] + site.rateAdjustment);

    const subjectApprovalRates: SubjectApprovalRate[] = this.dataset.subjects
      .map((subject) => {
        const rate = rateAt(subject.approvalRates, current);
        const previousRate = rateAt(subject.approvalRates, previous);

        return {
          code: subject.code,
          name: subject.name,
          approvalRate: rate,
          series: [
            { quarter: quarters[earlier].id, approvalRate: rateAt(subject.approvalRates, earlier) },
            { quarter: quarters[previous].id, approvalRate: previousRate },
            { quarter: quarters[current].id, approvalRate: rate },
          ],
          delta: createDelta(rate - previousRate, { suffix: " pp" }),
        };
      })
      .sort((a, b) => a.approvalRate - b.approvalRate);

    const overallRate = average(this.dataset.subjects.map((s) => rateAt(s.approvalRates, current)));
    const overallPreviousRate = average(
      this.dataset.subjects.map((s) => rateAt(s.approvalRates, previous)),
    );

    // La actividad crece a lo largo de la serie: el cuatrimestre más viejo muestra el 60%.
    const scale = 0.6 + 0.4 * (current / (quarters.length - 1));
    const subjectsCount = Math.round(site.subjectsCount * scale);
    const commissionsCount = Math.round(site.commissionsCount * scale);
    const studentsCount = Math.round(site.studentsCount * scale);

    const kpis: KpiCard[] = [
      {
        id: "active-subjects",
        label: "Materias en curso",
        value: subjectsCount,
        formattedValue: count(subjectsCount),
        unit: "materias",
        delta: createDelta(Math.round(site.subjectsCount * 0.04), { integer: true }),
      },
      {
        id: "overall-approval-rate",
        label: "Tasa de aprobación general",
        value: overallRate,
        formattedValue: `${overallRate.toFixed(1)}%`,
        unit: "",
        delta: createDelta(overallRate - overallPreviousRate, { suffix: " pp" }),
      },
      {
        id: "active-commissions",
        label: "Comisiones activas",
        value: commissionsCount,
        formattedValue: count(commissionsCount),
        unit: "comisiones",
        delta: createDelta(Math.round(site.commissionsCount * 0.02), { integer: true }),
      },
      {
        id: "active-students",
        label: "Estudiantes con cursada activa",
        value: studentsCount,
        formattedValue: count(studentsCount),
        unit: "",
        delta: createDelta(1.8, { suffix: "%" }),
      },
    ];

    const facultyTrends: FacultyTrendSeries[] = this.dataset.faculties.map((faculty) => ({
      facultyName: faculty.name,
      color: faculty.color,
      points: faculty.approvalRates.map((rate, index) => ({
        quarter: quarters[index].id,
        approvalRate: clamp(rate + site.rateAdjustment),
      })),
      latestApprovalRate: rateAt(faculty.approvalRates, current),
      delta: createDelta(faculty.approvalRates[current] - faculty.approvalRates[previous], {
        suffix: " pp",
      }),
    }));

    const teacherApprovalRates: TeacherApprovalRate[] = this.dataset.teachers
      .map((teacher) => ({
        teacherName: teacher.name,
        subjectName: teacher.subjectName,
        approvalRate: clamp(teacher.approvalRate + site.rateAdjustment),
        delta: createDelta(teacher.delta, { suffix: " pp" }),
      }))
      .sort((a, b) => b.approvalRate - a.approvalRate);

    return {
      siteName: site.name,
      quarter: quarters[current].id,
      previousQuarter: quarters[previous].id,
      comparedQuarters: [quarters[earlier].id, quarters[previous].id, quarters[current].id],
      kpis,
      subjectApprovalRates,
      facultyTrends,
      teacherApprovalRates,
      totalTeachersCount: site.teachersCount,
      sourceModules: this.dataset.academicSourceModules,
      lastIngestionAt: this.dataset.lastIngestionAt,
    };
  }

  calculateFinancialStats(filters: FinancialFilters): FinancialStats {
    const site = this.resolveSite(filters.siteName);
    const months = this.dataset.months;
    const current = this.resolvePeriod(months, filters.month, "periodo").index;
    const previous = Math.max(0, current - 1);
    const factor = this.siteFactor(site);

    const income = this.dataset.finance.income.map((value) => value * factor);
    const expenses = this.dataset.finance.expenses.map((value) => value * factor);
    const balance = this.dataset.finance.balance.map((value) => value * factor);

    const result = income[current] - expenses[current];
    const previousResult = income[previous] - expenses[previous];
    const margin = (result / income[current]) * 100;
    const previousMargin = (previousResult / income[previous]) * 100;

    const kpis: KpiCard[] = [
      {
        id: "accumulated-balance",
        label: "Saldo acumulado",
        value: balance[current],
        formattedValue: money(balance[current]),
        unit: "ARS",
        delta: createDelta(growth(balance[current], balance[previous]), { suffix: "%" }),
      },
      {
        id: "period-income",
        label: "Ingresos del período",
        value: income[current],
        formattedValue: money(income[current]),
        unit: "ARS",
        delta: createDelta(growth(income[current], income[previous]), { suffix: "%" }),
      },
      {
        id: "period-expenses",
        label: "Egresos del período",
        value: expenses[current],
        formattedValue: money(expenses[current]),
        unit: "ARS",
        // Que los egresos suban es malo: la semántica del chip va invertida.
        delta: createDelta(growth(expenses[current], expenses[previous]), {
          suffix: "%",
          inverted: true,
        }),
      },
      {
        id: "operating-result",
        label: "Resultado operativo",
        value: margin,
        formattedValue: `${margin.toFixed(1)}%`,
        unit: "",
        delta: createDelta(margin - previousMargin, { suffix: "%" }),
      },
    ];

    const monthlyBalance: MonthlyBalancePoint[] = months.map((month, index) => ({
      month: month.id,
      shortMonth: shortLabel(month),
      income: income[index],
      expense: expenses[index],
      result: income[index] - expenses[index],
      balance: balance[index],
      formattedIncome: money(income[index]),
      formattedExpense: money(expenses[index]),
      formattedResult: money(income[index] - expenses[index]),
      formattedBalance: money(balance[index]),
      isSelected: index === current,
    }));

    const administrativeExpenses: AdministrativeExpense[] = this.dataset.expenseCategories.map(
      (expense) => {
        const amount = (expenses[current] * expense.percentage) / 100;

        return {
          category: expense.category,
          percentage: expense.percentage,
          amount,
          formattedAmount: money(amount),
          color: expense.color,
        };
      },
    );

    const topSellingProducts: TopSellingProduct[] = this.dataset.products.map((product) => ({
      productName: product.name,
      category: product.category,
      unitsSold: Math.round(product.unitsSold * factor),
      revenue: product.revenue * factor,
      formattedRevenue: money(product.revenue * factor),
    }));

    // Los comedores no se escalan: cada sede factura lo suyo y el filtro solo resalta.
    const diningRevenues: DiningRevenue[] = this.dataset.dining.map((dining) => {
      const hasService = dining.revenue > 0;

      return {
        siteName: dining.siteName,
        revenue: dining.revenue,
        formattedRevenue: hasService ? money(dining.revenue) : "—",
        ticketsCount: dining.ticketsCount,
        averageTicket: dining.averageTicket,
        formattedAverageTicket: hasService ? `$ ${count(dining.averageTicket)}` : "—",
        delta: createDelta(dining.delta, { suffix: "%" }),
        hasService,
        note: dining.note ?? "",
        isSelected: site.isAggregate || site.name === dining.siteName,
      };
    });

    return {
      siteName: site.name,
      month: months[current].id,
      previousMonth: months[previous].id,
      kpis,
      monthlyBalance,
      administrativeExpenses,
      topSellingProducts,
      diningRevenues,
      sourceModules: this.dataset.financialSourceModules,
      lastIngestionAt: this.dataset.lastIngestionAt,
    };
  }

  calculateEventStats(filters: FinancialFilters): EventStats {
    const site = this.resolveSite(filters.siteName);
    const months = this.dataset.months;
    const current = this.resolvePeriod(months, filters.month, "periodo").index;
    const factor = this.siteFactor(site);

    const eventTypes: EventTypeStats[] = this.dataset.eventTypes.map((event) => ({
      eventType: event.eventType,
      // Un tipo de evento que existe no puede quedar en cero al escalar por sede.
      frequency: Math.max(1, Math.round(event.frequency * factor)),
      attendeesCount: event.attendeesCount,
      attendanceRate: event.attendanceRate,
    }));

    const totalEvents = this.dataset.eventTypes.reduce(
      (total, event) => total + Math.round(event.frequency * factor),
      0,
    );
    const totalAttendees = this.dataset.eventTypes.reduce(
      (total, event) => total + Math.round(event.frequency * factor) * event.attendeesCount,
      0,
    );
    // Promedio ponderado por frecuencia: los tipos más frecuentes pesan más.
    const averageAttendanceRate =
      this.dataset.eventTypes.reduce(
        (total, event) => total + event.attendanceRate * event.frequency,
        0,
      ) / this.dataset.eventTypes.reduce((total, event) => total + event.frequency, 0);
    const totalRegistered = Math.round(totalAttendees / (averageAttendanceRate / 100));

    const ranked = [...eventTypes].sort((a, b) => b.attendanceRate - a.attendanceRate);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];

    return {
      siteName: site.name,
      month: months[current].id,
      totalEvents,
      totalAttendees,
      totalRegistered,
      averageAttendanceRate,
      capacityOccupancy: (totalAttendees / (totalRegistered * CAPACITY_OVER_REGISTERED)) * 100,
      bestAttendance: { eventType: best.eventType, attendanceRate: best.attendanceRate },
      worstAttendance: { eventType: worst.eventType, attendanceRate: worst.attendanceRate },
      monthlySeries: this.dataset.eventMonths.map((month) => ({
        month: month.month,
        shortMonth: month.month.slice(0, 3),
        eventsCount: Math.round(month.eventsCount * factor),
        attendeesCount: Math.round(month.attendeesCount * factor),
        attendanceRate: month.attendanceRate,
      })),
      eventTypes,
      sourceModules: this.dataset.eventsSourceModules,
      lastIngestionAt: this.dataset.lastIngestionAt,
    };
  }

  // Proporción de la sede sobre el total: reescala montos, unidades y volúmenes.
  private siteFactor(site: Site): number {
    return site.studentsCount / this.dataset.baselineStudentsCount;
  }

  private resolveSite(siteName: string): Site {
    const site = this.dataset.sites.find((candidate) => candidate.name === siteName);
    if (!site) throw new Error(`Sede desconocida: ${siteName}`);

    return site;
  }

  private resolvePeriod(periods: Period[], id: string, label: string): Period {
    const period = periods.find((candidate) => candidate.id === id);
    if (!period) throw new Error(`Valor desconocido para ${label}: ${id}`);

    return period;
  }
}

function clamp(rate: number): number {
  return Math.max(MIN_APPROVAL_RATE, Math.min(MAX_APPROVAL_RATE, rate));
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

// Variación porcentual entre dos valores; 0 cuando no hay período anterior.
function growth(current: number, previous: number): number {
  return (current / previous - 1) * 100;
}

function money(amount: number): string {
  const formatted = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return `$ ${formatted} M`;
}

function count(value: number): string {
  return value.toLocaleString("es-AR");
}

function shortLabel(period: Period): string {
  return period.label.slice(0, 3);
}
