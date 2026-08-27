// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { EventSource } from "../../domain/entities/event-source.entity";

export class GetEventSourcesUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<EventSource[]> {
    return this.analyticsRepository.getEventSources();
  }
}
