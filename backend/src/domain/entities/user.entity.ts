// Domain entities: core business objects, independent of frameworks and infrastructure.
import { RoleId } from "./role.entity";

// Usuario autenticado por CORE (módulo 10). Analítica no guarda usuarios: los recibe de CORE.
export interface AuthenticatedUser {
  email: string;
  name: string;
  // Un usuario puede tener varios roles; ve el tablero de cada uno.
  roles: RoleId[];
}

// Respuesta de login de CORE: token opaco que el frontend manda como Bearer.
export interface AuthSession {
  token: string;
  // ISO 8601.
  expiresAt: string;
  user: AuthenticatedUser;
}
