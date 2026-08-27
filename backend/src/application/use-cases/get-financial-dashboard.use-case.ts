// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";
import { FinancialFilters } from "../../domain/entities/filters.entity";

export class GetFinancialDashboardUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(filters: FinancialFilters): Promise<FinancialStats> {
    return this.analyticsRepository.getFinancialStats(filters);
  }
}
