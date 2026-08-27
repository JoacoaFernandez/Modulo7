// Domain entities: core business objects, independent of frameworks and UI.
// Espejo manual de backend/src/domain/entities: mantener sincronizado ante cualquier cambio del contrato.

// --- Valores compartidos ---

export type DeltaTone = "positive" | "negative" | "neutral";

// Variación de una métrica contra el período anterior, ya formateada para mostrar.
export interface Delta {
  // Diferencia numérica: pp para tasas, % para montos, unidades para conteos.
  value: number;
  // Texto con signo y unidad: "+2.1 pp", "-4.1 pp", "+3".
  formatted: string;
  // Semántica del cambio; la capa de presentación la mapea a color.
  tone: DeltaTone;
}

// Tarjeta de indicador: el valor crudo para graficar y el formateado para mostrar.
export interface KpiCard {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  // Unidad al lado del valor: "materias", "comisiones", "ARS" o vacío.
  unit: string;
  delta: Delta;
}

// --- Filtros, sedes, períodos y roles ---

export interface Site {
  id: string;
  name: string;
  studentsCount: number;
  subjectsCount: number;
  commissionsCount: number;
  teachersCount: number;
  // Ajuste en pp que se suma a las tasas de aprobación de la sede.
  rateAdjustment: number;
  // true solo para "Todas las sedes", que agrega al resto.
  isAggregate: boolean;
}

// El tablero académico se filtra por cuatrimestre; el financiero y el de eventos, por mes.
export type PeriodKind = "quarter" | "month";

export interface Period {
  // Identificador tal como viaja en la query: "2026-1C" o "Ago 2026".
  id: string;
  label: string;
  kind: PeriodKind;
  // Posición en la serie histórica; 0 es el período más antiguo.
  index: number;
}

// Filtros del tablero académico: ?sede=&cuatrimestre=
export interface AcademicFilters {
  siteName: string;
  quarter: string;
}

// Filtros del tablero financiero y del de eventos: ?sede=&periodo=
export interface FinancialFilters {
  siteName: string;
  month: string;
}

export interface FilterDefaults {
  siteName: string;
  quarter: string;
  month: string;
}

// Lo que expone GET /api/analytics/filters para alimentar los selectores del header.
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
  // Iniciales del avatar del selector de rol: "DA", "DF".
  initials: string;
  description: string;
  availableDashboards: DashboardId[];
}

// --- Eventos de origen ---

// Los 9 módulos de UADEnet que emiten eventos hacia Analítica Institucional.
export type SourceModule =
  | "academica"
  | "inscripciones"
  | "evaluaciones"
  | "docencia"
  | "finanzas"
  | "biblioteca"
  | "campus"
  | "soporte"
  | "identidad";

export type EventSourceStatus = "connected" | "degraded" | "disconnected";

export interface EventSource {
  module: SourceModule;
  // Etiqueta visible, con acentos: "académica".
  label: string;
  status: EventSourceStatus;
  lastIngestionAt: string;
}

export interface InstitutionalEvent {
  // Identificador interno asignado por Analítica Institucional.
  id: string;
  // Identificador provisto por el módulo emisor; es la clave de idempotencia.
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  payload: Record<string, unknown>;
  // Momento en que ocurrió el hecho, según el emisor.
  occurredAt: string;
  // Momento en que Analítica lo recibió.
  receivedAt: string;
}

// Envelope de ingesta que envían los módulos de UADEnet a POST /api/analytics/events.
export interface RecordEventPayload {
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  // ISO 8601, según el reloj del emisor.
  occurredAt: string;
  payload: Record<string, unknown>;
}

// --- Tablero académico ---

export interface SubjectApprovalPoint {
  quarter: string;
  approvalRate: number;
}

export interface SubjectApprovalRate {
  code: string;
  name: string;
  // Tasa del cuatrimestre seleccionado, ya ajustada por sede.
  approvalRate: number;
  // Tres puntos: cuatrimestres t-2, t-1 y t. Alimenta las barras agrupadas.
  series: SubjectApprovalPoint[];
  // Variación en pp contra t-1.
  delta: Delta;
}

export interface FacultyTrendPoint {
  quarter: string;
  approvalRate: number;
}

export interface FacultyTrendSeries {
  facultyName: string;
  // Color fijo de la serie en el gráfico de líneas.
  color: string;
  // Seis cuatrimestres: la serie completa, no recortada al filtro.
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
  // Etiquetas [t-2, t-1, t] para la leyenda de las barras agrupadas.
  comparedQuarters: string[];
  // Materias en curso, tasa de aprobación general, comisiones activas, estudiantes con cursada activa.
  kpis: KpiCard[];
  subjectApprovalRates: SubjectApprovalRate[];
  facultyTrends: FacultyTrendSeries[];
  teacherApprovalRates: TeacherApprovalRate[];
  // Total de docentes de la sede, del que teacherApprovalRates es una muestra.
  totalTeachersCount: number;
  sourceModules: SourceModule[];
  lastIngestionAt: string;
}

// --- Tablero financiero (montos en millones de ARS) ---

export interface MonthlyBalancePoint {
  month: string;
  // Etiqueta corta del eje X: "Ago".
  shortMonth: string;
  income: number;
  expense: number;
  // Ingresos menos egresos del mes.
  result: number;
  // Saldo acumulado al cierre del mes.
  balance: number;
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

// --- Estadísticas de eventos ---

export interface EventTypeStats {
  // Se agrupa por tipo de evento, no por evento puntual.
  eventType: string;
  // Eventos por mes de ese tipo.
  frequency: number;
  // Concurrencia promedio por evento.
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
  // Concurrencia sobre el cupo ofrecido.
  capacityOccupancy: number;
  bestAttendance: EventAttendanceHighlight;
  worstAttendance: EventAttendanceHighlight;
  // Seis meses: barras de frecuencia y área de concurrencia.
  monthlySeries: EventMonthlyPoint[];
  eventTypes: EventTypeStats[];
  sourceModules: SourceModule[];
  lastIngestionAt: string;
}
