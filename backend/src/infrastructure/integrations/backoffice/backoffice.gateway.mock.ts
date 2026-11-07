// Backoffice mock: mocks/backoffice/sites.json (respuesta completa, sin paginar) y users/<userId>.json.
import { BackofficeGateway, BackofficeSite } from "../../../domain/gateways/backoffice.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { MockFileStore } from "../mock/mock-file-store";
import { displayName } from "./backoffice.gateway.http";

export class BackofficeGatewayMock implements BackofficeGateway {
  constructor(private readonly store: MockFileStore) {}

  // Siempre la lista completa; se ignoran status/cursor/limit.
  async listSites(): Promise<BackofficeSite[]> {
    const content = await this.store.readRequired("backoffice", "sites.json");
    const items = Array.isArray(content) ? content : (content as { items?: unknown }).items;
    if (!Array.isArray(items)) {
      throw new GatewayError("backoffice", 500, "MOCK_INVALID_JSON", 'mocks/backoffice/sites.json debe ser { "items": [...], "nextCursor": null }.');
    }
    return items as BackofficeSite[];
  }

  async getUserDisplayName(userId: string): Promise<string | null> {
    const key = this.store.key("backoffice", userId);
    try {
      const user = await this.store.readOrNotFound("backoffice", `users/${key}.json`, "Usuario");
      return displayName(user as { firstName?: string; lastName?: string });
    } catch (error) {
      if (error instanceof GatewayError && error.status === 404) return null;
      throw error;
    }
  }

  invalidateUser(): void {}
}
