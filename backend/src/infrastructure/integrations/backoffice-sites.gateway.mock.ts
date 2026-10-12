// Mock de Backoffice (módulo 8): catálogo de sedes, equivalente a los eventos `sede.definida`.
import { BackofficeSite, BackofficeSitesGateway } from "../../domain/gateways/backoffice-sites.gateway";

const SITES: BackofficeSite[] = [
  { sedeId: "sede-centro", nombre: "Sede Centro" },
  { sedeId: "sede-belgrano", nombre: "Sede Belgrano" },
  { sedeId: "sede-pilar", nombre: "Sede Pilar" },
  { sedeId: "campus-online", nombre: "Campus Online" },
];

export class BackofficeSitesGatewayMock implements BackofficeSitesGateway {
  async listSites(): Promise<BackofficeSite[]> {
    return SITES;
  }
}
