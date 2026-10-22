// Gateways reales hacia Backoffice (módulo 8). Se consulta directo a su backend, sin pasar por
// el gateway de CORE, con el token de servicio. Las personas no se copian: se piden cuando hacen
// falta y Backoffice sigue siendo el dueño del dato.
import { BackofficeSite, BackofficeSitesGateway } from "../../domain/gateways/backoffice-sites.gateway";
import { BackofficeUser, BackofficeUsersGateway } from "../../domain/gateways/backoffice-users.gateway";
import { CoreServiceAuthGateway } from "../../domain/gateways/core-service-auth.gateway";
import { getAsService } from "./service-http";

// Las sedes cambian poco y no tienen evento: se cachean unos minutos.
const SITES_TTL_MS = 5 * 60 * 1000;
const PAGE_LIMIT = 100;

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export class BackofficeSitesGatewayHttp implements BackofficeSitesGateway {
  private cached: { sites: BackofficeSite[]; expiresAt: number } | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceAuth: CoreServiceAuthGateway,
  ) {}

  async listSites(): Promise<BackofficeSite[]> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.sites;

    const sites: BackofficeSite[] = [];
    let cursor: string | null = null;
    do {
      const query = new URLSearchParams({ limit: String(PAGE_LIMIT), ...(cursor ? { cursor } : {}) });
      const page: Page<BackofficeSite> | null = await getAsService<Page<BackofficeSite>>(
        this.serviceAuth,
        `${this.baseUrl}/api/v1/sites?${query}`,
      );
      sites.push(...(page?.items ?? []));
      cursor = page?.nextCursor ?? null;
    } while (cursor);

    this.cached = { sites, expiresAt: Date.now() + SITES_TTL_MS };
    return sites;
  }
}

export class BackofficeUsersGatewayHttp implements BackofficeUsersGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceAuth: CoreServiceAuthGateway,
  ) {}

  getUser(userId: string): Promise<BackofficeUser | null> {
    return getAsService<BackofficeUser>(this.serviceAuth, `${this.baseUrl}/api/v1/users/${encodeURIComponent(userId)}`);
  }
}
