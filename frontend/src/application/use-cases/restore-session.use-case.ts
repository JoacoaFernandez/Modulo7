// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AuthRepository } from "../../domain/repositories/auth.repository";
import type { AuthSession } from "../../domain/entities/auth.entity";

export class RestoreSessionUseCase {
  private readonly authRepository: AuthRepository;

  constructor(authRepository: AuthRepository) {
    this.authRepository = authRepository;
  }

  execute(signal?: AbortSignal): Promise<AuthSession> {
    return this.authRepository.restoreSession(signal);
  }
}
