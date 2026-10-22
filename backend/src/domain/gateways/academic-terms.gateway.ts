// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.

// Un cuatrimestre de Gestión Académica, con los campos de academic.term-defined.v1.
export interface AcademicTerm {
  termId: string;
  // AAAA-MM-DD.
  startDate: string;
  endDate: string;
}

// Gestión Académica y Planificación (módulo 9): dueña del calendario académico.
export interface AcademicTermsGateway {
  listTerms(): Promise<AcademicTerm[]>;
}
