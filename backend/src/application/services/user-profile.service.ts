// Services: lógica de aplicación compartida entre casos de uso.
import { AuthenticatedUser, UserProfile } from "../../domain/entities/user.entity";
import { BackofficeGateway } from "../../domain/gateways/backoffice.gateway";

// Agrega el nombre a mostrar (Backoffice); si no está o Backoffice falla, la parte local del mail.
export class UserProfileService {
  constructor(private readonly backoffice: BackofficeGateway) {}

  async withName(user: AuthenticatedUser): Promise<UserProfile> {
    let name: string | null = null;
    try {
      name = await this.backoffice.getUserDisplayName(user.id);
    } catch (error) {
      console.warn(`[auth] no se pudo leer el nombre de ${user.id} en Backoffice: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { ...user, name: name ?? user.email.split("@")[0] };
  }
}
