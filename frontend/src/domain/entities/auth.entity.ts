// Domain entities: core business objects, independent of frameworks and infrastructure.
import type { RoleId } from "./analytics.entity";

// Usuario autenticado por CORE (módulo 10).
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  // Roles de CORE (ACADEMIC_ADMIN, FINANCE_ADMIN, ADMIN...).
  coreRoles: string[];
  permissions: string[];
  // Secciones de Analítica que ve (derivadas por el backend de coreRoles y permissions).
  roles: RoleId[];
}

export interface AuthSession {
  token: string;
  // ISO 8601.
  expiresAt: string;
  user: AuthUser;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
