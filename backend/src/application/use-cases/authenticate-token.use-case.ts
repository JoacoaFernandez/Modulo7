// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AuthenticatedUser } from "../../domain/entities/user.entity";
import { mapCoreRoles } from "../../domain/entities/role.entity";
import { AccessTokenVerifier } from "../../domain/gateways/access-token-verifier";

export class AuthenticateTokenUseCase {
  constructor(private readonly verifier: AccessTokenVerifier) {}

  // null si el JWT no verifica. Un usuario sin ninguna sección igual se autentica (requireRole le da 403).
  async execute(token: string): Promise<AuthenticatedUser | null> {
    const claims = await this.verifier.verify(token);
    if (!claims) return null;

    return {
      id: claims.userId,
      email: claims.email,
      coreRoles: claims.roles,
      permissions: claims.permissions,
      roles: mapCoreRoles(claims.roles, claims.permissions),
    };
  }
}
