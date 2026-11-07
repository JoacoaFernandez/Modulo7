// CORE real: GET /internal/v1/wallets/aggregates (permiso wallet:read:aggregates).
import { CoreWalletGateway, WalletAggregates } from "../../../domain/gateways/core-wallet.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { HttpClient } from "../http/http-client";

export class CoreWalletGatewayHttp implements CoreWalletGateway {
  constructor(private readonly http: HttpClient) {}

  async getAggregates(from: string, to: string): Promise<WalletAggregates> {
    const body = await this.http.request<WalletAggregates>({
      path: "/internal/v1/wallets/aggregates",
      query: { groupBy: "concept", from, to },
    });
    if (!body || !Array.isArray(body.groups)) {
      throw new GatewayError("core", 502, "INVALID_RESPONSE", "CORE devolvió un wallets/aggregates sin groups.");
    }
    return body;
  }
}
