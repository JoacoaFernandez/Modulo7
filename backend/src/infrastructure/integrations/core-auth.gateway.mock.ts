// Gateway hacia CORE (módulo 10) para validar access tokens. Toma el JWKS del mock de CORE;
// el gateway real lo descargaría de GET /.well-known/jwks.json, lo cachearía y sólo lo
// refrescaría ante un kid desconocido. La verificación (jwt.ts) es la misma en los dos casos.
import { AuthenticatedUser } from "../../domain/entities/user.entity";
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";
import { CORE_AUDIENCE, CORE_ISSUER, coreMock } from "./core.mock";
import { verifyRs256 } from "./jwt";

export class CoreAuthGatewayMock implements CoreAuthGateway {
  async verifyAccessToken(token: string): Promise<AuthenticatedUser | null> {
    const claims = verifyRs256(token, coreMock.jwks(), { issuer: CORE_ISSUER, audience: CORE_AUDIENCE });
    // Un token de servicio (sub service:*) no representa a una persona: no abre los tableros.
    if (!claims || typeof claims.sub !== "string" || claims.sub.startsWith("service:")) return null;

    return {
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : "",
      roles: stringList(claims.roles),
      permissions: stringList(claims.permissions),
    };
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
