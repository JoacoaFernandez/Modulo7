// Repository interfaces: contracts that infrastructure implementations must fulfill.
import { AcademicStats } from "../entities/academic-stats.entity";
import { FinancialStats } from "../entities/financial-stats.entity";
import { EventStats } from "../entities/event-stats.entity";
import { InstitutionalEvent } from "../entities/institutional-event.entity";

export interface AnalyticsRepository {
  getAcademicStats(): Promise<AcademicStats>;
  getFinancialStats(): Promise<FinancialStats>;
  getEventsStats(): Promise<EventStats[]>;
  recordEvent(event: InstitutionalEvent): Promise<void>;
}
