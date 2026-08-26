// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";

export class GetAcademicDashboardUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<AcademicStats> {
    return this.analyticsRepository.getAcademicStats();
  }
}
