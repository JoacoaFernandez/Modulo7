// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
// Pantalla "Fuentes de datos": los 9 módulos que emiten eventos, su estado y qué tablero alimentan.
import type { EventSource, EventSourceStatus, SourceModule } from "@/domain/entities/analytics.entity";
import { formatLastIngestion } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionCard } from "./dashboard/section-card.component";
import { SectionHeader } from "./dashboard/section-header.component";

// Qué tableros se calculan con los eventos de cada módulo (ver backend/EVENTOS.md).
const FEEDS: Record<SourceModule, string> = {
  "gestion-academica": "Académico",
  "portal-estudiante": "Académico",
  "portal-docente": "Académico",
  backoffice: "Académico y financiero",
  core: "Financiero",
  tienda: "Financiero",
  comedor: "Financiero",
  eventos: "Estadísticas de eventos",
  biblioteca: "Ninguno todavía",
};

const STATUS: Record<EventSourceStatus, { label: string; className: string }> = {
  connected: { label: "Conectado", className: "bg-[var(--green)]/10 text-[var(--green)]" },
  degraded: { label: "Con demoras", className: "bg-amber-100 text-amber-700" },
  disconnected: { label: "Sin conexión", className: "bg-red-100 text-red-700" },
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
        description="Módulos de UADEnet que le mandan eventos a Analítica Institucional por POST /api/analytics/events"
      />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando fuentes…</p>}
      {error && <p className="text-sm text-destructive">No se pudieron cargar las fuentes: {error}</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--app-border)] text-[11px] font-medium tracking-[0.08em] text-[#647188] uppercase">
                <th className="py-2.5 pr-4 font-medium">Módulo</th>
                <th className="py-2.5 pr-4 font-medium">Estado</th>
                <th className="py-2.5 pr-4 font-medium">Última ingesta</th>
                <th className="py-2.5 font-medium">Alimenta</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.module} className="border-b border-[var(--app-border)] last:border-0">
                  <td className="py-3 pr-4 font-medium text-[var(--navy)] capitalize">{source.label}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        STATUS[source.status].className,
                      )}
                    >
                      {STATUS[source.status].label}
                    </span>
                  </td>
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
