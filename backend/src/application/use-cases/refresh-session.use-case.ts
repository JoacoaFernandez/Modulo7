// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { mapCoreRoles } from "../../domain/entities/role.entity";
import { AccessTokenVerifier } from "../../domain/gateways/access-token-verifier";
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";
import { ProblemError } from "../../shared/problem-error";
import { UserProfileService } from "../services/user-profile.service";
import { LoginResult, translateCoreAuthError } from "./login.use-case";

// Renueva el access token con la cookie de refresh (que rota en cada uso). Devuelve la misma sesión que el login.
export class RefreshSessionUseCase {
  constructor(
    private readonly coreAuth: CoreAuthGateway,
    private readonly verifier: AccessTokenVerifier,
    private readonly profiles: UserProfileService,
  ) {}

  async execute(cookieHeader: string | undefined): Promise<LoginResult> {
    let result;
    try {
      result = await this.coreAuth.refresh(cookieHeader);
    } catch (error) {
      throw translateCoreAuthError(error, "AUTH_REFRESH_INVALID");
    }

    const claims = await this.verifier.verify(result.accessToken);
    if (!claims) throw new ProblemError(401, "AUTH_REFRESH_INVALID", "CORE devolvió un token que no se pudo verificar.");

    const roles = mapCoreRoles(claims.roles, claims.permissions);
    if (roles.length === 0) throw new ProblemError(403, "ANALYTICS_FORBIDDEN", "Tu usuario no tiene acceso a Analítica.");

    const user = await this.profiles.withName({
      id: claims.userId,
      email: claims.email,
      coreRoles: claims.roles,
      permissions: claims.permissions,
      roles,
    });

    return {
      session: { token: result.accessToken, expiresAt: new Date(claims.expiresAt * 1000).toISOString(), user },
      setCookie: result.setCookie,
    };
  }
}
