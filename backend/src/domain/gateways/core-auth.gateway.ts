// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.
import { AuthenticatedUser } from "../entities/user.entity";

// CORE (módulo 10): emite los tokens. Analítica sólo los valida, localmente contra el JWKS.
export interface CoreAuthGateway {
  // null si el token está mal firmado, no es para Analítica o venció.
  verifyAccessToken(token: string): Promise<AuthenticatedUser | null>;
}
