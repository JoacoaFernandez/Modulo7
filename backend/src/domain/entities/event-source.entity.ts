// Domain entities: core business objects, independent of frameworks and infrastructure.

// Los 9 módulos de UADEnet (todos menos Analítica, que es el 7) que emiten eventos.
export type SourceModule =
  | "portal-estudiante"
  | "portal-docente"
  | "biblioteca"
  | "comedor"
  | "tienda"
  | "eventos"
  | "backoffice"
  | "gestion-academica"
  | "core";

export const SOURCE_MODULES: readonly SourceModule[] = [
  "portal-estudiante",
  "portal-docente",
  "biblioteca",
  "comedor",
  "tienda",
  "eventos",
  "backoffice",
  "gestion-academica",
  "core",
];

export function isSourceModule(value: unknown): value is SourceModule {
  return typeof value === "string" && SOURCE_MODULES.includes(value as SourceModule);
}

export type EventSourceStatus = "connected" | "degraded" | "disconnected";

export interface EventSource {
  module: SourceModule;
  // Etiqueta visible, con acentos: "gestión académica".
  label: string;
  status: EventSourceStatus;
  lastIngestionAt: string;
}
