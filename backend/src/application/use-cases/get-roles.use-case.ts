// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { Role } from "../../domain/entities/role.entity";

export class GetRolesUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(): Promise<Role[]> {
    return this.analyticsRepository.getRoles();
  }
}
