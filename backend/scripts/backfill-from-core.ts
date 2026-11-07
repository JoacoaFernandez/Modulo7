// Carga histórica desde CORE: pagina GET /internal/v1/events y pasa cada envelope por RecordEventUseCase (mismas
// validaciones e idempotencia que la cola). Sirve para el histórico y para recuperar locaciones → sedes.
//   npm run backfill:core -- --type=backoffice.location.upserted.v1 --from=2026-03-01 [--to=AAAA-MM-DD] [--source=backoffice]
import "../src/shared/load-env";
import { RecordEventUseCase } from "../src/application/use-cases/record-event.use-case";
import { coreEventsGateway } from "../src/infrastructure/integrations/gateways";
import { inboxRepository } from "../src/infrastructure/repositories/inbox-repository.provider";
import { prisma } from "../src/infrastructure/prisma-client";
import { backofficeGateway } from "../src/infrastructure/integrations/gateways";
import { config } from "../src/shared/config";
import { EventValidationError } from "../src/shared/event-validation-error";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  if (coreEventsGateway === null) {
    throw new Error("El backfill necesita el CORE real: poné CORE_MOCK=false (y CORE_BASE_URL, CORE_CLIENT_SECRET, CORE_JWT_ISSUER).");
  }
  const query = { type: arg("type"), source: arg("source"), from: arg("from"), to: arg("to") };
  if (!query.type && !query.source && !query.from) {
    throw new Error("Indicá al menos --type=, --source= o --from=AAAA-MM-DD.");
  }

  const recordEvent = new RecordEventUseCase(inboxRepository, {
    storeUnknown: config.events.inboxStoreUnknown,
    onUserChanged: (userId) => backofficeGateway.invalidateUser(userId),
  });
  const counts = { stored: 0, duplicate: 0, ignored: 0, invalid: 0 };

  let cursor: string | undefined;
  do {
    const page = await coreEventsGateway.listEvents({ ...query, cursor, limit: 100 });
    for (const envelope of page.items) {
      try {
        counts[await recordEvent.execute(envelope)]++;
      } catch (error) {
        if (!(error instanceof EventValidationError)) throw error;
        counts.invalid++;
        console.warn(`Evento inválido (se omite): ${error.message}`);
      }
    }
    cursor = page.nextCursor ?? undefined;
    console.log(`Procesados: ${JSON.stringify(counts)}`);
  } while (cursor);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
