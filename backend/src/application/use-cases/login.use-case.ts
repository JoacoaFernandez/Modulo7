// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { AuthSession } from "../../domain/entities/user.entity";
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";
import { LoginDto } from "../dtos/auth.dto";

export class LoginUseCase {
  constructor(private readonly coreAuth: CoreAuthGateway) {}

  // null cuando CORE rechaza las credenciales.
  execute(dto: LoginDto): Promise<AuthSession | null> {
    return this.coreAuth.login(dto.email, dto.password);
  }
}
