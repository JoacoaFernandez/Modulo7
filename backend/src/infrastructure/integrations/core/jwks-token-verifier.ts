// Verificador contra CORE real: JWKS remoto (cacheado; sólo se refresca ante un `kid` desconocido).
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AccessTokenClaims, AccessTokenVerifier } from "../../../domain/gateways/access-token-verifier";
import { claimsFromPayload } from "./claims";

export class JwksTokenVerifier implements AccessTokenVerifier {
  private readonly jwks;

  constructor(
    jwksUrl: string,
    private readonly issuer: string,
    private readonly audience: string,
  ) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        algorithms: ["RS256"],
        issuer: this.issuer,
        audience: this.audience,
      });
      return claimsFromPayload(payload);
    } catch {
      return null;
    }
  }
}
