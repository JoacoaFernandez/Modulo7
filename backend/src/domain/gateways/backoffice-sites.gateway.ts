// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.

// Una sede del catálogo de Backoffice (GET /api/v1/sites de Backoffice). Las sedes no tienen
// evento: se consultan al arrancar y se cachean.
export interface BackofficeSite {
  siteId: string;
  // Código legible y estable para mostrar: "CENTRO".
  code: string;
  name: string;
  // Zona horaria IANA de la sede, para cortar por día y mes local.
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
}

// Backoffice Administrativo (módulo 8): dueño del catálogo de sedes.
export interface BackofficeSitesGateway {
  listSites(): Promise<BackofficeSite[]>;
}
