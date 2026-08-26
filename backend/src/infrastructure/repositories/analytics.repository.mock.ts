// Repository implementations: concrete adapters that fulfill the domain repository interfaces.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";
import { EventStats } from "../../domain/entities/event-stats.entity";
import { InstitutionalEvent } from "../../domain/entities/institutional-event.entity";

const mockAcademicStats: AcademicStats = {
  activeSubjectsCount: 48,
  activeSubjectsTrend: "+3 vs. cuatrimestre anterior",
  overallApprovalRate: 0.71,
  overallApprovalRateTrend: "+4 pp vs. 1C 2026",
  evaluatedTeachersCount: 126,
  subjectsWithoutDataCount: 18,
  subjectApprovalRates: [
    { subjectName: "Desarrollo de Aplicaciones II", quarter: "2026-2C", approvalRate: 0.82 },
    { subjectName: "Bases de Datos", quarter: "2026-2C", approvalRate: 0.76 },
    { subjectName: "Análisis Matemático II", quarter: "2026-2C", approvalRate: 0.58 },
    { subjectName: "Sistemas Operativos", quarter: "2026-2C", approvalRate: 0.64 },
    { subjectName: "Economía", quarter: "2026-2C", approvalRate: 0.88 },
    { subjectName: "Redes de Datos", quarter: "2026-2C", approvalRate: 0.45 },
  ],
  teacherApprovalRates: [
    { teacherName: "Joaquín Timerman", subjectName: "Desarrollo de Aplicaciones II", approvalRate: 0.8 },
    { teacherName: "Ana López", subjectName: "Bases de Datos", approvalRate: 0.6 },
    { teacherName: "Marcos Díaz", subjectName: "Álgebra", approvalRate: 0.5 },
  ],
  approvalRateHistory: [
    { quarter: "1C 2024", approvalRate: 0.61 },
    { quarter: "2C 2024", approvalRate: 0.64 },
    { quarter: "1C 2025", approvalRate: 0.63 },
    { quarter: "2C 2025", approvalRate: 0.67 },
    { quarter: "1C 2026", approvalRate: 0.67 },
    { quarter: "2C 2026", approvalRate: 0.71 },
  ],
};

const mockFinancialStats: FinancialStats = {
  institutionalBalances: [
    { siteName: "Sede Recoleta", balance: 15_400_000 },
    { siteName: "Sede Villa María", balance: 4_200_000 },
  ],
  administrativeExpenses: [
    { category: "Salarios", amount: 9_800_000 },
    { category: "Mantenimiento", amount: 1_200_000 },
    { category: "Licencias de software", amount: 650_000 },
  ],
  topSellingProducts: [
    { productName: "Buzo UADE", unitsSold: 340, revenue: 5_100_000 },
    { productName: "Cuaderno UADE", unitsSold: 890, revenue: 1_780_000 },
    { productName: "Botella térmica", unitsSold: 210, revenue: 1_050_000 },
  ],
  diningRevenues: [
    { siteName: "Sede Recoleta", revenue: 3_400_000 },
    { siteName: "Sede Villa María", revenue: 980_000 },
  ],
};

const mockEventsStats: EventStats[] = [
  { eventName: "Semana de la Ingeniería", frequency: 1, attendeesCount: 320, capacity: 400, attendanceRate: 0.8 },
  { eventName: "Feria de Empleo", frequency: 2, attendeesCount: 540, capacity: 600, attendanceRate: 0.9 },
  { eventName: "Charla de Egresados", frequency: 4, attendeesCount: 150, capacity: 250, attendanceRate: 0.6 },
];

export class AnalyticsRepositoryMock implements AnalyticsRepository {
  private readonly events: InstitutionalEvent[] = [];

  async getAcademicStats(): Promise<AcademicStats> {
    return mockAcademicStats;
  }

  async getFinancialStats(): Promise<FinancialStats> {
    return mockFinancialStats;
  }

  async getEventsStats(): Promise<EventStats[]> {
    return mockEventsStats;
  }

  async recordEvent(event: InstitutionalEvent): Promise<void> {
    this.events.push(event);
  }
}
