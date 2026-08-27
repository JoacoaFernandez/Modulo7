// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { FilterOptions } from "../../domain/entities/analytics.entity";

export class GetFiltersUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(signal?: AbortSignal): Promise<FilterOptions> {
    return this.analyticsRepository.getFilters(signal);
  }
}
