export type DeltaTone = "positive" | "negative" | "neutral";

export interface Delta {
  value: number;
  formatted: string;
  tone: DeltaTone;
}

// Aviso de que una fuente no respondió y el bloque afectado salió vacío (nunca se inventan números).
export interface DashboardWarning {
  // Servicio afectado: "core", "backoffice", "academic".
  source: string;
  message: string;
}

export interface KpiCard {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  unit: string;
  delta: Delta;
  // Aclaración de la definición o del dato faltante (por ejemplo "Sin resultados publicados en el período").
  note?: string;
}

export interface Site {
  id: string;
  name: string;
  isAggregate: boolean;
}

export type PeriodKind = "quarter" | "month";

export interface Period {
  id: string;
  label: string;
  kind: PeriodKind;
  index: number;
}

export interface AcademicFilters {
  siteId: string;
  quarter: string;
  // Id de la facultad del catálogo; null = todas las facultades.
  facultyId: string | null;
}

export interface FinancialFilters {
  siteId: string;
  month: string;
}

export interface FilterDefaults {
  siteName: string;
  quarter: string;
  month: string;
}

// Facultad del catálogo de filtros; hoy el id es el propio nombre.
export interface Faculty {
  id: string;
  name: string;
}

export interface FilterOptions {
  sites: Site[];
  quarters: Period[];
  months: Period[];
  faculties: Faculty[];
  defaults: FilterDefaults;
  // Fuentes que fallaron al armar los catálogos (la lista afectada va reducida).
  warnings?: DashboardWarning[];
}

export type RoleId = "academica" | "financiera";

export type DashboardId = "academic" | "financial" | "events";

export interface Role {
  id: RoleId;
  name: string;
  initials: string;
  description: string;
  availableDashboards: DashboardId[];
}

export type SourceModule =
  | "portal-estudiante"
  | "portal-docente"
  | "biblioteca"
  | "comedor"
  | "tienda"
  | "eventos"
  | "backoffice"
  | "gestion-academica"
  | "core";

export interface EventSource {
  module: SourceModule;
  label: string;
  // Último evento recibido (ISO 8601); null si todavía no llegó ninguno.
  lastIngestionAt: string | null;
}

export interface InstitutionalEvent {
  id: string;
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  receivedAt: string;
}

export interface RecordEventPayload {
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface SubjectApprovalPoint {
  quarter: string;
  approvalRate: number;
}

export interface SubjectApprovalRate {
  code: string;
  name: string;
  approvalRate: number;
  series: SubjectApprovalPoint[];
  delta: Delta;
}

export interface FacultyTrendPoint {
  quarter: string;
  approvalRate: number;
}

export interface FacultyTrendSeries {
  facultyName: string;
  color: string;
  points: FacultyTrendPoint[];
  latestApprovalRate: number;
  delta: Delta;
}

export interface TeacherApprovalRate {
  teacherName: string;
  subjectName: string;
  approvalRate: number;
  delta: Delta;
}

export interface AcademicStats {
  siteName: string;
  // Facultad aplicada al tablero; null = todas las facultades.
  facultyName: string | null;
  quarter: string;
  previousQuarter: string;
  comparedQuarters: string[];
  kpis: KpiCard[];
  subjectApprovalRates: SubjectApprovalRate[];
  facultyTrends: FacultyTrendSeries[];
  teacherApprovalRates: TeacherApprovalRate[];
  totalTeachersCount: number;
  warnings?: DashboardWarning[];
  sourceModules: SourceModule[];
  // Último evento recibido (ISO 8601); null si todavía no llegó ninguno.
  lastIngestionAt: string | null;
}

export interface MonthlyBalancePoint {
  month: string;
  shortMonth: string;
  income: number;
  expense: number;
  result: number;
  // Saldo acumulado al cierre del mes; null si no hay snapshot de ese mes (formattedBalance: "—").
  balance: number | null;
  formattedIncome: string;
  formattedExpense: string;
  formattedResult: string;
  formattedBalance: string;
  isSelected: boolean;
}

export interface AdministrativeExpense {
  category: string;
  percentage: number;
  amount: number;
  formattedAmount: string;
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
  hasService: boolean;
  note: string;
  isSelected: boolean;
}

export interface FinancialStats {
  siteName: string;
  month: string;
  previousMonth: string;
  kpis: KpiCard[];
  monthlyBalance: MonthlyBalancePoint[];
  administrativeExpenses: AdministrativeExpense[];
  // Top de productos del mes por unidades vendidas (netas de devoluciones).
  topSellingProducts: TopSellingProduct[];
  // Top de productos del mes por facturación; mismo tipo y límite que el anterior.
  topRevenueProducts: TopSellingProduct[];
  diningRevenues: DiningRevenue[];
  // Con una sede elegida: aviso de que saldo, ingresos, egresos y sueldos son institucionales. null con "Todas las sedes".
  siteScopeNote: string | null;
  warnings?: DashboardWarning[];
  sourceModules: SourceModule[];
  // Último evento recibido (ISO 8601); null si todavía no llegó ninguno.
  lastIngestionAt: string | null;
}

export interface EventTypeStats {
  eventType: string;
  frequency: number;
  attendeesCount: number;
  attendanceRate: number;
}

export interface EventMonthlyPoint {
  month: string;
  shortMonth: string;
  eventsCount: number;
  attendeesCount: number;
  attendanceRate: number;
}

export interface EventAttendanceHighlight {
  eventType: string;
  attendanceRate: number;
}

export interface EventStats {
  siteName: string;
  month: string;
  totalEvents: number;
  totalAttendees: number;
  totalRegistered: number;
  averageAttendanceRate: number;
  capacityOccupancy: number;
  bestAttendance: EventAttendanceHighlight;
  worstAttendance: EventAttendanceHighlight;
  monthlySeries: EventMonthlyPoint[];
  eventTypes: EventTypeStats[];
  warnings?: DashboardWarning[];
  sourceModules: SourceModule[];
  // Último evento recibido (ISO 8601); null si todavía no llegó ninguno.
  lastIngestionAt: string | null;
}
