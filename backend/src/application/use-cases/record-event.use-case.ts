// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { randomUUID } from "node:crypto";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { RecordEventDto } from "../dtos/analytics.dto";

export class RecordEventUseCase {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  execute(dto: RecordEventDto): Promise<void> {
    return this.analyticsRepository.recordEvent({
      id: randomUUID(),
      eventId: dto.eventId,
      sourceModule: dto.sourceModule,
      eventType: dto.eventType,
      payload: dto.payload,
      occurredAt: dto.occurredAt,
      receivedAt: new Date().toISOString(),
    });
  }
}
