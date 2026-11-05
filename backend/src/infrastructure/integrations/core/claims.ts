// Payload de un JWT de CORE → claims que usa Analítica. null si falta algo imprescindible.
import type { JWTPayload } from "jose";
import { AccessTokenClaims } from "../../../domain/gateways/access-token-verifier";

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function claimsFromPayload(payload: JWTPayload): AccessTokenClaims | null {
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
  const email = typeof payload.email === "string" ? payload.email : "";

  return {
    userId: payload.sub,
    sessionId: typeof payload.sid === "string" ? payload.sid : null,
    email,
    roles: stringList(payload.roles),
    permissions: stringList(payload.permissions),
    careerIds: stringList(payload.careerIds),
    expiresAt: payload.exp,
  };
}
