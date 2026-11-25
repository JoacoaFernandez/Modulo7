// CORE real: GET /internal/v1/wallets/aggregates (permiso wallet:read:aggregates).
import { CoreWalletGateway, WalletAggregates, WalletAggregatesQuery } from "../../../domain/gateways/core-wallet.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { HttpClient } from "../http/http-client";

export class CoreWalletGatewayHttp implements CoreWalletGateway {
  constructor(private readonly http: HttpClient) {}

  async getAggregates({ from, to, groupBy }: WalletAggregatesQuery): Promise<WalletAggregates> {
    // El HttpClient arma el query con URLSearchParams: el "+" de un offset positivo se encodea y el "-03:00" viaja tal cual.
    // CORE sólo acepta groupBy=month (otro valor es 400): sin él agrupa por concepto.
    const body = await this.http.request<WalletAggregates>({
      path: "/internal/v1/wallets/aggregates",
      query: { from, to, groupBy },
    });
    if (!body || !Array.isArray(body.groups)) {
      throw new GatewayError("core", 502, "INVALID_RESPONSE", "CORE devolvió un wallets/aggregates sin groups.");
    }
    return body;
  }
}
