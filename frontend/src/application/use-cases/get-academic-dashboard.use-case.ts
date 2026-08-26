// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { AcademicStats } from "../../domain/entities/analytics.entity";

export class GetAcademicDashboardUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(): Promise<AcademicStats> {
    return this.analyticsRepository.getAcademicStats();
  }
}
