// CORE mock: login contra mocks/core/users.json (se relee en cada llamada), JWT RS256 firmado con el par local y
// cookie de refresh con un id opaco que refresh y logout reconocen en memoria.
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { CoreAuthGateway, CoreLoginResult, CoreTokenResult } from "../../../domain/gateways/core-auth.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { CoreUser } from "../../../domain/entities/user.entity";
import { MockFileStore } from "../mock/mock-file-store";
import { loadMockKeys, MOCK_ISSUER, MOCK_KEY_ID } from "./mock-keys";

const ACCESS_TTL_SECONDS = 900;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = "refresh_token";
const CORE_COOKIE_PATH = "/api/v1/auth";

interface MockUser extends CoreUser {
  password: string;
  careerIds?: string[];
}

interface RefreshSession {
  userId: string;
  expiresAt: number;
}

export class CoreAuthGatewayMock implements CoreAuthGateway {
  private readonly refreshSessions = new Map<string, RefreshSession>();

  constructor(
    private readonly store: MockFileStore,
    private readonly audience: string,
  ) {}

  async login(email: string, password: string): Promise<CoreLoginResult> {
    const users = await this.users();
    const user = users.find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase() && candidate.password === password);
    if (!user) throw new GatewayError("core", 401, "AUTH_INVALID_CREDENTIALS", "Credenciales inválidas.");
    if (user.status === "SUSPENDED") throw new GatewayError("core", 403, "AUTH_IDENTITY_SUSPENDED", "La identidad está suspendida.");

    const refreshId = randomUUID();
    this.refreshSessions.set(refreshId, { userId: user.id, expiresAt: Date.now() + REFRESH_TTL_SECONDS * 1000 });

    return {
      accessToken: await this.sign(user),
      expiresIn: ACCESS_TTL_SECONDS,
      setCookie: refreshCookie(refreshId, REFRESH_TTL_SECONDS),
      user: { id: user.id, email: user.email, roles: user.roles, permissions: user.permissions, status: user.status },
    };
  }

  // El refresh rota en cada uso, como el real.
  async refresh(cookieHeader: string | undefined): Promise<CoreTokenResult> {
    const refreshId = readCookie(cookieHeader, REFRESH_COOKIE_NAME);
    const session = refreshId ? this.refreshSessions.get(refreshId) : undefined;
    if (!refreshId || !session || session.expiresAt <= Date.now()) {
      if (refreshId) this.refreshSessions.delete(refreshId);
      throw new GatewayError("core", 401, "AUTH_REFRESH_INVALID", "El refresh token no es válido o venció.");
    }
    this.refreshSessions.delete(refreshId);

    const user = (await this.users()).find((candidate) => candidate.id === session.userId);
    if (!user || user.status === "SUSPENDED") {
      throw new GatewayError("core", 401, "AUTH_REFRESH_INVALID", "El usuario ya no puede iniciar sesión.");
    }

    const nextId = randomUUID();
    this.refreshSessions.set(nextId, { userId: user.id, expiresAt: Date.now() + REFRESH_TTL_SECONDS * 1000 });
    return { accessToken: await this.sign(user), expiresIn: ACCESS_TTL_SECONDS, setCookie: refreshCookie(nextId, REFRESH_TTL_SECONDS) };
  }

  async logout(cookieHeader: string | undefined): Promise<{ setCookie: string | null }> {
    const refreshId = readCookie(cookieHeader, REFRESH_COOKIE_NAME);
    if (refreshId) this.refreshSessions.delete(refreshId);
    return { setCookie: refreshCookie("", 0) };
  }

  private async users(): Promise<MockUser[]> {
    const content = await this.store.readRequired("core", "users.json");
    if (!Array.isArray(content)) throw new GatewayError("core", 500, "MOCK_INVALID_JSON", "mocks/core/users.json debe ser una lista de usuarios.");
    return content as MockUser[];
  }

  private sign(user: MockUser): Promise<string> {
    return new SignJWT({
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      careerIds: user.careerIds ?? [],
      sid: randomUUID(),
    })
      .setProtectedHeader({ alg: "RS256", kid: MOCK_KEY_ID })
      .setSubject(user.id)
      .setIssuer(MOCK_ISSUER)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .setJti(randomUUID())
      .sign(loadMockKeys().privateKey);
  }
}

// Set-Cookie al estilo de CORE (Path=/api/v1/auth); el controller lo reescribe a /api/auth.
function refreshCookie(value: string, maxAgeSeconds: number): string {
  return `${REFRESH_COOKIE_NAME}=${value}; Max-Age=${maxAgeSeconds}; Path=${CORE_COOKIE_PATH}; HttpOnly; SameSite=Lax`;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || undefined;
  }
  return undefined;
}
