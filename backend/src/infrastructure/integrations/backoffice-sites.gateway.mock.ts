// Mock de Backoffice (módulo 8): catálogo de sedes con el shape de GET /api/v1/sites.
import { BackofficeSite, BackofficeSitesGateway } from "../../domain/gateways/backoffice-sites.gateway";

// UUID fijos para que el dataset mock y los filtros del frontend coincidan entre reinicios.
export const SITE_IDS = {
  centro: "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90",
  belgrano: "4fac1b23-66dd-4e88-8b12-7c3a9d5f2ea1",
  pilar: "50bd2c34-77ee-4f99-9c23-8d4bae603fb2",
  online: "61ce3d45-88ff-4a0a-8d34-9e5cbf7140c3",
} as const;

const TIMEZONE = "America/Argentina/Buenos_Aires";

const SITES: BackofficeSite[] = [
  { siteId: SITE_IDS.centro, code: "CENTRO", name: "Sede Centro", timezone: TIMEZONE, status: "ACTIVE" },
  { siteId: SITE_IDS.belgrano, code: "BELGRANO", name: "Sede Belgrano", timezone: TIMEZONE, status: "ACTIVE" },
  { siteId: SITE_IDS.pilar, code: "PILAR", name: "Sede Pilar", timezone: TIMEZONE, status: "ACTIVE" },
  { siteId: SITE_IDS.online, code: "ONLINE", name: "Campus Online", timezone: TIMEZONE, status: "ACTIVE" },
];

export class BackofficeSitesGatewayMock implements BackofficeSitesGateway {
  async listSites(): Promise<BackofficeSite[]> {
    return SITES;
  }
}
