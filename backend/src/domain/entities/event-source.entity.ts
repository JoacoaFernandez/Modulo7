// Domain entities: core business objects, independent of frameworks and infrastructure.

// Valor de `source` del sobre de CORE: el módulo que publicó el evento. Es también el prefijo
// del eventType (dining.reservation.created.v1 → dining). El Portal del Estudiante no publica
// eventos, por eso no está.
export type SourceModule = "backoffice" | "teacher" | "academic" | "library" | "dining" | "store" | "events" | "core";

export const SOURCE_MODULES: readonly SourceModule[] = [
  "backoffice",
  "teacher",
  "academic",
  "library",
  "dining",
  "store",
  "events",
  "core",
];

// Etiqueta visible, en castellano y con acentos.
export const SOURCE_MODULE_LABELS: Record<SourceModule, string> = {
  backoffice: "backoffice",
  teacher: "portal docente",
  academic: "gestión académica",
  library: "biblioteca",
  dining: "comedor",
  store: "tienda",
  events: "eventos académicos",
  core: "core",
};

export function isSourceModule(value: unknown): value is SourceModule {
  return typeof value === "string" && SOURCE_MODULES.includes(value as SourceModule);
}

export interface EventSource {
  module: SourceModule;
  label: string;
  lastIngestionAt: string;
}
