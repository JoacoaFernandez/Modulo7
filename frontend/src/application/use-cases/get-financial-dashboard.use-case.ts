// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { FinancialStats } from "../../domain/entities/analytics.entity";

export class GetFinancialDashboardUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(): Promise<FinancialStats> {
    return this.analyticsRepository.getFinancialStats();
  }
}
