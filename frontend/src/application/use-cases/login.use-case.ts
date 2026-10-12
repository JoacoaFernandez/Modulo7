// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AuthRepository } from "../../domain/repositories/auth.repository";
import type { AuthSession, LoginCredentials } from "../../domain/entities/auth.entity";

export class LoginUseCase {
  private readonly authRepository: AuthRepository;

  constructor(authRepository: AuthRepository) {
    this.authRepository = authRepository;
  }

  execute(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthSession> {
    return this.authRepository.login(credentials, signal);
  }
}
