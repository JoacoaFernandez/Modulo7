// Repository implementations: concrete adapters (e.g. API-backed) for the domain repository interfaces.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { AcademicStats, FinancialStats, EventStats } from "../../domain/entities/analytics.entity";
import { analyticsClient } from "../api/analytics.client";

export class AnalyticsRepositoryImpl implements AnalyticsRepository {
  getAcademicStats(): Promise<AcademicStats> {
    return analyticsClient.getAcademicStats();
  }

  getFinancialStats(): Promise<FinancialStats> {
    return analyticsClient.getFinancialStats();
  }

  getEventsStats(): Promise<EventStats[]> {
    return analyticsClient.getEventsStats();
  }
}
