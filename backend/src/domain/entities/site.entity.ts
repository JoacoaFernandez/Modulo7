// Domain entities: core business objects, independent of frameworks and infrastructure.

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
