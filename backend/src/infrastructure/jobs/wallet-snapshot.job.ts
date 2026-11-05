// Job de snapshots del saldo vigente de CORE (docs/INTEGRACION.md, 7.4): `aggregates` da una foto, no una serie, y
// el saldo de un mes cerrado no se puede reconstruir hacia atrás. Idempotente: varias instancias no rompen nada.
import { CoreWalletGateway, WalletAggregates } from "../../domain/gateways/core-wallet.gateway";
import { argentinaToday, currentMonthYm } from "../../domain/services/period-catalog.service";
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

// "2026-11" → "2026-10".
function previousMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

function lastDayOf(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
}

// Un ciclo: (1) mes en curso (isFinal=false), (2) mes anterior si no tiene snapshot final, (3) los N meses
// anteriores sin snapshot (WALLET_SNAPSHOT_BACKFILL_MONTHS). Un mes sin datos (walletCount 0) no se guarda.
export async function runWalletSnapshotCycle(
  wallets: CoreWalletGateway,
  store: SnapshotStore,
  options: { backfillMonths: number; now?: Date } = { backfillMonths: 0 },
): Promise<void> {
  const now = options.now ?? new Date();
  const current = currentMonthYm(now);

  const capture = async (ym: string, from: string, to: string, isFinal: boolean) => {
    const aggregates = await wallets.getAggregates(from, to);
    if (aggregates.walletCount === 0) {
      console.log(`[wallet-snapshot] ${ym}: CORE no informó wallets; no se guarda snapshot.`);
      return;
    }
    await store.save(ym, aggregates, isFinal);
    console.log(`[wallet-snapshot] ${ym}: saldo ${aggregates.outstandingBalance} (${aggregates.walletCount} wallets, final=${isFinal}).`);
  };

  await capture(current, `${current}-01`, argentinaToday(now), false);

  const missing = async (ym: string) => !(await store.find(ym))?.isFinal;
  let month = current;
  for (let i = 0; i < Math.max(options.backfillMonths, 1); i++) {
    month = previousMonth(month);
    if (await missing(month)) await capture(month, `${month}-01`, lastDayOf(month), true);
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
