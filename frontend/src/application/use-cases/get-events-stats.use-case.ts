// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { EventStats, FinancialFilters } from "../../domain/entities/analytics.entity";

// El backend agrega los eventos en un único objeto por sede/período (ver EventStats),
// no en una lista: se filtra por los mismos parámetros que el tablero financiero.
export class GetEventsStatsUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(filters: FinancialFilters, signal?: AbortSignal): Promise<EventStats> {
    return this.analyticsRepository.getEventsStats(filters, signal);
  }
}
