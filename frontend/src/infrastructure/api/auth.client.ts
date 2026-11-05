// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Auth contra CORE a través del proxy del backend (/api/auth). El refresh token viaja en una cookie
// HttpOnly (Path=/api/auth), por eso todas las llamadas van con `credentials: "include"`.
import type { AuthSession, LoginCredentials } from "../../domain/entities/auth.entity";
import { API_BASE_URL, toApiError } from "./http";

export const authClient = {
  async login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthSession> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      signal,
    });
    if (!response.ok) throw await toApiError(response, "No se pudo iniciar sesión");
    return (await response.json()) as AuthSession;
  },

  // Renueva el access token con la cookie de refresh (que rota en cada uso). Misma forma que login.
  async refresh(signal?: AbortSignal): Promise<AuthSession> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include", signal });
    if (!response.ok) throw await toApiError(response, "No se pudo renovar la sesión");
    return (await response.json()) as AuthSession;
  },

  // Revoca el refresh token y borra la cookie. Un fallo de red no impide cerrar la sesión local.
  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
  },
};
