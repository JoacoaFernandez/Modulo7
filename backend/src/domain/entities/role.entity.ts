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
