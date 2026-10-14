
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

export interface EventSource {
  module: SourceModule;
  // Etiqueta visible, con acentos: "académica".
  label: string;
  lastIngestionAt: string;
}
