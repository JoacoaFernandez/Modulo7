// Domain entities: core business objects, independent of frameworks and infrastructure.
// Datos crudos del prototipo, antes de escalar por sede y de calcular deltas.
import { EventSource, SourceModule } from "./event-source.entity";
import { FilterDefaults } from "./filters.entity";
import { Period } from "./period.entity";
import { Role } from "./role.entity";
import { Site } from "./site.entity";

export interface SubjectSeed {
  code: string;
  name: string;
  // Una tasa por cuatrimestre, en el mismo orden que dataset.quarters.
  approvalRates: number[];
}

export interface TeacherSeed {
  name: string;
  subjectName: string;
  approvalRate: number;
  // Variación en pp contra el cuatrimestre anterior.
  delta: number;
}

export interface FacultySeed {
  name: string;
  color: string;
  approvalRates: number[];
}

// Montos en millones de ARS, uno por mes, en el mismo orden que dataset.months.
export interface FinanceSeed {
  balance: number[];
  income: number[];
  expenses: number[];
}

export interface ExpenseCategorySeed {
  category: string;
  // Porcentaje sobre los egresos del mes; las 7 categorías suman 100.
  percentage: number;
  color: string;
}

export interface ProductSeed {
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
}

export interface DiningSeed {
  siteName: string;
  revenue: number;
  ticketsCount: number;
  averageTicket: number;
  delta: number;
  // Solo para sedes sin servicio de comedor.
  note?: string;
}

export interface EventMonthSeed {
  month: string;
  eventsCount: number;
  attendeesCount: number;
  attendanceRate: number;
}

export interface EventTypeSeed {
  eventType: string;
  // Eventos por mes de ese tipo.
  frequency: number;
  // Concurrencia promedio por evento.
  attendeesCount: number;
  attendanceRate: number;
}

export interface AnalyticsDataset {
  // Alumnos de "Todas las sedes": denominador del factor de escala por sede.
  baselineStudentsCount: number;
  sites: Site[];
  quarters: Period[];
  months: Period[];
  subjects: SubjectSeed[];
  teachers: TeacherSeed[];
  faculties: FacultySeed[];
  finance: FinanceSeed;
  expenseCategories: ExpenseCategorySeed[];
  products: ProductSeed[];
  dining: DiningSeed[];
  eventMonths: EventMonthSeed[];
  eventTypes: EventTypeSeed[];
  roles: Role[];
  eventSources: EventSource[];
  defaults: FilterDefaults;
  lastIngestionAt: string;
  // Módulos que alimentan cada tablero, para la nota al pie.
  academicSourceModules: SourceModule[];
  financialSourceModules: SourceModule[];
  eventsSourceModules: SourceModule[];
}
