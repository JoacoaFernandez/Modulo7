// CORE mock: resuelve el contrato de wallets/aggregates (from incluido, to excluido, groupBy=month opcional) juntando los
// archivos mocks/core/wallets-aggregates/<AAAA-MM>.json de los meses del rango (mes calendario argentino). Cada archivo es
// el agregado de UN mes; `outstandingBalance` y `walletCount` salen del último mes del rango (el saldo "a `to`").
import { CoreWalletGateway, WalletAggregateGroup, WalletAggregates, WalletAggregatesQuery } from "../../../domain/gateways/core-wallet.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { argentinaYmOf, nextMonthYm } from "../../../domain/services/wallet-range.service";
import { MockFileStore } from "../mock/mock-file-store";

const MAX_MONTHS = 240;

function invalid(detail: string): GatewayError {
  return new GatewayError("core", 400, "WALLET_AGGREGATES_INVALID_QUERY", detail);
}

export class CoreWalletGatewayMock implements CoreWalletGateway {
  constructor(private readonly store: MockFileStore) {}

  async getAggregates({ from, to, groupBy }: WalletAggregatesQuery): Promise<WalletAggregates> {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw invalid(`from y to deben ser fechas ISO-8601 (vino ${from} y ${to}).`);
    if (start >= end) throw invalid("from debe ser anterior a to.");
    if (groupBy !== undefined && groupBy !== "month") throw invalid(`groupBy sólo admite "month" (vino ${String(groupBy)}).`);

    // Meses que toca el rango: del mes de `from` al mes del último instante incluido (to - 1 ms).
    const first = argentinaYmOf(start);
    const last = argentinaYmOf(new Date(end.getTime() - 1));
    const months: string[] = [];
    for (let ym = first; ym <= last && months.length < MAX_MONTHS; ym = nextMonthYm(ym)) months.push(ym);

    const contents = await Promise.all(months.map((ym) => this.readMonth(ym)));

    let groups: WalletAggregateGroup[];
    if (groupBy === "month") {
      groups = contents.flatMap((content, index) => content.groups.map((group) => ({ key: group.key, type: group.type, month: months[index], count: group.count, total: group.total })));
    } else {
      const byKey = new Map<string, { group: WalletAggregateGroup; total: number }>();
      for (const group of contents.flatMap((content) => content.groups)) {
        const id = `${group.type}|${group.key}`;
        const entry = byKey.get(id) ?? { group: { key: group.key, type: group.type, count: 0, total: "0.00" }, total: 0 };
        entry.group.count += group.count;
        entry.total += Number(group.total);
        byKey.set(id, entry);
      }
      groups = [...byKey.values()].map(({ group, total }) => ({ ...group, total: total.toFixed(2) }));
    }

    const closing = contents[contents.length - 1];
    return {
      currency: closing.currency,
      outstandingBalance: closing.outstandingBalance,
      walletCount: closing.walletCount,
      range: { from: start.toISOString(), to: end.toISOString() },
      groups,
    };
  }

  private async readMonth(ym: string): Promise<WalletAggregates> {
    const key = this.store.key("core", ym);
    const content =
      (await this.store.readOptional("core", `wallets-aggregates/${key}.json`)) ?? (await this.store.readOptional("core", "wallets-aggregates/_empty.json"));

    return (content as WalletAggregates | undefined) ?? { currency: "ARS", outstandingBalance: "0.00", walletCount: 0, groups: [] };
  }
}
