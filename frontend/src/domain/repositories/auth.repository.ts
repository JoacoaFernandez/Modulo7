// Repository interfaces: contracts that infrastructure implementations must fulfill.
import type { AuthSession, LoginCredentials } from "../entities/auth.entity";

export interface AuthRepository {
  login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthSession>;
  // Reabre la sesión con la cookie de refresh; falla si no hay una sesión vigente.
  restoreSession(signal?: AbortSignal): Promise<AuthSession>;
  logout(): Promise<void>;
}
