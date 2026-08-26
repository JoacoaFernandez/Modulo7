// Domain entities: core business objects, independent of frameworks and infrastructure.

export type SourceModule =
  | "portal-estudiante"
  | "portal-docente"
  | "biblioteca"
  | "comedor"
  | "tienda"
  | "eventos-academicos"
  | "backoffice"
  | "gestion-academica";

export interface InstitutionalEvent {
  id: string;
  sourceModule: SourceModule;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
