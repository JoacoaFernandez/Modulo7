// Repository interfaces: contracts that infrastructure implementations must fulfill.
import type { AcademicStats, FinancialStats, EventStats } from "../entities/analytics.entity";

export interface AnalyticsRepository {
  getAcademicStats(): Promise<AcademicStats>;
  getFinancialStats(): Promise<FinancialStats>;
  getEventsStats(): Promise<EventStats[]>;
}
