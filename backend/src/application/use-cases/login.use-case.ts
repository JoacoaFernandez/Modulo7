// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AuthSession } from "../../domain/entities/user.entity";
import { mapCoreRoles } from "../../domain/entities/role.entity";
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";
import { GatewayError } from "../../domain/gateways/gateway-error";
import { ProblemError } from "../../shared/problem-error";
import { LoginDto } from "../dtos/auth.dto";
import { UserProfileService } from "../services/user-profile.service";

export interface LoginResult {
  session: AuthSession;
  // Set-Cookie de refresh tal como lo manda CORE (sin reescribir).
  setCookie: string | null;
}

// Traduce los errores de CORE (login/refresh) a problemas HTTP con mensaje en castellano.
export function translateCoreAuthError(error: unknown, invalidCode = "AUTH_INVALID_CREDENTIALS"): unknown {
  if (!(error instanceof GatewayError)) return error;
  if (error.status === 401) {
    return new ProblemError(401, invalidCode, invalidCode === "AUTH_INVALID_CREDENTIALS" ? "Mail o contraseña incorrectos." : "Tu sesión venció. Iniciá sesión de nuevo.");
  }
  if (error.status === 403) return new ProblemError(403, "AUTH_IDENTITY_SUSPENDED", "Tu cuenta está suspendida. Contactá a Backoffice.");
  if (error.status === 429) return new ProblemError(429, "RATE_LIMITED", "Demasiados intentos. Probá de nuevo en un minuto.");
  return error;
}

export class LoginUseCase {
  constructor(
    private readonly coreAuth: CoreAuthGateway,
    private readonly profiles: UserProfileService,
  ) {}

  // Lanza ProblemError: 401 credenciales, 403 suspendida, 403 ANALYTICS_FORBIDDEN (CORE autenticó pero ningún
  // rol mapea a una sección: se cierra la sesión en CORE), 429 rate limit. Otro fallo de CORE sube como GatewayError.
  async execute(dto: LoginDto): Promise<LoginResult> {
    let result;
    try {
      result = await this.coreAuth.login(dto.email, dto.password);
    } catch (error) {
      throw translateCoreAuthError(error);
    }

    const roles = mapCoreRoles(result.user.roles, result.user.permissions);
    if (roles.length === 0) {
      // La cookie de refresh nunca llega al navegador: se cierra la sesión recién abierta en CORE.
      await this.coreAuth.logout(cookieHeaderFrom(result.setCookie)).catch(() => undefined);
      throw new ProblemError(403, "ANALYTICS_FORBIDDEN", "Tu usuario no tiene acceso a Analítica.");
    }

    const user = await this.profiles.withName({
      id: result.user.id,
      email: result.user.email,
      coreRoles: result.user.roles,
      permissions: result.user.permissions,
      roles,
    });

    return {
      session: { token: result.accessToken, expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(), user },
      setCookie: result.setCookie,
    };
  }
}

// "name=value" de un Set-Cookie, para usarlo como header Cookie.
export function cookieHeaderFrom(setCookie: string | null): string | undefined {
  return setCookie?.split(";")[0] || undefined;
}
