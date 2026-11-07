// Repository interfaces: contracts that infrastructure implementations must fulfill.
import { AcademicStats } from "../entities/academic-stats.entity";
import { EventSource } from "../entities/event-source.entity";
import { EventStats } from "../entities/event-stats.entity";
import { AcademicFilters, Faculty, FilterDefaults, FilterOptions, FinancialFilters } from "../entities/filters.entity";
import { FinancialStats } from "../entities/financial-stats.entity";
import { Period } from "../entities/period.entity";
import { Site } from "../entities/site.entity";

export interface AnalyticsRepository {
  getAcademicStats(filters: AcademicFilters): Promise<AcademicStats>;
  getFinancialStats(filters: FinancialFilters): Promise<FinancialStats>;
  getEventsStats(filters: FinancialFilters): Promise<EventStats>;
  getSites(): Promise<Site[]>;
  getQuarters(): Promise<Period[]>;
  getMonths(): Promise<Period[]>;
  getFaculties(): Promise<Faculty[]>;
  getFilterDefaults(): Promise<FilterDefaults>;
  // Todos los catálogos de los filtros (con warnings si una fuente falló).
  getFilterOptions(): Promise<FilterOptions>;
  getEventSources(): Promise<EventSource[]>;
}
