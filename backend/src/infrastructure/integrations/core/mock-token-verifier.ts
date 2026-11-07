// Verificador del CORE mock: valida contra la clave pública local (sin JWKS).
import { jwtVerify } from "jose";
import { AccessTokenClaims, AccessTokenVerifier } from "../../../domain/gateways/access-token-verifier";
import { claimsFromPayload } from "./claims";
import { loadMockKeys, MOCK_ISSUER } from "./mock-keys";

export class MockTokenVerifier implements AccessTokenVerifier {
  constructor(private readonly audience: string) {}

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, loadMockKeys().publicKey, {
        algorithms: ["RS256"],
        issuer: MOCK_ISSUER,
        audience: this.audience,
      });
      return claimsFromPayload(payload);
    } catch {
      return null;
    }
  }
}
