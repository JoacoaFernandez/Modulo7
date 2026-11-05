// Dataset de demo en formato v1 (docs/INTEGRACION.md, 8 · Fase D): ~35 mil envelopes determinísticos de todos los tipos
// persistidos, pasados por RecordEventUseCase (misma validación, redact e idempotencia que la cola real).
// Los eventId salen de claves estables y llevan el prefijo `de0de0de-`: re-ejecutar no duplica y `--clear` borra sólo el demo.
// Los ids de sedes, cursos, períodos, etc. salen de demo/ids.ts y coinciden con los mocks (npm run mocks:generate).
//   npm run db:demo          genera e inserta (también deja los snapshots de saldo de los meses de los mocks)
//   npm run db:demo:clear    borra los eventos demo y esos snapshots; no toca los eventos que llegaron por Postman o la cola
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import "../src/shared/load-env";
import { buildDemoDataset } from "../demo/dataset";
import { DEMO_EVENT_ID_PREFIX } from "../demo/ids";
import { RecordEventOutcome, RecordEventUseCase } from "../src/application/use-cases/record-event.use-case";
import { prisma } from "../src/infrastructure/prisma-client";
import { inboxRepository } from "../src/infrastructure/repositories/inbox-repository.provider";

const CONCURRENCY = 12;
const MOCKS_DIR = path.resolve(process.cwd(), process.env.MOCKS_DIR?.trim() || "./mocks");

// Meses de wallets-aggregates de los mocks con su saldo: los snapshots del demo (el job sólo captura el mes en curso y
// los N anteriores al arrancar; así el saldo de todos los meses del tablero está desde el primer momento).
async function readMockSnapshots(): Promise<{ month: string; outstandingBalance: string; walletCount: number; currency: string }[]> {
  const dir = path.join(MOCKS_DIR, "core", "wallets-aggregates");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const snapshots = [];
  for (const file of files.filter((name) => /^\d{4}-\d{2}\.json$/.test(name)).sort()) {
    const content = JSON.parse(await readFile(path.join(dir, file), "utf8")) as { outstandingBalance?: string; walletCount?: number; currency?: string };
    if (typeof content.outstandingBalance !== "string") continue; // archivo con __mockStatus u otro formato
    snapshots.push({ month: file.slice(0, 7), outstandingBalance: content.outstandingBalance, walletCount: content.walletCount ?? 0, currency: content.currency ?? "ARS" });
  }
  return snapshots;
}

// source_ingestions se recalcula desde lo que quedó en inbox_events (los descartados no dejan rastro: ignored = 0).
async function rebuildSourceIngestions(): Promise<void> {
  await prisma.$executeRaw`DELETE FROM source_ingestions`;
  await prisma.$executeRaw`
    INSERT INTO source_ingestions (source, last_event_at, last_received_at, stored_count, ignored_count)
    SELECT source, MAX(occurred_at), MAX(received_at), COUNT(*)::int, 0 FROM inbox_events GROUP BY source`;
}

async function clear(): Promise<void> {
  const removed = await prisma.$executeRaw`DELETE FROM inbox_events WHERE event_id::text LIKE ${`${DEMO_EVENT_ID_PREFIX}-%`}`;
  const months = (await readMockSnapshots()).map((snapshot) => snapshot.month);
  const snapshots = await prisma.walletBalanceSnapshot.deleteMany({ where: { month: { in: months } } });
  await rebuildSourceIngestions();
  console.log(`Demo borrado: ${removed} eventos y ${snapshots.count} snapshots de saldo (quedan ${await prisma.inboxEvent.count()} eventos ajenos al demo).`);
}

async function seed(): Promise<void> {
  const { events } = buildDemoDataset();
  const recordEvent = new RecordEventUseCase(inboxRepository, { storeUnknown: false });

  const outcomes: Record<RecordEventOutcome, number> = { stored: 0, duplicate: 0, ignored: 0 };
  const stored: Record<string, number> = {};
  let cursor = 0;
  const started = Date.now();

  // Cada worker toma el siguiente evento: la inserción es idempotente, el orden entre workers no importa.
  const worker = async () => {
    for (;;) {
      const event = events[cursor++];
      if (!event) return;
      const outcome = await recordEvent.execute(event);
      outcomes[outcome] += 1;
      if (outcome === "stored") stored[event.eventType] = (stored[event.eventType] ?? 0) + 1;
      if (cursor % 5000 === 0) console.log(`  ${cursor}/${events.length}...`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Snapshots del saldo vigente por mes (a partir de los mocks de CORE). Los meses cerrados quedan finales.
  const snapshots = await readMockSnapshots();
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7);
  for (const snapshot of snapshots) {
    const values = {
      currency: snapshot.currency,
      outstandingBalance: snapshot.outstandingBalance,
      walletCount: snapshot.walletCount,
      capturedAt: new Date(),
      isFinal: snapshot.month < currentMonth,
    };
    await prisma.walletBalanceSnapshot.upsert({ where: { month: snapshot.month }, create: { month: snapshot.month, ...values }, update: values });
  }

  console.log(`Demo cargado en ${((Date.now() - started) / 1000).toFixed(1)} s: ${outcomes.stored} nuevos, ${outcomes.duplicate} ya existían, ${outcomes.ignored} descartados con ack.`);
  for (const [eventType, count] of Object.entries(stored).sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${eventType.padEnd(40)} ${count}`);
  console.log(`  snapshots de saldo: ${snapshots.length}${snapshots.length === 0 ? " (no hay mocks: corré npm run mocks:generate y volvé a cargar el demo)" : ""}`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--clear")) await clear();
  else await seed();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
