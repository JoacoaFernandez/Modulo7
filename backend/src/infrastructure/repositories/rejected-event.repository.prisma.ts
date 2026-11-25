// Rechazados de la cola sobre Postgres (tabla rejected_events).
import { PrismaClient } from "@prisma/client";
import { RejectedEventInput, RejectedEventRepository } from "../../domain/repositories/rejected-event.repository";

export class RejectedEventRepositoryPrisma implements RejectedEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save({ reason, eventId, raw }: RejectedEventInput): Promise<void> {
    await this.prisma.rejectedEvent.create({ data: { reason, eventId, raw } });
  }
}
