// DTOs: shapes used to move data in and out of use cases, decoupled from domain entities.
import { SourceModule } from "../../domain/entities/institutional-event.entity";

export interface RecordEventDto {
  sourceModule: SourceModule;
  eventType: string;
  payload: Record<string, unknown>;
}
