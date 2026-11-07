// Rutas de la API de Gestión Académica (G9), en un solo lugar para cambiarlas sin tocar el gateway.
// Sólo carreras y planes están confirmados por G9; el resto es propuesto (docs/INTEGRACION.md, 4.3): hoy existe como
// /api/planificacion/* y /api/academica/*.
export const ACADEMIC_ROUTES = {
  periods: () => "/internal/v1/periodos",
  sites: () => "/internal/v1/sedes",
  careers: () => "/internal/v1/carreras",
  plans: (careerId: number | string) => `/internal/v1/carreras/${encodeURIComponent(String(careerId))}/planes`,
  subjects: (planId: number | string) => `/internal/v1/planes/${encodeURIComponent(String(planId))}/asignaturas`,
  courses: () => "/internal/v1/cursos",
  course: (courseId: number | string) => `/internal/v1/cursos/${encodeURIComponent(String(courseId))}`,
} as const;
