// Domain entities: core business objects, independent of frameworks and infrastructure.
import { SourceModule } from "./event-source.entity";

export interface InstitutionalEvent {
  // Identificador interno asignado por Analítica Institucional.
  id: string;
  // Identificador provisto por el módulo emisor; es la clave de idempotencia.
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  payload: Record<string, unknown>;
  // Momento en que ocurrió el hecho, según el emisor.
  occurredAt: string;
  // Momento en que Analítica lo recibió.
  receivedAt: string;
}
