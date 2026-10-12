// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Login contra CORE (hoy un mock servido por el mismo backend en /api/auth).
import type { AuthSession, LoginCredentials } from "../../domain/entities/auth.entity";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export const authClient = {
  async login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthSession> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      signal,
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? `No se pudo iniciar sesión (${response.status}).`);
    }

    return body as unknown as AuthSession;
  },
};
