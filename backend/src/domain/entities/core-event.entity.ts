// Domain entities: core business objects, independent of frameworks and infrastructure.
import { SourceModule } from "./event-source.entity";

// Sobre estándar de todos los eventos de UADEnet (contrato CORE v1, §9.1). Llega por la cola
// analytics.all-events.v1; `data` cambia según el eventType.
export interface CoreEventEnvelope {
  specVersion: string;
  // UUID v4 generado por el emisor: clave de deduplicación de todos los consumidores.
  eventId: string;
  // Exactamente como figura en el catálogo de CORE, con sufijo de versión.
  eventType: string;
  source: SourceModule;
  // Cuándo pasó el hecho de negocio (ISO 8601 UTC), no cuándo se publicó.
  occurredAt: string;
  // Entidad principal, formato tipo/id.
  subject: string;
  correlationId: string | null;
  causationId: string | null;
  actor: { type: string; id: string } | null;
  data: Record<string, unknown>;
}

// Evento ya consumido, tal como lo guarda Analítica.
export interface StoredCoreEvent {
  envelope: CoreEventEnvelope;
  // Momento en que Analítica lo procesó.
  receivedAt: string;
}

// Resultado de procesar una entrega. DUPLICATE e IGNORED se confirman igual (ack) sin efecto.
export type ConsumeStatus = "PROCESSED" | "DUPLICATE" | "IGNORED";
