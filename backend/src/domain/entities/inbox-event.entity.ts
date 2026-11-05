// Domain entities: core business objects, independent of frameworks and infrastructure.
import { CoreSource } from "./event-source.entity";

// Envelope v1 de CORE (CORE v1, §9), ya validado. `data` se valida aparte contra el catálogo.
export interface EventEnvelope {
  specVersion: string;
  // Clave de idempotencia (UUID).
  eventId: string;
  // {source}.{entidad}.{acción}.v{n}
  eventType: string;
  source: CoreSource;
  // ISO 8601 UTC: cuándo pasó el hecho (no el envío).
  occurredAt: string;
  subject?: string;
  correlationId?: string;
  causationId?: string | null;
  actor?: { type: string; id: string };
  data: Record<string, unknown>;
}

// Resultado de guardar un evento: OK, o UNKNOWN_TYPE si se guardó fuera del catálogo (INBOX_STORE_UNKNOWN).
export type InboxResult = "OK" | "UNKNOWN_TYPE";

// Evento guardado en la bandeja de entrada.
export interface InboxEvent extends EventEnvelope {
  result: InboxResult;
  // Momento en que Analítica lo recibió (ISO 8601).
  receivedAt: string;
}
