export type DeltaTone = "positive" | "negative" | "neutral";

export interface Delta {
  value: number;
  formatted: string;
  tone: DeltaTone;
}

export interface KpiCard {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  unit: string;
  delta: Delta;
}

export interface Site {
  id: string;
  name: string;
  studentsCount: number;
  subjectsCount: number;
  commissionsCount: number;
  teachersCount: number;
  rateAdjustment: number;
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
  siteName: string;
  quarter: string;
}

export interface FinancialFilters {
  siteName: string;
  month: string;
}

export interface FilterDefaults {
  siteName: string;
  quarter: string;
  month: string;
}

export interface FilterOptions {
  sites: Site[];
  quarters: Period[];
  months: Period[];
  defaults: FilterDefaults;
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

export type EventSourceStatus = "connected" | "degraded" | "disconnected";

export interface EventSource {
  module: SourceModule;
  label: string;
  status: EventSourceStatus;
  lastIngestionAt: string;
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
  quarter: string;
  previousQuarter: string;
  comparedQuarters: string[];
  kpis: KpiCard[];
  subjectApprovalRates: SubjectApprovalRate[];
  facultyTrends: FacultyTrendSeries[];
  teacherApprovalRates: TeacherApprovalRate[];
  totalTeachersCount: number;
  sourceModules: SourceModule[];
  lastIngestionAt: string;
}

export interface MonthlyBalancePoint {
  month: string;
  shortMonth: string;
  income: number;
  expense: number;
  result: number;
  balance: number;
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
  topSellingProducts: TopSellingProduct[];
  diningRevenues: DiningRevenue[];
  sourceModules: SourceModule[];
  lastIngestionAt: string;
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
  sourceModules: SourceModule[];
  lastIngestionAt: string;
}
