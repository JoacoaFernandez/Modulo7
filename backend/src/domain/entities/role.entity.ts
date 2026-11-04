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
    description: "Rendimiento por materia, docente y sede",
    availableDashboards: ["academic"],
  },
  {
    id: "financiera",
    name: "Dirección Financiera",
    initials: "DF",
    description: "Balance, gastos, tienda, comedores y eventos",
    availableDashboards: ["financial", "events"],
  },
];
