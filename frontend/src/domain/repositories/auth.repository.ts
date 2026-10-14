// Repository interfaces: contracts that infrastructure implementations must fulfill.
import type { AuthSession, LoginCredentials } from "../entities/auth.entity";

export interface AuthRepository {
  login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthSession>;
}
