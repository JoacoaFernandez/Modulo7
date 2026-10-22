// Domain entities: core business objects, independent of frameworks and infrastructure.
import type { RoleId } from "./analytics.entity";

// Usuario del portal de Analítica (GET /me): identidad de CORE (módulo 10) más el nombre
// que sale de Backoffice. Los permisos son {modulo}:{recurso}:{acción}.
export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
  roles: RoleId[];
  permissions: string[];
}

export interface AuthSession {
  // Access token de CORE (JWT de 15 min). Vive solo en memoria; el refresh va en cookie HttpOnly.
  accessToken: string;
  // ISO 8601, calculado a partir de expiresIn.
  expiresAt: string;
  user: SessionUser;
}

// Respuesta de login/refresh de CORE sin el usuario.
export interface AccessTokenGrant {
  accessToken: string;
  // Segundos de vida del access token.
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
