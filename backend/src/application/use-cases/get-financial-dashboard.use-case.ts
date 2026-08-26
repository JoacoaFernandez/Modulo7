// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";

export class GetFinancialDashboardUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<FinancialStats> {
    return this.analyticsRepository.getFinancialStats();
  }
}
