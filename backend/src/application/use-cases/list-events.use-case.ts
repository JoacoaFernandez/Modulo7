// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { StoredCoreEvent } from "../../domain/entities/core-event.entity";

export class ListEventsUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<StoredCoreEvent[]> {
    return this.analyticsRepository.getEvents();
  }
}
