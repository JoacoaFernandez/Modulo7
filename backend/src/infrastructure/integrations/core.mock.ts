// Mock de CORE (módulo 10): login, refresh, logout, /auth/me, token de servicio y JWKS con los shapes del
// contrato de integración v1. Firma access tokens RS256 de 15 minutos con un par de claves
// que se genera al arrancar, así la validación de Analítica es la misma que con el CORE real.
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { Jwk, Jwks, signRs256 } from "./jwt";
import { DEMO_PASSWORD, DEMO_USERS, DemoUser } from "./demo-users.mock";

export const CORE_ISSUER = "https://core.uadenet.local";
export const CORE_AUDIENCE = "uadenet";

const ACCESS_TOKEN_TTL_S = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KID = "core-mock-2026";

export interface CoreUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  status: "ACTIVE";
}

export interface CoreLoginResponse {
  accessToken: string;
  expiresIn: number;
  user: CoreUser;
}

export interface CoreSession {
  response: CoreLoginResponse;
  // Va en la cookie HttpOnly; el frontend nunca lo ve.
  refreshToken: string;
}

class CoreMock {
  private readonly keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  private readonly jwk: Jwk = (() => {
    const { kty, n, e } = this.keys.publicKey.export({ format: "jwk" });
    return { kty: kty ?? "RSA", n: n ?? "", e: e ?? "", kid: KID, alg: "RS256", use: "sig" };
  })();
  // refresh token → userId. Rota en cada uso: el anterior deja de valer.
  private readonly refreshTokens = new Map<string, { userId: string; expiresAt: number }>();

  jwks(): Jwks {
    return { keys: [this.jwk] };
  }

  // null si el mail o la contraseña no coinciden (CORE no dice cuál de los dos falló).
  login(email: string, password: string): CoreSession | null {
    const user = DEMO_USERS.find((candidate) => candidate.email === email.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD) return null;

    return this.issueSession(user);
  }

  refresh(refreshToken: string): CoreSession | null {
    const stored = this.refreshTokens.get(refreshToken);
    this.refreshTokens.delete(refreshToken);
    if (!stored || stored.expiresAt <= Date.now()) return null;

    const user = DEMO_USERS.find((candidate) => candidate.userId === stored.userId);
    return user ? this.issueSession(user) : null;
  }

  logout(refreshToken: string): void {
    this.refreshTokens.delete(refreshToken);
  }

  // Token de servicio (POST /internal/v1/service-auth/token). El mock acepta cualquier
  // clientId {modulo}-service con un secret no vacío; el CORE real valida el secret asignado.
  issueServiceToken(clientId: string, clientSecret: string): { accessToken: string; expiresIn: number } | null {
    const service = /^([a-z]+)-service$/.exec(clientId)?.[1];
    if (!service || clientSecret.trim() === "") return null;

    const now = Math.floor(Date.now() / 1000);
    const accessToken = signRs256(
      {
        iss: CORE_ISSUER,
        aud: CORE_AUDIENCE,
        sub: `service:${service}`,
        service,
        scopes: [],
        iat: now,
        exp: now + ACCESS_TOKEN_TTL_S,
        jti: randomUUID(),
      },
      this.keys.privateKey,
      KID,
    );

    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_S };
  }

  findUser(userId: string): CoreUser | null {
    const user = DEMO_USERS.find((candidate) => candidate.userId === userId);
    return user ? toCoreUser(user) : null;
  }

  private issueSession(user: DemoUser): CoreSession {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = signRs256(
      {
        iss: CORE_ISSUER,
        aud: CORE_AUDIENCE,
        sub: user.userId,
        sid: randomUUID(),
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        iat: now,
        exp: now + ACCESS_TOKEN_TTL_S,
        jti: randomUUID(),
      },
      this.keys.privateKey,
      KID,
    );

    const refreshToken = randomBytes(32).toString("base64url");
    this.refreshTokens.set(refreshToken, { userId: user.userId, expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS });

    return { response: { accessToken, expiresIn: ACCESS_TOKEN_TTL_S, user: toCoreUser(user) }, refreshToken };
  }
}

function toCoreUser(user: DemoUser): CoreUser {
  return { id: user.userId, email: user.email, roles: user.roles, permissions: user.permissions, status: "ACTIVE" };
}

export const coreMock = new CoreMock();
