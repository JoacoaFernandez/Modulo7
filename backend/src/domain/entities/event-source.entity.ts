
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

// Etiqueta visible de cada módulo emisor (configuración).
export const SOURCE_MODULE_LABELS: Record<SourceModule, string> = {
  "portal-estudiante": "portal estudiante",
  "portal-docente": "portal docente",
  biblioteca: "biblioteca",
  comedor: "comedor",
  tienda: "tienda",
  eventos: "eventos académicos",
  backoffice: "backoffice",
  "gestion-academica": "gestión académica",
  core: "core",
};

export interface EventSource {
  module: SourceModule;
  // Etiqueta visible, con acentos: "académica".
  label: string;
  // Último evento recibido de ese módulo (ISO 8601); null si todavía no mandó ninguno.
  lastIngestionAt: string | null;
}

// Valor de `source` del envelope v1 de CORE (CORE v1, §9).
export type CoreSource =
  | "student"
  | "teacher"
  | "library"
  | "dining"
  | "store"
  | "events"
  | "academic"
  | "backoffice"
  | "core";

export const CORE_SOURCES: readonly CoreSource[] = [
  "student",
  "teacher",
  "library",
  "dining",
  "store",
  "events",
  "academic",
  "backoffice",
  "core",
];

export function isCoreSource(value: unknown): value is CoreSource {
  return typeof value === "string" && CORE_SOURCES.includes(value as CoreSource);
}

// `source` (CORE) → módulo de nuestro dominio, para no tocar SourceModule, dashboard.config ni el frontend.
export const SOURCE_BY_CORE: Record<CoreSource, SourceModule> = {
  student: "portal-estudiante",
  teacher: "portal-docente",
  library: "biblioteca",
  dining: "comedor",
  store: "tienda",
  events: "eventos",
  academic: "gestion-academica",
  backoffice: "backoffice",
  core: "core",
};
