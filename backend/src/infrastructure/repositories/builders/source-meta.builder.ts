// Pie de cada tablero: qué módulos lo alimentan y cuándo llegó el último evento.
import { SourceModule } from "../../../domain/entities/event-source.entity";
import { ModuleIngestion } from "../queries/catalog.queries";

export interface SourceMeta {
  sourceModules: SourceModule[];
  lastIngestionAt: string | null;
}

// Módulos del tablero que ya mandaron al menos un evento; la última ingesta es la de esos módulos
// (ISO 8601 ordena igual como texto), o null si ninguno mandó nada.
export function buildSourceMeta(ingestions: ModuleIngestion[], feeders: readonly SourceModule[]): SourceMeta {
  const relevant = ingestions.filter((ingestion) => feeders.includes(ingestion.module));
  const received = new Set(relevant.map((ingestion) => ingestion.module));
  const latest = relevant.map((ingestion) => ingestion.lastReceivedAt).sort().pop() ?? null;

  return { sourceModules: feeders.filter((module) => received.has(module)), lastIngestionAt: latest };
}
