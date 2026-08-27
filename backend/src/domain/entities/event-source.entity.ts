// Domain entities: core business objects, independent of frameworks and infrastructure.

// Los 9 módulos de UADEnet que emiten eventos hacia Analítica Institucional.
export type SourceModule =
  | "academica"
  | "inscripciones"
  | "evaluaciones"
  | "docencia"
  | "finanzas"
  | "biblioteca"
  | "campus"
  | "soporte"
  | "identidad";

export const SOURCE_MODULES: readonly SourceModule[] = [
  "academica",
  "inscripciones",
  "evaluaciones",
  "docencia",
  "finanzas",
  "biblioteca",
  "campus",
  "soporte",
  "identidad",
];

export function isSourceModule(value: unknown): value is SourceModule {
  return typeof value === "string" && SOURCE_MODULES.includes(value as SourceModule);
}

export type EventSourceStatus = "connected" | "degraded" | "disconnected";

export interface EventSource {
  module: SourceModule;
  // Etiqueta visible, con acentos: "académica".
  label: string;
  status: EventSourceStatus;
  lastIngestionAt: string;
}
