// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { EventStats } from "../../domain/entities/analytics.entity";

export class GetEventsStatsUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(): Promise<EventStats[]> {
    return this.analyticsRepository.getEventsStats();
  }
}
