// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.

// Una sede del catálogo de Backoffice (evento `sede.definida`).
export interface BackofficeSite {
  sedeId: string;
  nombre: string;
}

// Backoffice Administrativo (módulo 8): dueño del catálogo de sedes.
export interface BackofficeSitesGateway {
  listSites(): Promise<BackofficeSite[]>;
}
