// Domain entities: core business objects, independent of frameworks and infrastructure.

export type RoleId = "academica" | "financiera";

export type DashboardId = "academic" | "financial" | "events";

export interface Role {
  id: RoleId;
  name: string;
  // Iniciales del avatar del selector de rol: "DA", "DF".
  initials: string;
  description: string;
  availableDashboards: DashboardId[];
}

// Configuración, no datos: los roles los define CORE y cada uno ve ciertos tableros.
export const ROLES: readonly Role[] = [
  {
    id: "academica",
    name: "Dirección Académica",
    initials: "DA",
    description: "Rendimiento por materia, docente y sede, y estadísticas de eventos",
    availableDashboards: ["academic", "events"],
  },
  {
    id: "financiera",
    name: "Dirección Financiera",
    initials: "DF",
    description: "Balance, gastos, tienda y comedores",
    availableDashboards: ["financial"],
  },
];

// Roles de CORE (Novedades 04/11, p. 4) → secciones de Analítica. Ningún permiso `analytics:*` existe hoy en
// CORE; si se crean, otorgan la sección por sí solos sin mirar el rol (docs/INTEGRACION.md, 1.1 y objeción 1).
const SECTIONS_BY_CORE_ROLE: Record<string, readonly RoleId[]> = {
  ACADEMIC_ADMIN: ["academica"],
  FINANCE_ADMIN: ["financiera"],
  ADMIN: ["academica", "financiera"],
};

const SECTIONS_BY_PERMISSION: Record<string, RoleId> = {
  "analytics:academic:read": "academica",
  "analytics:finance:read": "financiera",
};

// Secciones que corresponden a los roles y permisos de CORE; vacío = sin acceso a Analítica.
export function mapCoreRoles(coreRoles: readonly string[], permissions: readonly string[]): RoleId[] {
  const sections = new Set<RoleId>();
  for (const role of coreRoles) for (const section of SECTIONS_BY_CORE_ROLE[role] ?? []) sections.add(section);
  for (const permission of permissions) {
    const section = SECTIONS_BY_PERMISSION[permission];
    if (section) sections.add(section);
  }
  // Orden estable (el del catálogo ROLES).
  return ROLES.map((role) => role.id).filter((id) => sections.has(id));
}
