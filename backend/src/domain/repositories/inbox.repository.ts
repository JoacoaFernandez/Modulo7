// Repository interfaces: contracts that infrastructure implementations must fulfill.

// Tabla inbox del contrato de CORE (§10.3): registra cada eventId procesado para no repetir
// el efecto ante una reentrega. Con base de datos, el registro y el efecto van en la misma
// transacción, con índice único por eventId.
export interface InboxRepository {
  // false si el eventId ya estaba registrado (reentrega).
  register(eventId: string): Promise<boolean>;
}
