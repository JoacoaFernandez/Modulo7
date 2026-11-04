// Pie de cada tablero: qué módulos lo alimentan y cuándo llegó el último evento.
import { SourceModule } from "../../../domain/entities/event-source.entity";
import { ModuleIngestion } from "../queries/catalog.queries";

export interface SourceMeta {
  sourceModules: SourceModule[];
  lastIngestionAt: string | null;
}

// Módulos del tablero que ya mandaron al menos un evento; la última ingesta es la de cualquier módulo
// (ISO 8601 ordena igual como texto), o null con la base vacía.
export function buildSourceMeta(ingestions: ModuleIngestion[], feeders: readonly SourceModule[]): SourceMeta {
  const received = new Set(ingestions.map((ingestion) => ingestion.module));
  const latest = ingestions.map((ingestion) => ingestion.lastReceivedAt).sort().pop() ?? null;

  return { sourceModules: feeders.filter((module) => received.has(module)), lastIngestionAt: latest };
}
