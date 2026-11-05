// Domain entities: core business objects, independent of frameworks and infrastructure.
import { RoleId } from "./role.entity";

// Usuario tal como lo devuelve CORE al loguear (campos que usamos).
export interface CoreUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  status?: string;
}

// Usuario autenticado por CORE (módulo 10). Analítica no guarda usuarios: los lee del JWT.
export interface AuthenticatedUser {
  id: string;
  email: string;
  // Roles de CORE (ACADEMIC_ADMIN, FINANCE_ADMIN, ADMIN...).
  coreRoles: string[];
  permissions: string[];
  // Secciones de Analítica que ve (derivadas de coreRoles y permissions). Un usuario ve el tablero de cada una.
  roles: RoleId[];
}

// Usuario con el nombre a mostrar (de Backoffice; si no está, la parte local del mail).
export interface UserProfile extends AuthenticatedUser {
  name: string;
}

// Respuesta de login/refresh hacia el frontend: el access token (JWT de CORE) va como Bearer.
export interface AuthSession {
  token: string;
  // ISO 8601.
  expiresAt: string;
  user: UserProfile;
}
