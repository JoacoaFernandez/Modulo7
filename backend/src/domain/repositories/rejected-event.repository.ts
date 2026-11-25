// Mensajes rechazados de la cola, guardados para reprocesarlos.
export interface RejectedEventInput {
  reason: string;
  // Sólo si el cuerpo era JSON y traía un eventId con forma de UUID.
  eventId: string | null;
  raw: string;
}

export interface RejectedEventRepository {
  save(rejected: RejectedEventInput): Promise<void>;
}
