// Presentation components: layout compartido por los 3 tableros.
// Avisos discretos arriba del tablero: fuentes que no respondieron (`warnings`, en ámbar: el bloque
// afectado sale vacío) y aclaración de alcance (`siteScopeNote`, neutra: no es un error).
import { Info, TriangleAlert } from "lucide-react";
import type { DashboardWarning } from "@/domain/entities/analytics.entity";

interface DataWarningsProps {
  warnings?: DashboardWarning[];
  // Aclaración informativa, p. ej. "saldo, ingresos y egresos son institucionales".
  notice?: string | null;
}

// Nombre legible del servicio que informa el backend.
const SOURCE_LABELS: Record<string, string> = {
  core: "CORE",
  backoffice: "Backoffice",
  academic: "Gestión Académica",
};

export function DataWarnings({ warnings, notice }: DataWarningsProps) {
  const hasWarnings = warnings !== undefined && warnings.length > 0;
  if (!hasWarnings && !notice) return null;

  return (
    <div className="flex flex-col gap-2">
      {hasWarnings && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-[10px] border border-[#EBD9A8] bg-[#FDF8EA] px-3.5 py-2.5 text-[12px] leading-[1.5] text-[#6B5314]"
        >
          <TriangleAlert className="mt-[2px] size-3.5 shrink-0" aria-hidden />
          <ul className="flex flex-col gap-0.5">
            {warnings.map((warning, index) => (
              <li key={`${warning.source}-${index}`}>
                <span className="font-semibold">{SOURCE_LABELS[warning.source] ?? warning.source}:</span> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--app-border)] bg-[#F4F6FA] px-3.5 py-2.5 text-[12px] leading-[1.5] text-[#4A5870]">
          <Info className="mt-[2px] size-3.5 shrink-0" aria-hidden />
          <p>{notice}</p>
        </div>
      )}
    </div>
  );
}
