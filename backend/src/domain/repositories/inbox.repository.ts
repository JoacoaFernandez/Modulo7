// Repository interfaces: contracts that infrastructure implementations must fulfill.
import { EventEnvelope, InboxEvent, InboxResult } from "../entities/inbox-event.entity";

export interface InboxPage {
  items: InboxEvent[];
  // null si no hay más páginas.
  nextCursor: string | null;
}

export interface InboxRepository {
  // true si insertó; false si el eventId ya existía (no pisa la fila original).
  insertIfAbsent(envelope: EventEnvelope, result: InboxResult): Promise<boolean>;
  // Tipo y momento del evento ya guardado con ese eventId, para detectar el mismo id con otro contenido.
  findSummary(eventId: string): Promise<{ eventType: string; occurredAt: string } | null>;
  // Actualiza el renglón del módulo emisor (último recibido y contadores).
  touchSource(source: string, occurredAt: string, outcome: "stored" | "ignored"): Promise<void>;
  // Más nuevos primero; el cursor es opaco.
  list(limit: number, cursor: string | null): Promise<InboxPage>;
}
