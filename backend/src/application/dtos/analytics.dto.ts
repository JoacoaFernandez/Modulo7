// DTOs: shapes used to move data in and out of use cases, decoupled from domain entities.
import { SourceModule } from "../../domain/entities/event-source.entity";

// Envelope de ingesta que envían los módulos de UADEnet a POST /api/analytics/events.
export interface RecordEventDto {
  // Clave de idempotencia provista por el emisor.
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  // ISO 8601, según el reloj del emisor.
  occurredAt: string;
  payload: Record<string, unknown>;
}
