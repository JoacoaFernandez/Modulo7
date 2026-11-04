// Pisa con métricas reales (inbox_events) las del tablero financiero que se derivan de eventos.
import { PrismaClient } from "@prisma/client";
import { createDelta } from "../../../domain/entities/delta.value-object";
import {
  AdministrativeExpense,
  DiningRevenue,
  FinancialStats,
  MonthlyBalancePoint,
  TopSellingProduct,
} from "../../../domain/entities/financial-stats.entity";
import { KpiCard } from "../../../domain/entities/kpi.value-object";
import {
  queryAdministrativeExpenses,
  queryDiningRevenue,
  queryMonthlyFlows,
  queryTopProducts,
} from "../queries/financial.queries";
import { MonthRange, parseMonthId } from "../queries/query-helpers";
import { capitalize, count, growth, money, replaceKpi, round1, toMillions } from "./overlay-format";

const OTHER_EXPENSES = "Otros gastos operativos";

// Categoría del tablero para un sueldo o un gasto registrado (la categoría del gasto es texto libre).
function expenseCategoryName(rawCategory: string): string {
  if (rawCategory === "sueldos-docentes") return "Salarios docentes";
  if (rawCategory === "sueldos-administrativos") return "Salarios administrativos";
  // Sueldos liquidados sin desglose: no se sabe a qué categoría pertenecen.
  if (rawCategory === "sueldos-sin-desglose") return OTHER_EXPENSES;

  const text = (rawCategory ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (text.includes("docente")) return "Salarios docentes";
  if (text.includes("administrativ")) return "Salarios administrativos";
  if (/manten|obra/.test(text)) return "Mantenimiento y obras";
  if (/servicio|infra/.test(text)) return "Servicios e infraestructura";
  if (/licencia|sistema|software/.test(text)) return "Licencias y sistemas";
  if (/beca|bonific/.test(text)) return "Becas y bonificaciones";

  return OTHER_EXPENSES;
}

export async function overlayFinancialStats(
  prisma: PrismaClient,
  base: FinancialStats,
  sedeId: string | null,
  siteIdByName: Map<string, string>,
): Promise<FinancialStats> {
  const selected = parseMonthId(base.month);
  const previous = parseMonthId(base.previousMonth);
  const seriesMonths = base.monthlyBalance.map((point) => parseMonthId(point.month));
  if (!selected || !previous || seriesMonths.some((month) => month === null)) return base;
  const months = seriesMonths as MonthRange[];

  const [flows, expenseRows, productRows, diningRows] = await Promise.all([
    queryMonthlyFlows(prisma, months[0].start, months[months.length - 1].end, sedeId),
    queryAdministrativeExpenses(prisma, selected, sedeId),
    queryTopProducts(prisma, selected, sedeId),
    queryDiningRevenue(prisma, previous.start, selected.end),
  ]);

  let { kpis, monthlyBalance, administrativeExpenses, topSellingProducts, diningRevenues } = base;

  // Balance mensual: ingresos y egresos reales (en millones). El saldo acumulado encadena el
  // resultado real sobre el saldo del mes anterior desde el primer mes con movimientos.
  const flowByMonth = new Map(flows.map((flow) => [flow.ym, flow]));
  if (flows.length > 0) {
    let hasChained = false;
    let previousBalance = 0;
    monthlyBalance = base.monthlyBalance.map((point, index): MonthlyBalancePoint => {
      const flow = flowByMonth.get(months[index].ym);
      const income = flow ? toMillions(flow.income) : point.income;
      const expense = flow ? toMillions(flow.expense) : point.expense;
      const result = income - expense;
      hasChained ||= flow !== undefined;

      const opening = index === 0 ? point.balance - (point.income - point.expense) : previousBalance;
      const balance = hasChained ? opening + result : point.balance;
      previousBalance = balance;

      return {
        ...point,
        income,
        expense,
        result,
        balance,
        formattedIncome: money(income),
        formattedExpense: money(expense),
        formattedResult: money(result),
        formattedBalance: money(balance),
      };
    });

    kpis = recalculateFinancialKpis(kpis, monthlyBalance, base.month, base.previousMonth);
  }

  // Gastos administrativos del mes: sueldos liquidados + gastos registrados, repartidos en las categorías del tablero.
  const amounts = new Map<string, number>();
  for (const row of expenseRows) {
    const name = expenseCategoryName(row.category);
    amounts.set(name, (amounts.get(name) ?? 0) + row.total);
  }
  const totalExpenses = [...amounts.values()].reduce((total, amount) => total + amount, 0);
  if (totalExpenses > 0) {
    administrativeExpenses = base.administrativeExpenses.map((expense): AdministrativeExpense => {
      const amount = toMillions(amounts.get(expense.category) ?? 0);
      return {
        ...expense,
        percentage: round1(((amounts.get(expense.category) ?? 0) * 100) / totalExpenses),
        amount,
        formattedAmount: money(amount),
      };
    });
  }

  // Productos más vendidos del mes, netos de devoluciones.
  if (productRows.length > 0) {
    topSellingProducts = productRows.slice(0, Math.max(base.topSellingProducts.length, 1)).map(
      (row): TopSellingProduct => ({
        productName: row.producto,
        category: row.categoria ? capitalize(row.categoria) : "Sin categoría",
        unitsSold: Math.round(row.unidades),
        revenue: toMillions(row.monto),
        formattedRevenue: money(toMillions(row.monto)),
      }),
    );
  }

  // Comedores: se pisa la fila de cada sede con reservas confirmadas en el mes; el resto queda como el mock.
  diningRevenues = base.diningRevenues.map((dining): DiningRevenue => {
    const sedeOfRow = siteIdByName.get(dining.siteName);
    const forMonth = (ym: string) => diningRows.find((row) => row.sedeId === sedeOfRow && row.ym === ym);
    const current = forMonth(selected.ym);
    if (!current || current.tickets === 0) return dining;

    const previousRow = previous.ym === selected.ym ? undefined : forMonth(previous.ym);
    const revenue = toMillions(current.revenue);
    const averageTicket = current.revenue / current.tickets;

    return {
      ...dining,
      revenue,
      formattedRevenue: money(revenue),
      ticketsCount: current.tickets,
      averageTicket,
      formattedAverageTicket: `$ ${count(Math.round(averageTicket))}`,
      delta: previousRow ? createDelta(growth(current.revenue, previousRow.revenue), { suffix: "%" }) : dining.delta,
      hasService: true,
      note: "",
    };
  });

  return { ...base, kpis, monthlyBalance, administrativeExpenses, topSellingProducts, diningRevenues };
}

// Mismas fórmulas que el calculator, pero sobre la serie ya pisada.
function recalculateFinancialKpis(
  kpis: KpiCard[],
  series: MonthlyBalancePoint[],
  month: string,
  previousMonth: string,
): KpiCard[] {
  const current = series.find((point) => point.month === month);
  const previous = series.find((point) => point.month === previousMonth);
  if (!current || !previous) return kpis;

  const margin = current.income === 0 ? 0 : (current.result / current.income) * 100;
  const previousMargin = previous.income === 0 ? 0 : (previous.result / previous.income) * 100;

  let result = replaceKpi(kpis, "accumulated-balance", {
    value: current.balance,
    formattedValue: money(current.balance),
    delta: createDelta(growth(current.balance, previous.balance), { suffix: "%" }),
  });
  result = replaceKpi(result, "period-income", {
    value: current.income,
    formattedValue: money(current.income),
    delta: createDelta(growth(current.income, previous.income), { suffix: "%" }),
  });
  result = replaceKpi(result, "period-expenses", {
    value: current.expense,
    formattedValue: money(current.expense),
    delta: createDelta(growth(current.expense, previous.expense), { suffix: "%", inverted: true }),
  });

  return replaceKpi(result, "operating-result", {
    value: margin,
    formattedValue: `${margin.toFixed(1)}%`,
    delta: createDelta(margin - previousMargin, { suffix: "%" }),
  });
}
