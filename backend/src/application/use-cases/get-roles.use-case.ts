// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { Role, ROLES } from "../../domain/entities/role.entity";

// Los roles son configuración (los define CORE), no salen de eventos ni de la base.
export class GetRolesUseCase {
  execute(): Role[] {
    return [...ROLES];
  }
}
