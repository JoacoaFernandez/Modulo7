// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.
import { AuthenticatedUser, AuthSession } from "../entities/user.entity";

// CORE (módulo 10): emite y valida los tokens de autenticación.
export interface CoreAuthGateway {
  // null si las credenciales no son válidas.
  login(email: string, password: string): Promise<AuthSession | null>;
  // null si el token no existe o venció.
  validateToken(token: string): Promise<AuthenticatedUser | null>;
}
