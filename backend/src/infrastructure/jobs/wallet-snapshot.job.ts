// Job de snapshots del saldo de CORE (docs/INTEGRACION.md, 7.4). Con `to` = inicio del mes siguiente, `aggregates`
// devuelve el saldo (outstandingBalance) al cierre de ese mes (CORE, 25/11): por eso el backfill de meses cerrados
// (WALLET_SNAPSHOT_BACKFILL_MONTHS) pide un `to` por mes y guarda el saldo de cierre real, también con CORE real.
// Idempotente: varias instancias no rompen nada.
import { CoreWalletGateway, WalletAggregates } from "../../domain/gateways/core-wallet.gateway";
import { currentMonthYm } from "../../domain/services/period-catalog.service";
import { previousMonthYm, walletMonthsQuery } from "../../domain/services/wallet-range.service";
import { config } from "../../shared/config";
import { coreWalletGateway } from "../integrations/gateways";
import { prisma } from "../prisma-client";

export interface SnapshotStore {
  find(month: string): Promise<{ isFinal: boolean } | null>;
  save(month: string, aggregates: WalletAggregates, isFinal: boolean): Promise<void>;
}

const prismaStore: SnapshotStore = {
  find: (month) => prisma.walletBalanceSnapshot.findUnique({ where: { month }, select: { isFinal: true } }),
  async save(month, aggregates, isFinal) {
    const values = {
      currency: aggregates.currency,
      outstandingBalance: aggregates.outstandingBalance,
      walletCount: aggregates.walletCount,
      capturedAt: new Date(),
      isFinal,
    };
    await prisma.walletBalanceSnapshot.upsert({ where: { month }, create: { month, ...values }, update: values });
  },
};

// Un ciclo: (1) mes en curso (isFinal=false; su `to` es el fin del mes, así que el saldo es el de hoy), (2) mes
// anterior si no tiene snapshot final, (3) los N meses anteriores sin snapshot (WALLET_SNAPSHOT_BACKFILL_MONTHS), cada
// uno con su saldo de cierre. Un mes sin datos (walletCount 0) no se guarda.
export async function runWalletSnapshotCycle(
  wallets: CoreWalletGateway,
  store: SnapshotStore,
  options: { backfillMonths: number; now?: Date } = { backfillMonths: 0 },
): Promise<void> {
  const now = options.now ?? new Date();
  const current = currentMonthYm(now);

  const capture = async (ym: string, isFinal: boolean) => {
    const aggregates = await wallets.getAggregates(walletMonthsQuery(ym, ym));
    if (aggregates.walletCount === 0) {
      console.log(`[wallet-snapshot] ${ym}: CORE no informó wallets; no se guarda snapshot.`);
      return;
    }
    await store.save(ym, aggregates, isFinal);
    console.log(`[wallet-snapshot] ${ym}: saldo ${aggregates.outstandingBalance} (${aggregates.walletCount} wallets, final=${isFinal}).`);
  };

  await capture(current, false);

  const missing = async (ym: string) => !(await store.find(ym))?.isFinal;
  let month = current;
  for (let i = 0; i < Math.max(options.backfillMonths, 1); i++) {
    month = previousMonthYm(month);
    if (await missing(month)) await capture(month, true);
  }
}

export interface WalletSnapshotJob {
  stop(): void;
}

export function startWalletSnapshotJob(): WalletSnapshotJob | null {
  if (!config.walletSnapshot.enabled) {
    console.log("[wallet-snapshot] apagado (WALLET_SNAPSHOT_ENABLED=false)");
    return null;
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runWalletSnapshotCycle(coreWalletGateway, prismaStore, { backfillMonths: config.walletSnapshot.backfillMonths });
    } catch (error) {
      // CORE caído o base caída: se reintenta en el próximo ciclo.
      console.warn(`[wallet-snapshot] ciclo fallido: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), config.walletSnapshot.intervalMin * 60_000);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
