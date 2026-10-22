// Use cases: application-specific logic that orchestrates domain entities and repositories.
import type { AuthRepository } from "../../domain/repositories/auth.repository";

export class LogoutUseCase {
  private readonly authRepository: AuthRepository;

  constructor(authRepository: AuthRepository) {
    this.authRepository = authRepository;
  }

  execute(): Promise<void> {
    return this.authRepository.logout();
  }
}
