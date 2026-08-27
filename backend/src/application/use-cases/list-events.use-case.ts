// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { InstitutionalEvent } from "../../domain/entities/institutional-event.entity";

export class ListEventsUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<InstitutionalEvent[]> {
    return this.analyticsRepository.getEvents();
  }
}
