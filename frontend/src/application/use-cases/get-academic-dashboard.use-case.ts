// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { AcademicFilters, AcademicStats } from "../../domain/entities/analytics.entity";

export class GetAcademicDashboardUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(filters: AcademicFilters, signal?: AbortSignal): Promise<AcademicStats> {
    return this.analyticsRepository.getAcademicStats(filters, signal);
  }
}
