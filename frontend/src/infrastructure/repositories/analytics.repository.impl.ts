// Repository implementations: concrete adapters (e.g. API-backed) for the domain repository interfaces.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type {
  AcademicFilters,
  AcademicStats,
  EventSource,
  EventStats,
  FilterOptions,
  FinancialFilters,
  FinancialStats,
  Role,
} from "../../domain/entities/analytics.entity";
import { analyticsClient } from "../api/analytics.client";

export class AnalyticsRepositoryImpl implements AnalyticsRepository {
  getAcademicStats(filters: AcademicFilters, signal?: AbortSignal): Promise<AcademicStats> {
    return analyticsClient.getAcademicStats(filters, signal);
  }

  getFinancialStats(filters: FinancialFilters, signal?: AbortSignal): Promise<FinancialStats> {
    return analyticsClient.getFinancialStats(filters, signal);
  }

  getEventsStats(filters: FinancialFilters, signal?: AbortSignal): Promise<EventStats> {
    return analyticsClient.getEventsStats(filters, signal);
  }

  getFilters(signal?: AbortSignal): Promise<FilterOptions> {
    return analyticsClient.getFilters(signal);
  }

  getRoles(signal?: AbortSignal): Promise<Role[]> {
    return analyticsClient.getRoles(signal);
  }

  getEventSources(signal?: AbortSignal): Promise<EventSource[]> {
    return analyticsClient.getEventSources(signal);
  }
}
