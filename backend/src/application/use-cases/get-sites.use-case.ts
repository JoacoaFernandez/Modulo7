// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { Site } from "../../domain/entities/site.entity";

export class GetSitesUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<Site[]> {
    return this.analyticsRepository.getSites();
  }
}
