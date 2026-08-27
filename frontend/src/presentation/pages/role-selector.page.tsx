// Pages: top-level views assembled from components, wired to hooks and use cases.
// Pantalla 0 del diseño («Acceso simulado»): split navy/blanco, sin router — showRoleSelector
// vs. el dashboard se decide en App.tsx según haya rol en la sesión.
import { useEffect, useState } from "react";
import type { EventSource, Role } from "@/domain/entities/analytics.entity";
import { AnalyticsRepositoryImpl } from "@/infrastructure/repositories/analytics.repository.impl";
import { GetRolesUseCase } from "@/application/use-cases/get-roles.use-case";
import { GetEventSourcesUseCase } from "@/application/use-cases/get-event-sources.use-case";
import { useSession } from "@/presentation/context/session.context";
import { cn } from "@/lib/utils";

const analyticsRepository = new AnalyticsRepositoryImpl();
const getRolesUseCase = new GetRolesUseCase(analyticsRepository);
const getEventSourcesUseCase = new GetEventSourcesUseCase(analyticsRepository);

interface RoleSelectorData {
  roles: Role[];
  sources: EventSource[];
  isLoading: boolean;
  error: string | null;
}

function useRoleSelectorData(): RoleSelectorData {
  const [state, setState] = useState<RoleSelectorData>({
    roles: [],
    sources: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getRolesUseCase.execute(controller.signal),
      getEventSourcesUseCase.execute(controller.signal),
    ])
      .then(([roles, sources]) => {
        if (controller.signal.aborted) return;
        setState({ roles, sources, isLoading: false, error: null });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, isLoading: false, error: error.message }));
      });

    return () => controller.abort();
  }, []);

  return state;
}

// "26/08 04:12", en la zona horaria del dato (el mock viaja con su propio offset -03:00).
function formatLastIngestion(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  })
    .format(date)
    .replace(",", "");
}

export function RoleSelectorPage() {
  const { selectRole } = useSession();
  const { roles, sources, isLoading, error } = useRoleSelectorData();

  const lastIngestionAt = sources.length > 0 ? formatLastIngestion(sources[0].lastIngestionAt) : null;

  return (
    <div className="grid min-h-screen w-full min-w-[1180px] grid-cols-[minmax(360px,0.85fr)_1.15fr]">
      {/* Panel izquierdo: identidad de la plataforma y las 9 fuentes de eventos */}
      <div className="flex flex-col justify-between gap-10 bg-[var(--navy)] px-14 py-16 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--blue)] text-sm font-bold">
            U
          </div>
          <span className="text-base font-semibold tracking-wide">UADEnet</span>
        </div>

        <div className="flex flex-col gap-5">
          <h1 className="font-heading text-[44px] leading-[1.05] font-normal">
            Analítica
            <br />
            Institucional
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Un mismo tablero para los eventos que emiten los 9 módulos de UADEnet: académica,
            finanzas, biblioteca, campus y el resto de la operación.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-white/40">FUENTES DE EVENTOS</p>
          <div className="flex flex-wrap gap-2">
            {isLoading && <span className="text-xs text-white/50">Cargando módulos…</span>}
            {!isLoading &&
              sources.map((source) => (
                <span
                  key={source.module}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs capitalize text-white/80"
                >
                  {source.label}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Panel derecho: selector de rol simulado */}
      <div className="flex flex-col justify-between gap-10 bg-white px-16 py-16">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-[var(--blue)]">ACCESO SIMULADO</p>
            <h2 className="font-heading text-2xl font-normal text-[var(--navy)]">
              Elegí un rol para continuar
            </h2>
          </div>

          {error && <p className="text-sm text-destructive">No se pudieron cargar los roles: {error}</p>}

          <div className="flex flex-col gap-3">
            {isLoading && <p className="text-sm text-muted-foreground">Cargando roles…</p>}
            {!isLoading &&
              roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role.id)}
                  className={cn(
                    "flex items-center gap-4 rounded-[10px] border border-[var(--app-border)] px-5 py-4 text-left transition-colors hover:border-[var(--blue)] hover:bg-[var(--bar-scale-1)]/40",
                  )}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--navy)] text-sm font-semibold text-white">
                    {role.initials}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-[var(--navy)]">{role.name}</span>
                    <span className="text-sm text-muted-foreground">{role.description}</span>
                  </div>
                  <span className="rounded-full bg-[var(--green)]/10 px-2.5 py-1 text-xs font-medium text-[var(--green)]">
                    Disponible
                  </span>
                </button>
              ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[var(--green)]" />
          {lastIngestionAt
            ? `Última ingesta de eventos: ${lastIngestionAt} · ${sources.length} módulos conectados`
            : "Conectando con las fuentes de eventos…"}
        </div>
      </div>
    </div>
  );
}
