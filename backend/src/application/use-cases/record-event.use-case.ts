// Use cases: application-specific business rules, orchestrate domain entities and repositories.
import { InboxRepository } from "../../domain/repositories/inbox.repository";
import { validateEnvelope } from "../../domain/services/event-envelope-validator.service";
import { EventEnvelope } from "../../domain/entities/inbox-event.entity";
import { EventValidationError } from "../../shared/event-validation-error";

export type RecordEventOutcome = "stored" | "duplicate" | "ignored";

export interface RecordEventOptions {
  // Guardar también los eventType fuera del catálogo (result = UNKNOWN_TYPE).
  storeUnknown: boolean;
  // Efecto lateral de backoffice.user.upserted/disabled: invalidar el nombre cacheado de ese userId.
  onUserChanged?: (userId: string) => void;
}

export class RecordEventUseCase {
  constructor(
    private readonly inbox: InboxRepository,
    private readonly options: RecordEventOptions,
  ) {}

  // Valida envelope y data, aplica el tratamiento del catálogo (guardar, efecto lateral o descartar) y es
  // idempotente por eventId. Lanza EventValidationError (permanente) si el evento no cumple el contrato; los
  // errores de la base suben tal cual (transitorios: el consumer los reintenta).
  async execute(raw: unknown): Promise<RecordEventOutcome> {
    const validation = validateEnvelope(raw);
    if ("problems" in validation) throw new EventValidationError(validation.problems);

    const { envelope, entry } = validation;

    if (!entry) {
      if (!this.options.storeUnknown) return this.discard(envelope);
      return this.store(envelope, envelope.data, "UNKNOWN_TYPE");
    }

    if (entry.handling === "side-effect" && entry.eventType.startsWith("backoffice.user.")) {
      const userId = envelope.data.userId;
      if (typeof userId === "string") this.options.onUserChanged?.(userId);
    }

    if (entry.handling !== "persist") return this.discard(envelope);

    // Se borran los campos redactados (p. ej. userId de compras) antes de guardar.
    const data = { ...envelope.data };
    for (const field of entry.redact ?? []) delete data[field];

    return this.store(envelope, data, "OK");
  }

  private async discard(envelope: EventEnvelope): Promise<RecordEventOutcome> {
    await this.inbox.touchSource(envelope.source, envelope.occurredAt, "ignored");
    return "ignored";
  }

  private async store(
    envelope: EventEnvelope,
    data: Record<string, unknown>,
    result: "OK" | "UNKNOWN_TYPE",
  ): Promise<RecordEventOutcome> {
    const inserted = await this.inbox.insertIfAbsent({ ...envelope, data }, result);

    if (!inserted) {
      // Duplicado: no cuenta ni pisa. Mismo eventId con otro contenido: se ignora y se avisa.
      const existing = await this.inbox.findSummary(envelope.eventId);
      if (
        existing &&
        (existing.eventType !== envelope.eventType ||
          new Date(existing.occurredAt).getTime() !== new Date(envelope.occurredAt).getTime())
      ) {
        console.warn(`eventId ${envelope.eventId} repetido con otro contenido (se ignora el nuevo).`);
      }
      return "duplicate";
    }

    await this.inbox.touchSource(envelope.source, envelope.occurredAt, "stored");
    return "stored";
  }
}
