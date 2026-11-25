// Arma el tablero financiero (docs/INTEGRACION.md, 6.2): ingresos, egresos y sueldos salen de `aggregates` de CORE
// (un solo llamado con groupBy=month para toda la ventana), el saldo de los snapshots (y el de cierre del mes elegido), y productos y comedor de eventos del inbox.
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
import { periodWindow } from "../../../domain/services/period-catalog.service";
import { walletMonthsQuery } from "../../../domain/services/wallet-range.service";
import { DINING_INCLUDE_PURCHASES, EXPENSE_CONCEPTS, INCOME_CONCEPTS, REVERSAL_CONCEPTS, SERIES_LENGTH, TOP_PRODUCTS_LIMIT } from "../../config/dashboard.config";
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

  // Una sola llamada con groupBy=month para toda la ventana (la última es el mes elegido): los grupos se reparten por
  // `month` (mes argentino) y, como `to` es el inicio del mes siguiente al elegido, el saldo es el de su cierre. Un mes sin
  // grupos es un mes sin movimientos; si CORE falla, ningún mes tiene dato (un solo aviso).
  const windowYms = window.map((month) => monthRange(month).ym);
  const readWindow = async (): Promise<WalletAggregates | null> => {
    const query = walletMonthsQuery(windowYms[0], windowYms[windowYms.length - 1], "month");
    const read = await warnings.guard("core", "los agregados de wallet", () => context.wallet.getAggregates(query), null);
    return read.value;
  };
  const byMonth = (body: WalletAggregates | null, ym: string): WalletAggregates | null =>
    body && { ...body, groups: body.groups.filter((group) => group.month === ym) };

  const [windowBody, snapshots, productRows, diningRows, diningSites] = await Promise.all([
    readWindow(),
    queryBalanceSnapshots(prisma, windowYms),
    queryTopProducts(prisma, selected, siteId),
    queryDiningRevenue(prisma, previousRange.start, selected.end, context.diningNetOfAttendance, DINING_INCLUDE_PURCHASES),
    queryDiningSites(prisma, DINING_INCLUDE_PURCHASES),
  ]);

  // Serie mensual en millones. Saldo: el mes elegido toma el de CORE al cierre del mes (el `to` de la consulta; si el mes
  // está en curso, el de hoy); los anteriores salen de los snapshots (los completa el backfill del job).
  const points: MonthPoint[] = window.map((month, index) => {
    const figures = figuresOf(byMonth(windowBody, windowYms[index]));
    const isSelected = index === window.length - 1;
    const closing = isSelected && windowBody && windowBody.walletCount > 0 ? Number(windowBody.outstandingBalance) : undefined;
    const balance = closing ?? snapshots.get(windowYms[index]);

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
