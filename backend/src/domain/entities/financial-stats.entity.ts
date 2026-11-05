// Domain entities: core business objects, independent of frameworks and infrastructure.
// Todos los montos están expresados en millones de ARS.
import { Delta } from "./delta.value-object";
import { KpiCard } from "./kpi.value-object";
import { DashboardWarning } from "./dashboard-warning.entity";
import { SourceModule } from "./event-source.entity";

export interface MonthlyBalancePoint {
  month: string;
  // Etiqueta corta del eje X: "Ago".
  shortMonth: string;
  income: number;
  expense: number;
  // Ingresos menos egresos del mes.
  result: number;
  // Saldo acumulado al cierre del mes; null si no hay snapshot de ese mes (formattedBalance: "—").
  balance: number | null;
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
  amount: number;
  formattedAmount: string;
  // Color fijo de la categoría en la barra apilada.
  color: string;
}

export interface TopSellingProduct {
  productName: string;
  category: string;
  unitsSold: number;
  revenue: number;
  formattedRevenue: string;
}

export interface DiningRevenue {
  siteName: string;
  revenue: number;
  formattedRevenue: string;
  ticketsCount: number;
  averageTicket: number;
  formattedAverageTicket: string;
  delta: Delta;
  // false si la sede no registró ninguna reserva de comedor: sin datos y con nota en lugar de tickets.
  hasService: boolean;
  note: string;
  // true si la sede está incluida en el filtro activo.
  isSelected: boolean;
}

export interface FinancialStats {
  siteName: string;
  month: string;
  previousMonth: string;
  // Saldo acumulado, ingresos del período, egresos del período, resultado operativo (margen sobre ingresos).
  kpis: KpiCard[];
  // Hasta seis meses, terminando en el seleccionado: alimenta las barras de ingresos/egresos y el área del saldo acumulado.
  monthlyBalance: MonthlyBalancePoint[];
  administrativeExpenses: AdministrativeExpense[];
  // Top de productos del mes por unidades vendidas (store.purchase.completed.v1; no hay evento de devolución).
  topSellingProducts: TopSellingProduct[];
  // Top de productos del mes por facturación; mismo tipo y límite que el anterior.
  topRevenueProducts: TopSellingProduct[];
  diningRevenues: DiningRevenue[];
  // Con una sede elegida: aviso de que saldo, ingresos, egresos y sueldos son institucionales (CORE no los distingue por sede). null con "Todas las sedes".
  siteScopeNote: string | null;
  // Fuentes que no respondieron: el bloque afectado sale vacío (nunca números inventados).
  warnings?: DashboardWarning[];
  sourceModules: SourceModule[];
  // Último evento recibido de los módulos que alimentan el tablero (ISO 8601); null si no hay ninguno.
  lastIngestionAt: string | null;
}
