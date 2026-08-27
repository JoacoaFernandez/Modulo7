// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { FilterOptions } from "../../domain/entities/filters.entity";

export class GetFiltersUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async execute(): Promise<FilterOptions> {
    const [sites, quarters, months, defaults] = await Promise.all([
      this.analyticsRepository.getSites(),
      this.analyticsRepository.getQuarters(),
      this.analyticsRepository.getMonths(),
      this.analyticsRepository.getFilterDefaults(),
    ]);

    return { sites, quarters, months, defaults };
  }
}
