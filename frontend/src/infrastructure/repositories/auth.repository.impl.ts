// Repository implementations: concrete adapters (e.g. API-backed) for the domain repository interfaces.
import type { AuthRepository } from "../../domain/repositories/auth.repository";
import type { AuthSession, LoginCredentials } from "../../domain/entities/auth.entity";
import { authClient } from "../api/auth.client";

export class AuthRepositoryImpl implements AuthRepository {
  login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthSession> {
    return authClient.login(credentials, signal);
  }

  restoreSession(signal?: AbortSignal): Promise<AuthSession> {
    return authClient.restore(signal);
  }

  logout(): Promise<void> {
    return authClient.logout();
  }
}
