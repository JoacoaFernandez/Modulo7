// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
// Pantalla "Fuentes de datos": los módulos que emiten eventos, su última ingesta y qué tablero alimentan.
// No hay columna de estado: la ingesta es batch (POST por evento), no una conexión abierta.
import type { EventSource, SourceModule } from "@/domain/entities/analytics.entity";
import { formatLastIngestion } from "@/lib/format";
import { SectionCard } from "./dashboard/section-card.component";
import { SectionHeader } from "./dashboard/section-header.component";

// Qué tableros se calculan con los eventos de cada módulo (ver backend/EVENTOS.md).
const FEEDS: Record<SourceModule, string> = {
  academic: "Académico",
  teacher: "Académico",
  backoffice: "Académico y financiero",
  core: "Financiero",
  store: "Financiero",
  dining: "Financiero",
  events: "Estadísticas de eventos",
  library: "Ninguno todavía",
};

interface DataSourcesProps {
  sources: EventSource[];
  isLoading: boolean;
  error: string | null;
}

export function DataSources({ sources, isLoading, error }: DataSourcesProps) {
  return (
    <SectionCard className="p-5 sm:p-6">
      <SectionHeader
        title="Fuentes de eventos"
        description="Módulos de UADEnet que publican eventos en CORE, que los entrega a Analítica Institucional"
      />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando fuentes…</p>}
      {error && <p className="text-sm text-destructive">No se pudieron cargar las fuentes: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--app-border)] text-[11px] font-medium tracking-[0.08em] text-[#647188] uppercase">
                <th className="py-2.5 pr-4 font-medium">Módulo</th>
                <th className="py-2.5 pr-4 font-medium">Última ingesta</th>
                <th className="py-2.5 font-medium">Alimenta</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.module} className="border-b border-[var(--app-border)] last:border-0">
                  <td className="py-3 pr-4 font-medium text-[var(--navy)] capitalize">{source.label}</td>
                  <td className="py-3 pr-4 text-[#41506B]">{formatLastIngestion(source.lastIngestionAt)}</td>
                  <td className="py-3 text-[#41506B]">{FEEDS[source.module]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
