// Repository interfaces: contracts that infrastructure implementations must fulfill.
import { AcademicStats } from "../entities/academic-stats.entity";
import { EventSource } from "../entities/event-source.entity";
import { EventStats } from "../entities/event-stats.entity";
import { AcademicFilters, FilterDefaults, FinancialFilters } from "../entities/filters.entity";
import { FinancialStats } from "../entities/financial-stats.entity";
import { InstitutionalEvent } from "../entities/institutional-event.entity";
import { Period } from "../entities/period.entity";
import { Role } from "../entities/role.entity";
import { Site } from "../entities/site.entity";

export interface AnalyticsRepository {
  getAcademicStats(filters: AcademicFilters): Promise<AcademicStats>;
  getFinancialStats(filters: FinancialFilters): Promise<FinancialStats>;
  getEventsStats(filters: FinancialFilters): Promise<EventStats>;
  getSites(): Promise<Site[]>;
  getQuarters(): Promise<Period[]>;
  getMonths(): Promise<Period[]>;
  getFilterDefaults(): Promise<FilterDefaults>;
  getRoles(): Promise<Role[]>;
  getEventSources(): Promise<EventSource[]>;
  getEvents(): Promise<InstitutionalEvent[]>;
  recordEvent(event: InstitutionalEvent): Promise<void>;
}
