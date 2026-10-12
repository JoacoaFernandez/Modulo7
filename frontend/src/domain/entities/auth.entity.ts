// Domain entities: core business objects, independent of frameworks and infrastructure.
import type { RoleId } from "./analytics.entity";

// Usuario autenticado por CORE (módulo 10).
export interface AuthUser {
  email: string;
  name: string;
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
