// Domain entities: core business objects, independent of frameworks and infrastructure.
import { RoleId } from "./role.entity";

// Identidad que viaja en el access token de CORE (claims sub, email, roles, permissions).
// Analítica no guarda usuarios: valida el token y lee los claims.
export interface AuthenticatedUser {
  userId: string;
  email: string;
  // Roles del catálogo de CORE: STUDENT, TEACHER, ADMIN, ACADEMIC_ADMIN, FINANCE_ADMIN, etc.
  roles: string[];
  // Permisos {modulo}:{recurso}:{acción}; los de Analítica son analytics:*.
  permissions: string[];
}

// Usuario del portal de Analítica (GET /api/v1/me): la identidad de CORE más el nombre que
// sale de la ficha de Backoffice y los tableros que habilitan sus permisos.
export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
  roles: RoleId[];
  permissions: string[];
}
