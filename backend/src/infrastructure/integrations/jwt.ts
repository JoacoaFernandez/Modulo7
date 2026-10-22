// JWT RS256 con node:crypto, sin dependencias. La verificación es la misma que usará el
// gateway real de CORE: firma contra el JWKS publicado y chequeo local de iss, aud y exp.
import { createPublicKey, sign, verify, type KeyObject } from "node:crypto";

// Clave pública RSA en formato JWK, como la publica CORE en /.well-known/jwks.json.
export interface Jwk {
  kty: string;
  n: string;
  e: string;
  kid: string;
  alg: "RS256";
  use: "sig";
}

export interface Jwks {
  keys: Jwk[];
}

export type JwtClaims = Record<string, unknown> & { exp: number; iss: string; aud: string };

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function signRs256(claims: JwtClaims, privateKey: KeyObject, kid: string): string {
  const unsigned = `${encode({ alg: "RS256", typ: "JWT", kid })}.${encode(claims)}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");

  return `${unsigned}.${signature}`;
}

// null si el token está mal formado, la firma no corresponde a ninguna clave del JWKS, o
// no coinciden iss/aud, o ya venció.
export function verifyRs256(
  token: string,
  jwks: Jwks,
  expected: { issuer: string; audience: string },
): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, claimsPart, signaturePart] = parts;

  try {
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString()) as { alg?: string; kid?: string };
    const jwk = jwks.keys.find((key) => key.kid === header.kid);
    if (header.alg !== "RS256" || !jwk) return null;

    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const valid = verify(
      "RSA-SHA256",
      Buffer.from(`${headerPart}.${claimsPart}`),
      publicKey,
      Buffer.from(signaturePart, "base64url"),
    );
    if (!valid) return null;

    const claims = JSON.parse(Buffer.from(claimsPart, "base64url").toString()) as JwtClaims;
    if (claims.iss !== expected.issuer || claims.aud !== expected.audience) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;

    return claims;
  } catch {
    return null;
  }
}
