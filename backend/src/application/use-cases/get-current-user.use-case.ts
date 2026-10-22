// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { rolesFromPermissions } from "../../domain/entities/role.entity";
import { AuthenticatedUser, SessionUser } from "../../domain/entities/user.entity";
import { BackofficeUsersGateway } from "../../domain/gateways/backoffice-users.gateway";

export class GetCurrentUserUseCase {
  constructor(private readonly backofficeUsers: BackofficeUsersGateway) {}

  // El nombre sale de la ficha de Backoffice; si no está, se muestra el mail.
  async execute(identity: AuthenticatedUser): Promise<SessionUser> {
    const profile = await this.backofficeUsers.getUser(identity.userId);

    return {
      userId: identity.userId,
      email: identity.email,
      displayName: profile ? `${profile.firstName} ${profile.lastName}` : identity.email,
      roles: rolesFromPermissions(identity.permissions),
      permissions: identity.permissions,
    };
  }
}
