// Gestión Académica (G9): catálogo y cursos. Los ids son numéricos en su sistema. Las rutas de la API de G9
// son en gran parte propuestas (docs/INTEGRACION.md, 4.3): ver infrastructure/integrations/academic/academic.routes.ts.
export interface AcademicPeriod {
  id: number;
  anio: number;
  numero: number;
  fechaInicio: string;
  fechaFin: string;
}

export interface AcademicSite {
  id: number;
  backofficeSiteId: string;
  nombre: string;
}

export interface AcademicCareer {
  id: number;
  codigo: string;
  nombre: string;
  facultad: string;
  duracion?: number;
  titulo?: string;
  estado?: string;
}

export interface AcademicPlan {
  id: number;
  codigo: string;
  nombre: string;
  vigenciaDesde?: string;
  cantidadAsignaturas?: number;
  estado: string;
  carreraId: number;
}

export interface AcademicSubject {
  id: number;
  codigo: string;
  nombre: string;
  anio?: number;
  creditos?: number;
  cargaHoraria?: number;
  estado?: string;
  planId: number;
}

export type CourseStatus = "PLANIFICADO" | "EN_CURSO" | "FINALIZADO" | "CANCELADO";

export interface AcademicCourse {
  id: number;
  codigo: string;
  asignaturaId: number;
  periodoId: number;
  sedeId: number;
  sedeNombre?: string;
  estado: CourseStatus;
  cupoMaximo?: number;
  inscriptosActivos: number;
  docentes?: { docenteId: string; rol: string }[];
}

export interface AcademicCourseDetail {
  curso: {
    id: number;
    asignatura: { id: number; codigo: string; nombre: string };
    periodo: { id: number; anio: number; numero: number };
    sedeId: number;
    estado: CourseStatus;
  };
  docentes: { docenteId: string; rol: "TITULAR" | "ADJUNTO" | "AUXILIAR" }[];
}

// Errores como GatewayError con el `code` de G9 (RESOURCE_NOT_FOUND...).
export interface AcademicGateway {
  listPeriods(): Promise<AcademicPeriod[]>;
  listSites(): Promise<AcademicSite[]>;
  listCareers(): Promise<AcademicCareer[]>;
  listPlans(careerId: number | string): Promise<AcademicPlan[]>;
  listSubjects(planId: number | string): Promise<AcademicSubject[]>;
  listCourses(periodId: number | string): Promise<AcademicCourse[]>;
  getCourse(courseId: number | string): Promise<AcademicCourseDetail>;
}
