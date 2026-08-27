// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import type { Role } from "../../domain/entities/analytics.entity";

export class GetRolesUseCase {
  private readonly analyticsRepository: AnalyticsRepository;

  constructor(analyticsRepository: AnalyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  execute(signal?: AbortSignal): Promise<Role[]> {
    return this.analyticsRepository.getRoles(signal);
  }
}
