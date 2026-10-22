// Mock de Gestión Académica (módulo 9): cuatrimestres con los campos de academic.term-defined.v1.
import { AcademicTerm, AcademicTermsGateway } from "../../domain/gateways/academic-terms.gateway";

// Los seis cuatrimestres del dataset mock, del más viejo al más nuevo (2023-2C a 2026-1C).
export const TERMS: AcademicTerm[] = [
  { termId: "a0e1f2a3-b4c5-4d6e-8f70-81a2b3c4d5e6", startDate: "2023-08-14", endDate: "2023-12-16" },
  { termId: "b1f2a3b4-c5d6-4e7f-9081-92b3c4d5e6f7", startDate: "2024-03-11", endDate: "2024-07-13" },
  { termId: "c2a3b4c5-d6e7-4f80-8192-a3c4d5e6f708", startDate: "2024-08-12", endDate: "2024-12-14" },
  { termId: "d3b4c5d6-e7f8-4091-92a3-b4d5e6f70819", startDate: "2025-03-10", endDate: "2025-07-12" },
  { termId: "e4c5d6e7-f809-41a2-a3b4-c5e6f708192a", startDate: "2025-08-11", endDate: "2025-12-13" },
  { termId: "f5d6e7f8-091a-42b3-b4c5-d6f708192a3b", startDate: "2026-03-09", endDate: "2026-07-11" },
];

export class AcademicTermsGatewayMock implements AcademicTermsGateway {
  async listTerms(): Promise<AcademicTerm[]> {
    return TERMS;
  }
}
