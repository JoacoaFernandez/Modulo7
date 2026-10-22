// Mock de Gestión Académica (módulo 9): períodos con el shape de GET /api/planificacion/periodos.
import { AcademicPeriod, AcademicPeriodsGateway } from "../../domain/gateways/academic-periods.gateway";

// Los seis cuatrimestres del dataset mock, del más viejo al más nuevo (2023-2C a 2026-1C).
export const PERIODS: AcademicPeriod[] = [
  { id: "3", year: 2023, number: 2, startDate: "2023-08-14", endDate: "2023-12-16" },
  { id: "4", year: 2024, number: 1, startDate: "2024-03-11", endDate: "2024-07-13" },
  { id: "5", year: 2024, number: 2, startDate: "2024-08-12", endDate: "2024-12-14" },
  { id: "6", year: 2025, number: 1, startDate: "2025-03-10", endDate: "2025-07-12" },
  { id: "7", year: 2025, number: 2, startDate: "2025-08-11", endDate: "2025-12-13" },
  { id: "8", year: 2026, number: 1, startDate: "2026-03-09", endDate: "2026-07-11" },
];

export class AcademicPeriodsGatewayMock implements AcademicPeriodsGateway {
  async listPeriods(): Promise<AcademicPeriod[]> {
    return PERIODS;
  }
}
