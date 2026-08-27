// Domain entities: core business objects, independent of frameworks and infrastructure.
import { Delta } from "./delta.value-object";
import { KpiCard } from "./kpi.value-object";
import { SourceModule } from "./event-source.entity";

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
