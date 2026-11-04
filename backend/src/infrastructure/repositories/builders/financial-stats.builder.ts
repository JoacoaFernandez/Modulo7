// Arma el tablero financiero desde los eventos de inbox_events; sin eventos, todo en cero.
import { PrismaClient } from "@prisma/client";
import { createDelta, createNeutralDelta } from "../../../domain/entities/delta.value-object";
import {
  AdministrativeExpense,
  DiningRevenue,
  FinancialStats,
  MonthlyBalancePoint,
  TopSellingProduct,
} from "../../../domain/entities/financial-stats.entity";
import { FinancialFilters } from "../../../domain/entities/filters.entity";
import { KpiCard } from "../../../domain/entities/kpi.value-object";
import { Period } from "../../../domain/entities/period.entity";
import { Site } from "../../../domain/entities/site.entity";
import { periodWindow } from "../../../domain/services/period-catalog.service";
import {
  EXPENSE_CATEGORIES,
  OTHER_EXPENSES_CATEGORY,
  SERIES_LENGTH,
  TOP_PRODUCTS_LIMIT,
} from "../../config/dashboard.config";
import {
  queryAdministrativeExpenses,
  queryDiningRevenue,
  queryDiningSites,
  queryMonthlyFlows,
  queryTopProducts,
} from "../queries/financial.queries";
import { MonthRange, parseMonthId } from "../queries/query-helpers";
import { capitalize, count, findSite, growth, indexOfPeriod, money, percentage, shortMonth, toMillions } from "./format";
import { SourceMeta } from "./source-meta.builder";

export interface FinancialContext {
  sites: Site[];
  months: Period[];
  meta: SourceMeta;
}

function monthRange(month: Period): MonthRange {
  const range = parseMonthId(month.id);
  if (!range) throw new Error(`Mes inválido en el catálogo: ${month.id}`);

  return range;
}

// Categoría del tablero para un sueldo o un gasto registrado (la categoría del gasto es texto libre).
function expenseCategoryName(rawCategory: string): string {
  if (rawCategory === "sueldos-docentes") return "Salarios docentes";
  if (rawCategory === "sueldos-administrativos") return "Salarios administrativos";
  // Sueldos liquidados sin desglose: no se sabe a qué categoría pertenecen.
  if (rawCategory === "sueldos-sin-desglose") return OTHER_EXPENSES_CATEGORY;

  const text = (rawCategory ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (text.includes("docente")) return "Salarios docentes";
  if (text.includes("administrativ")) return "Salarios administrativos";
  if (/manten|obra/.test(text)) return "Mantenimiento y obras";
  if (/servicio|infra/.test(text)) return "Servicios e infraestructura";
  if (/licencia|sistema|software/.test(text)) return "Licencias y sistemas";
  if (/beca|bonific/.test(text)) return "Becas y bonificaciones";

  return OTHER_EXPENSES_CATEGORY;
}

// Resultado operativo: margen sobre ingresos (0 sin ingresos).
const margin = (point: MonthlyBalancePoint) => (point.income === 0 ? 0 : (point.result / point.income) * 100);

// KPIs del mes elegido contra el anterior; sin mes anterior, los deltas quedan neutros.
function buildKpis(current: MonthlyBalancePoint, previous: MonthlyBalancePoint | undefined): KpiCard[] {
  const change = (now: number, before: number | undefined, inverted = false) =>
    before === undefined ? createNeutralDelta({ suffix: "%" }) : createDelta(growth(now, before), { suffix: "%", inverted });
  // El margen solo se compara si los dos meses tuvieron ingresos.
  const marginDelta =
    previous && current.income > 0 && previous.income > 0
      ? createDelta(margin(current) - margin(previous), { suffix: "%" })
      : createNeutralDelta({ suffix: "%" });

  return [
    {
      id: "accumulated-balance",
      label: "Saldo acumulado",
      value: current.balance,
      formattedValue: money(current.balance),
      unit: "ARS",
      delta: change(current.balance, previous?.balance),
    },
    {
      id: "period-income",
      label: "Ingresos del período",
      value: current.income,
      formattedValue: money(current.income),
      unit: "ARS",
      delta: change(current.income, previous?.income),
    },
    {
      id: "period-expenses",
      label: "Egresos del período",
      value: current.expense,
      formattedValue: money(current.expense),
      unit: "ARS",
      // Que los egresos suban es malo: la semántica del chip va invertida.
      delta: change(current.expense, previous?.expense, true),
    },
    {
      id: "operating-result",
      label: "Resultado operativo",
      value: margin(current),
      formattedValue: `${margin(current).toFixed(1)}%`,
      unit: "",
      delta: marginDelta,
    },
  ];
}

export async function buildFinancialStats(
  prisma: PrismaClient,
  filters: FinancialFilters,
  context: FinancialContext,
): Promise<FinancialStats> {
  const site = findSite(context.sites, filters.siteId);
  const sedeId = site.isAggregate ? null : site.id;
  const { months } = context;

  const current = indexOfPeriod(months, filters.month, "periodo");
  const previous = Math.max(0, current - 1);
  const selected = monthRange(months[current]);
  const previousRange = monthRange(months[previous]);
  const window = periodWindow(months, current, SERIES_LENGTH);

  // Los flujos se piden desde el primer mes del catálogo: el saldo acumulado arrastra todo lo anterior.
  const [flows, expenseRows, productRows, diningRows, diningSites] = await Promise.all([
    queryMonthlyFlows(prisma, monthRange(months[0]).start, selected.end, sedeId),
    queryAdministrativeExpenses(prisma, selected, sedeId),
    queryTopProducts(prisma, selected, sedeId),
    queryDiningRevenue(prisma, previousRange.start, selected.end),
    queryDiningSites(prisma),
  ]);

  // Balance mensual en millones: ingresos y egresos de saldo.movimiento y saldo acumulado desde el primer mes.
  const flowByMonth = new Map(flows.map((flow) => [flow.ym, flow]));
  const firstInWindow = months.indexOf(window[0]);
  const monthlyBalance: MonthlyBalancePoint[] = [];
  let accumulated = 0;
  for (let index = 0; index <= current; index += 1) {
    const flow = flowByMonth.get(monthRange(months[index]).ym);
    const income = toMillions(flow?.income ?? 0);
    const expense = toMillions(flow?.expense ?? 0);
    accumulated += income - expense;
    if (index < firstInWindow) continue;

    monthlyBalance.push({
      month: months[index].id,
      shortMonth: shortMonth(months[index]),
      income,
      expense,
      result: income - expense,
      balance: accumulated,
      formattedIncome: money(income),
      formattedExpense: money(expense),
      formattedResult: money(income - expense),
      formattedBalance: money(accumulated),
      isSelected: index === current,
    });
  }
  const kpis = buildKpis(
    monthlyBalance[monthlyBalance.length - 1],
    current > 0 ? monthlyBalance[monthlyBalance.length - 2] : undefined,
  );

  // Gastos administrativos del mes: sueldos liquidados + gastos registrados, repartidos en las categorías del tablero.
  const amounts = new Map<string, number>();
  for (const row of expenseRows) {
    const name = expenseCategoryName(row.category);
    amounts.set(name, (amounts.get(name) ?? 0) + row.total);
  }
  const totalExpenses = [...amounts.values()].reduce((total, amount) => total + amount, 0);
  const administrativeExpenses: AdministrativeExpense[] = EXPENSE_CATEGORIES.map(({ category, color }) => {
    const amount = amounts.get(category) ?? 0;

    return {
      category,
      percentage: totalExpenses > 0 ? percentage(amount, totalExpenses) : 0,
      amount: toMillions(amount),
      formattedAmount: money(toMillions(amount)),
      color,
    };
  });

  // Productos más vendidos del mes, netos de devoluciones.
  const topSellingProducts: TopSellingProduct[] = productRows.slice(0, TOP_PRODUCTS_LIMIT).map((row) => ({
    productName: row.producto,
    category: row.categoria ? capitalize(row.categoria) : "Sin categoría",
    unitsSold: Math.round(row.unidades),
    revenue: toMillions(row.monto),
    formattedRevenue: money(toMillions(row.monto)),
  }));

  // Comedores: una fila por sede definida. El filtro de sede solo resalta, no recorta. Una sede sin ninguna
  // reserva registrada se muestra sin servicio.
  const withService = new Set(diningSites);
  const diningRevenues: DiningRevenue[] = context.sites
    .filter((candidate) => !candidate.isAggregate)
    .map((candidate): DiningRevenue => {
      const hasService = withService.has(candidate.id);
      const forMonth = (ym: string) => diningRows.find((row) => row.sedeId === candidate.id && row.ym === ym);
      const now = forMonth(selected.ym);
      const before = previous === current ? undefined : forMonth(previousRange.ym);
      const revenue = now?.revenue ?? 0;
      const tickets = now?.tickets ?? 0;
      const averageTicket = tickets > 0 ? revenue / tickets : 0;

      return {
        siteName: candidate.name,
        revenue: toMillions(revenue),
        formattedRevenue: hasService ? money(toMillions(revenue)) : "—",
        ticketsCount: tickets,
        averageTicket,
        formattedAverageTicket: hasService ? `$ ${count(Math.round(averageTicket))}` : "—",
        delta:
          now && before && before.revenue > 0
            ? createDelta(growth(now.revenue, before.revenue), { suffix: "%" })
            : createNeutralDelta({ suffix: "%" }),
        hasService,
        note: hasService ? "" : "Sin reservas de comedor registradas",
        isSelected: site.isAggregate || site.id === candidate.id,
      };
    });

  return {
    siteName: site.name,
    month: filters.month,
    previousMonth: months[previous].id,
    kpis,
    monthlyBalance,
    administrativeExpenses,
    topSellingProducts,
    diningRevenues,
    ...context.meta,
  };
}
