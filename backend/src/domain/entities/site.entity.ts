// Domain entities: core business objects, independent of frameworks and infrastructure.

export interface Site {
  // siteId (UUID) del catálogo de Backoffice. null sólo para "Todas las sedes".
  id: string | null;
  // Código legible de Backoffice ("CENTRO"); vacío para la agregada.
  code: string;
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
