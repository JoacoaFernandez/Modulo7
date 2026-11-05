// Repositorio de la bandeja de entrada sobre Postgres (Prisma): inbox_events y source_ingestions.
import { Prisma, PrismaClient } from "@prisma/client";
import { CoreSource } from "../../domain/entities/event-source.entity";
import { EventEnvelope, InboxEvent, InboxResult } from "../../domain/entities/inbox-event.entity";
import { InboxPage, InboxRepository } from "../../domain/repositories/inbox.repository";
import { ValidationError } from "../../shared/validation-error";

export class InboxRepositoryPrisma implements InboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // INSERT ... ON CONFLICT DO NOTHING: 0 filas = duplicado.
  async insertIfAbsent(envelope: EventEnvelope, result: InboxResult): Promise<boolean> {
    const { count } = await this.prisma.inboxEvent.createMany({
      skipDuplicates: true,
      data: [
        {
          eventId: envelope.eventId,
          specVersion: envelope.specVersion,
          eventType: envelope.eventType,
          source: envelope.source,
          occurredAt: new Date(envelope.occurredAt),
          subject: envelope.subject ?? null,
          correlationId: envelope.correlationId ?? null,
          causationId: envelope.causationId ?? null,
          actor: envelope.actor ? (envelope.actor as Prisma.InputJsonObject) : Prisma.DbNull,
          data: envelope.data as Prisma.InputJsonObject,
          result,
        },
      ],
    });
    return count > 0;
  }

  async findSummary(eventId: string): Promise<{ eventType: string; occurredAt: string } | null> {
    const row = await this.prisma.inboxEvent.findUnique({
      where: { eventId },
      select: { eventType: true, occurredAt: true },
    });
    return row ? { eventType: row.eventType, occurredAt: row.occurredAt.toISOString() } : null;
  }

  async touchSource(source: string, occurredAt: string, outcome: "stored" | "ignored"): Promise<void> {
    const stored = outcome === "stored" ? 1 : 0;
    const ignored = outcome === "ignored" ? 1 : 0;
    await this.prisma.$executeRaw`
      INSERT INTO source_ingestions (source, last_event_at, last_received_at, stored_count, ignored_count)
      VALUES (${source}, ${occurredAt}::timestamptz, now(), ${stored}, ${ignored})
      ON CONFLICT (source) DO UPDATE SET
        last_received_at = now(),
        last_event_at = GREATEST(source_ingestions.last_event_at, EXCLUDED.last_event_at),
        stored_count = source_ingestions.stored_count + ${stored},
        ignored_count = source_ingestions.ignored_count + ${ignored}`;
  }

  // Paginación por clave (received_at, event_id) descendente; el cursor es opaco (base64).
  async list(limit: number, cursor: string | null): Promise<InboxPage> {
    const after = cursor === null ? null : decodeCursor(cursor);

    const rows = await this.prisma.inboxEvent.findMany({
      where: after
        ? {
            OR: [
              { receivedAt: { lt: after.receivedAt } },
              { receivedAt: after.receivedAt, eventId: { lt: after.eventId } },
            ],
          }
        : undefined,
      orderBy: [{ receivedAt: "desc" }, { eventId: "desc" }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];

    return {
      items: page.map((row) => ({
        specVersion: row.specVersion,
        eventId: row.eventId,
        eventType: row.eventType,
        source: row.source as CoreSource,
        occurredAt: row.occurredAt.toISOString(),
        ...(row.subject !== null && { subject: row.subject }),
        ...(row.correlationId !== null && { correlationId: row.correlationId }),
        ...(row.causationId !== null && { causationId: row.causationId }),
        ...(row.actor !== null && { actor: row.actor as { type: string; id: string } }),
        data: row.data as Record<string, unknown>,
        result: row.result as InboxResult,
        receivedAt: row.receivedAt.toISOString(),
      })) satisfies InboxEvent[],
      nextCursor: rows.length > limit && last ? encodeCursor(last.receivedAt, last.eventId) : null,
    };
  }
}

function encodeCursor(receivedAt: Date, eventId: string): string {
  return Buffer.from(`${receivedAt.toISOString()}|${eventId}`).toString("base64url");
}

function decodeCursor(cursor: string): { receivedAt: Date; eventId: string } {
  const [iso, eventId] = Buffer.from(cursor, "base64url").toString().split("|");
  const receivedAt = new Date(iso);
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId) || Number.isNaN(receivedAt.getTime())) throw new ValidationError('"cursor" inválido.');
  return { receivedAt, eventId };
}
