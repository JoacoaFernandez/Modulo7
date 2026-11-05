// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { FilterOptions } from "../../domain/entities/filters.entity";

export class GetFiltersUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<FilterOptions> {
    return this.analyticsRepository.getFilterOptions();
  }
}
