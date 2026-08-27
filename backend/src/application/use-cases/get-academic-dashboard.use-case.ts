// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";
import { AcademicFilters } from "../../domain/entities/filters.entity";

export class GetAcademicDashboardUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(filters: AcademicFilters): Promise<AcademicStats> {
    return this.analyticsRepository.getAcademicStats(filters);
  }
}
