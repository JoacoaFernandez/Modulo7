// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; con el flag *_MOCK=true se usa un mock que lee backend/mocks/.
import { CoreUser } from "../entities/user.entity";

// Respuesta de login/refresh de CORE. `setCookie` es el Set-Cookie de refresh tal como lo manda CORE
// (Path=/api/v1/auth): el controller lo reescribe antes de dárselo al navegador.
export interface CoreTokenResult {
  accessToken: string;
  // Segundos de vida del access token (CORE: 900).
  expiresIn: number;
  setCookie: string | null;
}

export interface CoreLoginResult extends CoreTokenResult {
  user: CoreUser;
}

// CORE (módulo 10): autenticación de usuarios. Los errores salen como GatewayError con el `code` de CORE
// (AUTH_INVALID_CREDENTIALS, AUTH_IDENTITY_SUSPENDED, RATE_LIMITED...).
export interface CoreAuthGateway {
  login(email: string, password: string): Promise<CoreLoginResult>;
  // `cookieHeader` es el header Cookie del navegador (contiene el refresh token).
  refresh(cookieHeader: string | undefined): Promise<CoreTokenResult>;
  // Devuelve el Set-Cookie que borra la cookie de refresh.
  logout(cookieHeader: string | undefined): Promise<{ setCookie: string | null }>;
}
