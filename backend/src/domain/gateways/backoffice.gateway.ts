// Backoffice (G8): sedes y nombre de usuario.
export type SiteStatus = "ACTIVE" | "INACTIVE";

export interface BackofficeSite {
  siteId: string;
  code: string;
  name: string;
  status: SiteStatus;
}

export interface BackofficeGateway {
  // Todas las sedes (el gateway sigue el cursor); el filtro de sede usa las ACTIVE.
  listSites(): Promise<BackofficeSite[]>;
  // "Nombre Apellido"; null si el usuario no existe (404). Otros errores suben como GatewayError.
  getUserDisplayName(userId: string): Promise<string | null>;
  // Olvida el nombre cacheado (lo llaman los eventos backoffice.user.*).
  invalidateUser(userId: string): void;
}
