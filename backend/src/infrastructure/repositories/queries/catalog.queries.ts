// Última ingesta por módulo emisor (source_ingestions). Sedes, períodos y facultades salen de los gateways.
import { PrismaClient } from "@prisma/client";
import { isCoreSource, SOURCE_BY_CORE, SourceModule } from "../../../domain/entities/event-source.entity";

export interface ModuleIngestion {
  module: SourceModule;
  // Último received_at de ese módulo (ISO 8601).
  lastReceivedAt: string;
}

// Última recepción por módulo emisor (source_ingestions, incluye los eventos descartados); los módulos que nunca
// mandaron nada no aparecen. `source` de CORE se traduce al módulo de nuestro dominio.
export async function queryModuleIngestions(prisma: PrismaClient): Promise<ModuleIngestion[]> {
  const rows = await prisma.sourceIngestion.findMany();

  return rows.flatMap((row) =>
    isCoreSource(row.source)
      ? [{ module: SOURCE_BY_CORE[row.source], lastReceivedAt: row.lastReceivedAt.toISOString() }]
      : [],
  );
}
