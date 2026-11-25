// Carga histórica de resultados de cursada desde Gestión Académica (G9): pagina GET /internal/v1/resultados-cursada
// por período y graba cada resultado en el inbox como un envelope v1 SINTÉTICO de academic.course-result.published.v1,
// pasando por RecordEventUseCase (misma validación, saneamiento e idempotencia que la cola).
//   npm run backfill:results                       # todos los períodos del catálogo de G9
//   npm run backfill:results -- --period=8,9       # sólo esos períodos
//   npm run backfill:results -- --limit=200 --dry-run
// El eventId es un UUID v5 de `studentId|courseId|resultDate|status`: re-ejecutarlo no duplica y convive con los eventos
// reales (otro eventId; manda el de occurredAt más reciente por (alumno, curso)). Usa ACADEMIC_MOCK (mocks/academic/
// resultados-cursada/{periodId}.json) o el G9 real según el flag.
import "../src/shared/load-env";
import { createHash } from "node:crypto";
import { RecordEventUseCase } from "../src/application/use-cases/record-event.use-case";
import { AcademicCourseResult } from "../src/domain/gateways/academic.gateway";
import { academicGateway, backofficeGateway, gatewayModes } from "../src/infrastructure/integrations/gateways";
import { inboxRepository } from "../src/infrastructure/repositories/inbox-repository.provider";
import { prisma } from "../src/infrastructure/prisma-client";
import { config } from "../src/shared/config";
import { EventValidationError } from "../src/shared/event-validation-error";

const EVENT_TYPE = "academic.course-result.published.v1";
// Namespace fijo de los eventId sintéticos.
const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

// UUID v5 (SHA-1 sobre namespace + nombre).
function uuidV5(name: string): string {
  const bytes = createHash("sha1").update(Buffer.from(NAMESPACE.replaceAll("-", ""), "hex")).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const text = (value: string | number | undefined): string | undefined => (value === undefined || value === null ? undefined : String(value));

// Mediodía de Argentina de la fecha del resultado: el evento real (con su hora) de ese día pisa al sintético si es más tarde.
const occurredAtOf = (resultDate: string): string => `${resultDate}T15:00:00.000Z`;

function toEnvelope(item: AcademicCourseResult, periodId: string, fallbackDate: string | undefined): Record<string, unknown> | null {
  const resultDate = item.resultDate ?? fallbackDate;
  if (!resultDate) return null;

  const data = {
    studentId: item.studentId,
    courseId: text(item.courseId),
    subjectId: text(item.subjectId),
    periodId: text(item.periodId) ?? periodId,
    subjectCode: item.subjectCode,
    subjectName: item.subjectName,
    careerId: text(item.careerId),
    planId: text(item.planId),
    siteId: item.siteId ?? null,
    teachers: item.teachers,
    finalGrade: item.finalGrade ?? null,
    status: item.status,
    resultDate,
  };

  return {
    specVersion: "1.0",
    eventId: uuidV5(`${item.studentId}|${text(item.courseId)}|${resultDate}|${item.status}`),
    eventType: EVENT_TYPE,
    source: "academic",
    occurredAt: occurredAtOf(resultDate),
    subject: `course/${text(item.courseId)}`,
    causationId: null,
    actor: { type: "service", id: "analytics-backfill" },
    data,
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const limit = Number(arg("limit") ?? 500);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit debe ser un entero positivo.");

  const periods = await academicGateway.listPeriods();
  const requested = arg("period")?.split(",").map((id) => id.trim()).filter(Boolean);
  const targets = requested ?? periods.map((period) => String(period.id));
  const endOf = new Map(periods.map((period) => [String(period.id), period.fechaFin]));

  console.log(`Gestión Académica: ${gatewayModes.academic}. Base: ${new URL(config.databaseUrl).host}. Períodos: ${targets.join(", ")}${dryRun ? " (dry-run)" : ""}`);

  const recordEvent = new RecordEventUseCase(inboxRepository, {
    storeUnknown: config.events.inboxStoreUnknown,
    onUserChanged: (userId) => backofficeGateway.invalidateUser(userId),
  });
  const counts = { read: 0, stored: 0, duplicate: 0, ignored: 0, invalid: 0, skipped: 0 };

  for (const periodId of targets) {
    let cursor: string | undefined;
    let periodRead = 0;
    do {
      const page = await academicGateway.listCourseResults(periodId, cursor, limit);
      for (const item of page.items) {
        counts.read++;
        periodRead++;
        const envelope = toEnvelope(item, periodId, endOf.get(periodId));
        if (!envelope) {
          counts.skipped++;
          continue;
        }
        if (dryRun) continue;
        try {
          counts[await recordEvent.execute(envelope)]++;
        } catch (error) {
          if (!(error instanceof EventValidationError)) throw error;
          counts.invalid++;
          console.warn(`Resultado inválido (se omite): ${error.message}`);
        }
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    console.log(`Período ${periodId}: ${periodRead} resultados. Acumulado: ${JSON.stringify(counts)}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
