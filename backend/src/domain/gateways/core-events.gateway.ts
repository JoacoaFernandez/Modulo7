// CORE: eventos históricos (GET /internal/v1/events), sólo para el script de backfill.
export interface CoreEventsQuery {
  type?: string;
  source?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface CoreEventsPage {
  // Envelopes v1 sin validar: los valida RecordEventUseCase.
  items: unknown[];
  nextCursor: string | null;
}

export interface CoreEventsGateway {
  listEvents(query: CoreEventsQuery): Promise<CoreEventsPage>;
}
