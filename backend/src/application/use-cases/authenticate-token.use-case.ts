// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AuthenticatedUser } from "../../domain/entities/user.entity";
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";

export class AuthenticateTokenUseCase {
  constructor(private readonly coreAuth: CoreAuthGateway) {}

  execute(token: string): Promise<AuthenticatedUser | null> {
    return this.coreAuth.validateToken(token);
  }
}
