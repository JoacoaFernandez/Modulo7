// Arma el tablero financiero (docs/INTEGRACION.md, 6.2): ingresos, egresos y sueldos salen de `aggregates` de CORE
// (un llamado por mes de la ventana), el saldo de los snapshots, y productos y comedor de eventos del inbox.
// Si CORE falla, los bloques afectados salen vacíos ("—") con un warning; nunca números inventados.
import { PrismaClient } from "@prisma/client";
import { createDelta, createNeutralDelta, Delta } from "../../../domain/entities/delta.value-object";
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
import { CoreWalletGateway, WalletAggregates } from "../../../domain/gateways/core-wallet.gateway";
import { argentinaToday, currentMonthYm, periodWindow } from "../../../domain/services/period-catalog.service";
import { EXPENSE_CONCEPTS, INCOME_CONCEPTS, REVERSAL_CONCEPTS, SERIES_LENGTH, TOP_PRODUCTS_LIMIT } from "../../config/dashboard.config";
import {
  ProductRow,
  queryBalanceSnapshots,
  queryDiningRevenue,
  queryDiningSites,
  queryTopProducts,
} from "../queries/financial.queries";
import { MonthRange, parseMonthId } from "../queries/query-helpers";
import { capitalize, count, findSite, growth, indexOfPeriod, money, percentage, shortMonth, toMillions } from "./format";
import { SourceMeta } from "./source-meta.builder";
import { WarningCollector } from "./warning-collector";

export const SITE_SCOPE_NOTE = "Saldo, ingresos, egresos y sueldos son institucionales: CORE no los distingue por sede.";

export interface FinancialContext {
  sites: Site[];
  months: Period[];
  wallet: CoreWalletGateway;
  warnings: WarningCollector;
  // DINING_REVENUE_NET_OF_ATTENDANCE: la facturación del comedor descuenta también lo restituido por asistencia.
  diningNetOfAttendance: boolean;
  now: Date;
  meta: SourceMeta;
}

function monthRange(month: Period): MonthRange {
  const range = parseMonthId(month.id);
  if (!range) throw new Error(`Mes inválido en el catálogo: ${month.id}`);

  return range;
}

function lastDayOf(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
}

const sumGroups = (aggregates: WalletAggregates, type: string, keys: readonly string[]): number =>
  aggregates.groups.filter((group) => group.type === type && keys.includes(group.key)).reduce((total, group) => total + Number(group.total), 0);

// Cifras de un mes en ARS; `available: false` = CORE no respondió ese mes.
interface MonthFigures {
  available: boolean;
  income: number;
  expense: number;
  aggregates: WalletAggregates | null;
}

function figuresOf(aggregates: WalletAggregates | null): MonthFigures {
  if (!aggregates) return { available: false, income: 0, expense: 0, aggregates: null };

  // Ingresos: cobros de servicios (DEBIT) menos devoluciones (REVERSAL), sin bajar de 0. Egresos: sueldos y becas (CREDIT).
  const income = Math.max(0, sumGroups(aggregates, "DEBIT", INCOME_CONCEPTS) - sumGroups(aggregates, "REVERSAL", REVERSAL_CONCEPTS));
  const expense = sumGroups(aggregates, "CREDIT", EXPENSE_CONCEPTS.map((concept) => concept.key));
  return { available: true, income, expense, aggregates };
}

interface MonthPoint {
  figures: MonthFigures;
  // Millones de ARS; null si no hay snapshot de ese mes.
  balance: number | null;
  income: number;
  expense: number;
}

// Resultado operativo: margen sobre ingresos (0 sin ingresos).
const margin = (point: MonthPoint) => (point.income === 0 ? 0 : ((point.income - point.expense) / point.income) * 100);

// KPIs del mes elegido contra el anterior; sin mes anterior (o sin dato en él), los deltas quedan neutros.
function buildKpis(current: MonthPoint, previous: MonthPoint | undefined): KpiCard[] {
  const available = current.figures.available;
  const comparable = previous?.figures.available === true && available;
  const change = (now: number, before: number | undefined, inverted = false): Delta =>
    comparable && before !== undefined ? createDelta(growth(now, before), { suffix: "%", inverted }) : createNeutralDelta({ suffix: "%" });
  const marginDelta =
    comparable && current.income > 0 && previous!.income > 0
      ? createDelta(margin(current) - margin(previous!), { suffix: "%" })
      : createNeutralDelta({ suffix: "%" });
  const balanceDelta =
    current.balance !== null && previous?.balance != null && previous.balance !== 0
      ? createDelta(growth(current.balance, previous.balance), { suffix: "%" })
      : createNeutralDelta({ suffix: "%" });

  return [
    {
      id: "accumulated-balance",
      label: "Saldo acumulado",
      value: current.balance ?? 0,
      formattedValue: current.balance === null ? "—" : money(current.balance),
      unit: "ARS",
      delta: balanceDelta,
      ...(current.balance === null ? { note: "Sin snapshot del saldo de CORE para este mes: sólo hay historia desde que corre el job." } : {}),
    },
    {
      id: "period-income",
      label: "Ingresos del período",
      value: current.income,
      formattedValue: available ? money(current.income) : "—",
      unit: "ARS",
      delta: change(current.income, previous?.income),
      note: "Cobros de servicios (tienda, comedor, multas, eventos) menos devoluciones.",
    },
    {
      id: "period-expenses",
      label: "Egresos del período",
      value: current.expense,
      formattedValue: available ? money(current.expense) : "—",
      unit: "ARS",
      // Que los egresos suban es malo: la semántica del chip va invertida.
      delta: change(current.expense, previous?.expense, true),
      note: "Sueldos y becas acreditados.",
    },
    {
      id: "operating-result",
      label: "Resultado operativo",
      value: available ? margin(current) : 0,
      formattedValue: available ? `${margin(current).toFixed(1)}%` : "—",
      unit: "",
      delta: marginDelta,
    },
  ];
}

export async function buildFinancialStats(prisma: PrismaClient, filters: FinancialFilters, context: FinancialContext): Promise<FinancialStats> {
  const site = findSite(context.sites, filters.siteId);
  const siteId = site.isAggregate ? null : site.id;
  const { months, warnings } = context;

  const current = indexOfPeriod(months, filters.month, "periodo");
  const previous = Math.max(0, current - 1);
  const selected = monthRange(months[current]);
  const previousRange = monthRange(months[previous]);
  const window = periodWindow(months, current, SERIES_LENGTH);
  const currentYm = currentMonthYm(context.now);

  // Un `aggregates` por mes de la ventana (el mes en curso, hasta hoy). Los avisos iguales se juntan en uno.
  const readMonth = async (month: Period): Promise<WalletAggregates | null> => {
    const { ym } = monthRange(month);
    const to = ym === currentYm ? argentinaToday(context.now) : lastDayOf(ym);
    const read = await warnings.guard("core", "los agregados de wallet", () => context.wallet.getAggregates(`${ym}-01`, to), null);
    return read.value;
  };

  const [aggregates, snapshots, productRows, diningRows, diningSites] = await Promise.all([
    Promise.all(window.map(readMonth)),
    queryBalanceSnapshots(prisma, window.map((month) => monthRange(month).ym)),
    queryTopProducts(prisma, selected, siteId),
    queryDiningRevenue(prisma, previousRange.start, selected.end, context.diningNetOfAttendance),
    queryDiningSites(prisma),
  ]);

  // Serie mensual en millones. Saldo: el mes en curso toma el valor en vivo de CORE; los meses cerrados sólo el snapshot
  // (CORE puede devolver el saldo "a hoy" para un rango pasado, así que no sirve como saldo histórico).
  const points: MonthPoint[] = window.map((month, index) => {
    const { ym } = monthRange(month);
    const figures = figuresOf(aggregates[index]);
    const live = ym === currentYm && figures.aggregates ? Number(figures.aggregates.outstandingBalance) : undefined;
    const balance = live ?? snapshots.get(ym);

    return {
      figures,
      balance: balance === undefined ? null : toMillions(balance),
      income: toMillions(figures.income),
      expense: toMillions(figures.expense),
    };
  });
  const monthlyBalance: MonthlyBalancePoint[] = window.map((month, index) => {
    const point = points[index];
    const available = point.figures.available;
    const result = point.income - point.expense;

    return {
      month: month.id,
      shortMonth: shortMonth(month),
      income: point.income,
      expense: point.expense,
      result,
      balance: point.balance,
      formattedIncome: available ? money(point.income) : "—",
      formattedExpense: available ? money(point.expense) : "—",
      formattedResult: available ? money(result) : "—",
      formattedBalance: point.balance === null ? "—" : money(point.balance),
      isSelected: month.id === filters.month,
    };
  });
  const selectedPoint = points[points.length - 1];
  const kpis = buildKpis(selectedPoint, current > 0 ? points[points.length - 2] : undefined);

  // Gastos administrativos del mes: sueldos y becas de `aggregates`, con su % sobre la suma; sólo los de total > 0.
  const selectedGroups = selectedPoint.figures.aggregates?.groups ?? [];
  const expenseAmounts = EXPENSE_CONCEPTS.map((concept) => ({
    ...concept,
    amount: selectedGroups.filter((group) => group.type === "CREDIT" && group.key === concept.key).reduce((total, group) => total + Number(group.total), 0),
  })).filter((concept) => concept.amount > 0);
  const totalExpenses = expenseAmounts.reduce((total, concept) => total + concept.amount, 0);
  const administrativeExpenses: AdministrativeExpense[] = expenseAmounts.map(({ category, color, amount }) => ({
    category,
    percentage: percentage(amount, totalExpenses),
    amount: toMillions(amount),
    formattedAmount: money(toMillions(amount)),
    color,
  }));

  // Productos del mes: dos rankings con el mismo límite, por unidades y por facturación; ambos desempatan por nombre.
  const toTopProduct = (row: ProductRow): TopSellingProduct => ({
    productName: row.productName,
    category: row.category ? capitalize(row.category) : "Sin categoría",
    unitsSold: Math.round(row.units),
    revenue: toMillions(row.revenue),
    formattedRevenue: money(toMillions(row.revenue)),
  });
  const byName = (a: ProductRow, b: ProductRow) => a.productName.localeCompare(b.productName, "es");
  const topSellingProducts = productRows
    .filter((row) => row.units > 0)
    .sort((a, b) => b.units - a.units || byName(a, b))
    .slice(0, TOP_PRODUCTS_LIMIT)
    .map(toTopProduct);
  const topRevenueProducts = productRows
    .filter((row) => row.units > 0)
    .sort((a, b) => b.revenue - a.revenue || byName(a, b))
    .slice(0, TOP_PRODUCTS_LIMIT)
    .map(toTopProduct);

  // Comedores: una fila por sede de Backoffice. El filtro de sede sólo resalta, no recorta. Una sede sin ninguna
  // reserva registrada se muestra sin servicio.
  const withService = new Set(diningSites);
  const diningRevenues: DiningRevenue[] = context.sites
    .filter((candidate) => !candidate.isAggregate)
    .map((candidate): DiningRevenue => {
      const hasService = withService.has(candidate.id);
      const forMonth = (ym: string) => diningRows.find((row) => row.siteId === candidate.id && row.ym === ym);
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
    topRevenueProducts,
    diningRevenues,
    siteScopeNote: site.isAggregate ? null : SITE_SCOPE_NOTE,
    ...(warnings.warnings ? { warnings: warnings.warnings } : {}),
    ...context.meta,
  };
}
