// Domain entities: core business objects, independent of frameworks and infrastructure.
import { Delta } from "./delta.value-object";
import { KpiCard } from "./kpi.value-object";
import { DashboardWarning } from "./dashboard-warning.entity";
import { SourceModule } from "./event-source.entity";

export interface SubjectApprovalPoint {
  quarter: string;
  approvalRate: number;
}

export interface SubjectApprovalRate {
  code: string;
  name: string;
  // Tasa del cuatrimestre seleccionado, para la sede del filtro.
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
  // Hasta seis cuatrimestres, terminando en el seleccionado; 0 donde la facultad no tuvo resultados.
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
  // Etiquetas [t-2, t-1, t] para la leyenda de las barras agrupadas.
  comparedQuarters: string[];
  // Materias en curso, tasa de aprobación general, comisiones activas, estudiantes con cursada activa.
  kpis: KpiCard[];
  subjectApprovalRates: SubjectApprovalRate[];
  facultyTrends: FacultyTrendSeries[];
  teacherApprovalRates: TeacherApprovalRate[];
  // Docentes distintos con resultados publicados en el cuatrimestre, la sede y la facultad del filtro.
  totalTeachersCount: number;
  // Fuentes que no respondieron: el bloque afectado sale vacío (nunca números inventados).
  warnings?: DashboardWarning[];
  sourceModules: SourceModule[];
  // Último evento recibido de los módulos que alimentan el tablero (ISO 8601); null si no hay ninguno.
  lastIngestionAt: string | null;
}
