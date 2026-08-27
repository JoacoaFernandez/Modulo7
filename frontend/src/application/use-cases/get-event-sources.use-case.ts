// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { EventSource } from "../../domain/entities/analytics.entity";

export class GetEventSourcesUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(signal?: AbortSignal): Promise<EventSource[]> {
    return this.analyticsRepository.getEventSources(signal);
  }
}
