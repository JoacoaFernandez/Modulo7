// Use cases: application-specific business rules, orchestrate domain entities and repositories.
// Procesa una entrega de la cola analytics.all-events.v1 (contrato CORE §10.3). No depende del
// transporte: hoy lo llama el endpoint de desarrollo y mañana el consumer de RabbitMQ.
import { ConsumeStatus } from "../../domain/entities/core-event.entity";
import { findEventSchema } from "../../domain/entities/event-schemas";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { InboxRepository } from "../../domain/repositories/inbox.repository";
import { parseCoreEnvelope } from "../../domain/services/core-envelope.service";
import { validateEventPayload } from "../../domain/services/event-payload-validator.service";
import { ValidationError } from "../../shared/validation-error";

export interface ConsumeResult {
  eventId: string;
  eventType: string;
  status: ConsumeStatus;
}

export class ConsumeCoreEventUseCase {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly inbox: InboxRepository,
  ) {}

  // Un sobre o un `data` inválido lanza EVENT_SCHEMA_INVALID: con RabbitMQ ese mensaje va a
  // la DLQ, no se reintenta.
  async execute(body: unknown): Promise<ConsumeResult> {
    const { envelope, problems } = parseCoreEnvelope(body);
    if (!envelope) throw new ValidationError(`Sobre inválido: ${problems.join(" ")}`, "EVENT_SCHEMA_INVALID");

    const result = (status: ConsumeStatus): ConsumeResult => ({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      status,
    });

    // Con binding # llega todo el bus: lo que ningún tablero usa se confirma sin efecto.
    if (!findEventSchema(envelope.eventType)) return result("IGNORED");

    const dataProblems = validateEventPayload(envelope.eventType, envelope.data);
    const blocking = [...(dataProblems?.missing ?? []), ...(dataProblems?.invalid ?? [])];
    if (blocking.length > 0) {
      throw new ValidationError(`"data" no cumple el esquema de ${envelope.eventType}: ${blocking.join(" ")}`, "EVENT_SCHEMA_INVALID");
    }

    if (!(await this.inbox.register(envelope.eventId))) return result("DUPLICATE");

    await this.analyticsRepository.recordEvent({ envelope, receivedAt: new Date().toISOString() });
    return result("PROCESSED");
  }
}
