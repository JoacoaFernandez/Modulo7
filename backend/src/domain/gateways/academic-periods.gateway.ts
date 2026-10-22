// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.

// Un período académico (cuatrimestre) de Gestión Académica, como lo devuelve
// GET /api/planificacion/periodos. G9 usa ids numéricos; acá viajan como string para no
// depender de su tipo (CORE pide UUID y van a migrar).
export interface AcademicPeriod {
  id: string;
  year: number;
  // 1 o 2: primer o segundo cuatrimestre.
  number: number;
  // AAAA-MM-DD.
  startDate: string;
  endDate: string;
}

// Gestión Académica y Planificación (módulo 9): dueña del calendario académico.
export interface AcademicPeriodsGateway {
  listPeriods(): Promise<AcademicPeriod[]>;
}
