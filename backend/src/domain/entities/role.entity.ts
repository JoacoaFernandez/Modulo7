// Domain entities: core business objects, independent of frameworks and infrastructure.

// Perfil de Analítica. No es un rol de CORE: se deriva del permiso analytics:* que Backoffice
// le asigna a cada persona.
export type RoleId = "academica" | "financiera";

export type DashboardId = "academic" | "financial" | "events";

export interface Role {
  id: RoleId;
  name: string;
  // Iniciales del avatar del selector de rol: "DA", "DF".
  initials: string;
  description: string;
  // Permiso de CORE/Backoffice que habilita este perfil.
  permission: string;
  availableDashboards: DashboardId[];
}

export const ANALYTICS_PERMISSIONS = {
  academic: "analytics:academic:read",
  finance: "analytics:finance:read",
} as const;

const ROLE_BY_PERMISSION: Record<string, RoleId> = {
  [ANALYTICS_PERMISSIONS.academic]: "academica",
  [ANALYTICS_PERMISSIONS.finance]: "financiera",
};

export function rolesFromPermissions(permissions: readonly string[]): RoleId[] {
  return permissions.flatMap((permission) => ROLE_BY_PERMISSION[permission] ?? []);
}
