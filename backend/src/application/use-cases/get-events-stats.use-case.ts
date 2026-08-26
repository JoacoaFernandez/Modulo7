// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { EventStats } from "../../domain/entities/event-stats.entity";

export class GetEventsStatsUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<EventStats[]> {
    return this.analyticsRepository.getEventsStats();
  }
}
