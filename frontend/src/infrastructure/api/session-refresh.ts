// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Refresh serializado: el refresh token rota en cada uso, así que dos refresh en paralelo invalidarían
// al segundo. Todos los que lo piden (restauración al cargar, 401 de varios tableros) comparten una
// única promesa en vuelo.
import type { AuthSession } from "../../domain/entities/auth.entity";
import { authClient } from "./auth.client";
import { authTokenStore } from "./auth-token.store";

let inFlight: Promise<AuthSession> | null = null;

export function refreshSession(): Promise<AuthSession> {
  if (!inFlight) {
    inFlight = authClient
      .refresh()
      .then((session) => {
        authTokenStore.set(session.token);
        authTokenStore.notifyRefreshed(session);
        return session;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
