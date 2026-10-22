// Domain entities: core business objects, independent of frameworks and infrastructure.
// Los montos viajan como string decimal en ARS (contrato de CORE); los `formatted*` ya vienen
// listos para mostrar, en millones.
import { Delta } from "./delta.value-object";
import { DecimalString } from "./money.value-object";
import { KpiCard } from "./kpi.value-object";
import { SourceModule } from "./event-source.entity";

export interface MonthlyBalancePoint {
  month: string;
  // Etiqueta corta del eje X: "Ago".
  shortMonth: string;
  income: DecimalString;
  expense: DecimalString;
  // Ingresos menos egresos del mes.
  result: DecimalString;
  // Saldo acumulado al cierre del mes.
  balance: DecimalString;
  formattedIncome: string;
  formattedExpense: string;
  formattedResult: string;
  formattedBalance: string;
  // true para el mes seleccionado en el filtro de período.
  isSelected: boolean;
}

export interface AdministrativeExpense {
  category: string;
  percentage: number;
  amount: DecimalString;
  formattedAmount: string;
  // Color fijo de la categoría en la barra apilada.
  color: string;
}

export interface TopSellingProduct {
  productName: string;
  category: string;
  unitsSold: number;
  revenue: DecimalString;
  formattedRevenue: string;
}

export interface DiningRevenue {
  siteName: string;
  revenue: DecimalString;
  formattedRevenue: string;
  ticketsCount: number;
  averageTicket: DecimalString;
  formattedAverageTicket: string;
  delta: Delta;
  // Campus Online no tiene comedor: sin datos y con nota en lugar de tickets.
  hasService: boolean;
  note: string;
  // true si la sede está incluida en el filtro activo.
  isSelected: boolean;
}

export interface FinancialStats {
  siteName: string;
  month: string;
  previousMonth: string;
  // Saldo acumulado, ingresos del período, egresos del período, resultado operativo.
  kpis: KpiCard[];
  // Seis meses: alimenta las barras de ingresos/egresos y el área del saldo acumulado.
  monthlyBalance: MonthlyBalancePoint[];
  administrativeExpenses: AdministrativeExpense[];
  topSellingProducts: TopSellingProduct[];
  diningRevenues: DiningRevenue[];
  sourceModules: SourceModule[];
  lastIngestionAt: string;
}
