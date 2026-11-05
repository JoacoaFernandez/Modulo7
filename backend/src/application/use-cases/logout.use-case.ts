// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";

export class LogoutUseCase {
  constructor(private readonly coreAuth: CoreAuthGateway) {}

  // Si CORE falla igual se limpia la cookie local (devuelve el Set-Cookie que la borra, si CORE lo mandó).
  async execute(cookieHeader: string | undefined): Promise<string | null> {
    try {
      return (await this.coreAuth.logout(cookieHeader)).setCookie;
    } catch (error) {
      console.warn(`[auth] logout en CORE falló: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
