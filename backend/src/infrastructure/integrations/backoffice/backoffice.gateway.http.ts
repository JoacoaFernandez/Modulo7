// Backoffice real (G8): GET /internal/v1/sites y /internal/v1/users/{userId} (permiso backoffice:read).
import { BackofficeGateway, BackofficeSite } from "../../../domain/gateways/backoffice.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { HttpClient } from "../http/http-client";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export class BackofficeGatewayHttp implements BackofficeGateway {
  constructor(private readonly http: HttpClient) {}

  async listSites(): Promise<BackofficeSite[]> {
    const sites: BackofficeSite[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.http.request<{ items?: BackofficeSite[]; nextCursor?: string | null }>({
        path: "/internal/v1/sites",
        query: { limit: PAGE_SIZE, cursor },
      });
      if (!body || !Array.isArray(body.items)) {
        throw new GatewayError("backoffice", 502, "INVALID_RESPONSE", "Backoffice devolvió sites sin items.");
      }
      sites.push(...body.items);
      if (!body.nextCursor) return sites;
      cursor = body.nextCursor;
    }
    return sites;
  }

  async getUserDisplayName(userId: string): Promise<string | null> {
    try {
      const user = await this.http.request<{ firstName?: string; lastName?: string }>({
        path: `/internal/v1/users/${encodeURIComponent(userId)}`,
      });
      return displayName(user);
    } catch (error) {
      if (error instanceof GatewayError && error.status === 404) return null;
      throw error;
    }
  }

  // Sin caché propia (la envuelve CachedBackofficeGateway).
  invalidateUser(): void {}
}

export function displayName(user: { firstName?: string; lastName?: string } | undefined): string | null {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name === "" ? null : name;
}
