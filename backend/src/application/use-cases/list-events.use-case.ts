// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { InboxPage, InboxRepository } from "../../domain/repositories/inbox.repository";

export const DEFAULT_EVENTS_LIMIT = 50;
export const MAX_EVENTS_LIMIT = 200;

export class ListEventsUseCase {
  constructor(private readonly inbox: InboxRepository) {}

  // Listado de depuración, paginado: los más nuevos primero.
  execute(limit: number = DEFAULT_EVENTS_LIMIT, cursor: string | null = null): Promise<InboxPage> {
    return this.inbox.list(Math.min(Math.max(limit, 1), MAX_EVENTS_LIMIT), cursor);
  }
}
