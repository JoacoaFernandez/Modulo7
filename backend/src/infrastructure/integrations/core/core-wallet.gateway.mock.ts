// CORE mock: mocks/core/wallets-aggregates/<AAAA-MM>.json (mes de `from`), devuelto tal cual aunque `to` sea parcial.
import { CoreWalletGateway, WalletAggregates } from "../../../domain/gateways/core-wallet.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { MockFileStore } from "../mock/mock-file-store";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CoreWalletGatewayMock implements CoreWalletGateway {
  constructor(private readonly store: MockFileStore) {}

  async getAggregates(from: string, to: string): Promise<WalletAggregates> {
    if (!DATE.test(from) || !DATE.test(to)) {
      throw new GatewayError("core", 400, "VALIDATION_ERROR", `from y to deben ser AAAA-MM-DD (vino ${from} y ${to}).`);
    }

    const month = this.store.key("core", from.slice(0, 7));
    const content =
      (await this.store.readOptional("core", `wallets-aggregates/${month}.json`)) ??
      (await this.store.readOptional("core", "wallets-aggregates/_empty.json")) ?? {
        range: { from, to },
        currency: "ARS",
        outstandingBalance: "0.00",
        walletCount: 0,
        groups: [],
      };

    return content as WalletAggregates;
  }
}
