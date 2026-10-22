// Repository implementations: concrete adapters that fulfill the domain repository interfaces.
// Inbox en memoria mientras no haya base de datos: se pierde al reiniciar el servidor.
import { InboxRepository } from "../../domain/repositories/inbox.repository";

export class InboxRepositoryMemory implements InboxRepository {
  private readonly processed = new Set<string>();

  async register(eventId: string): Promise<boolean> {
    if (this.processed.has(eventId)) return false;

    this.processed.add(eventId);
    return true;
  }
}
