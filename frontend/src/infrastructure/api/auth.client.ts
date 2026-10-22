// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Auth contra CORE (hoy un mock servido por el mismo backend en /api/v1/auth). El refresh token
// viaja en una cookie HttpOnly, por eso todos los pedidos van con credentials: "include".
import type { AccessTokenGrant, AuthSession, LoginCredentials, SessionUser } from "../../domain/entities/auth.entity";
import { toProblemError } from "./problem";

const CORE_BASE_URL = import.meta.env.VITE_CORE_BASE_URL ?? "http://localhost:3000/api/v1";
const ANALYTICS_BASE_URL = import.meta.env.VITE_ANALYTICS_BASE_URL ?? "http://localhost:3000/api/v1";

function toSession(grant: AccessTokenGrant, user: SessionUser): AuthSession {
  return {
    accessToken: grant.accessToken,
    expiresAt: new Date(Date.now() + grant.expiresIn * 1000).toISOString(),
    user,
  };
}

async function getMe(accessToken: string, signal?: AbortSignal): Promise<SessionUser> {
  const response = await fetch(`${ANALYTICS_BASE_URL}/me`, {
    signal,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await toProblemError(response, "No se pudo obtener el usuario");
  return (await response.json()) as SessionUser;
}

// Los refresh tokens rotan en cada uso: dos refresh en paralelo invalidarían uno de los dos,
// así que todos los llamadores comparten el pedido en vuelo.
let refreshInFlight: Promise<AccessTokenGrant> | null = null;

function refreshAccessToken(): Promise<AccessTokenGrant> {
  refreshInFlight ??= (async () => {
    const response = await fetch(`${CORE_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!response.ok) throw await toProblemError(response, "La sesión expiró");
    return (await response.json()) as AccessTokenGrant;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export const authClient = {
  async login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthSession> {
    const response = await fetch(`${CORE_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(credentials),
      signal,
    });
    if (!response.ok) throw await toProblemError(response, "No se pudo iniciar sesión");

    const grant = (await response.json()) as AccessTokenGrant;
    return toSession(grant, await getMe(grant.accessToken, signal));
  },

  // Nuevo access token a partir de la cookie de refresh (serializado, ver arriba).
  refresh: refreshAccessToken,

  // Reabre la sesión al cargar la app: refresh con la cookie y después /me.
  async restore(signal?: AbortSignal): Promise<AuthSession> {
    const grant = await refreshAccessToken();
    return toSession(grant, await getMe(grant.accessToken, signal));
  },

  async logout(): Promise<void> {
    await fetch(`${CORE_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
  },
};
