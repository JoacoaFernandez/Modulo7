// Pages: top-level views assembled from components, wired to hooks and use cases.
// Pantalla 0 del diseño: split navy/blanco, sin router — login vs. dashboard se decide en
// App.tsx según haya sesión. El login es contra CORE (hoy un mock en el backend), con el
// mail de la universidad; el rol (dirección académica o financiera) lo define CORE.
import { useState, type FormEvent } from "react";
import { ApiError } from "@/infrastructure/api/http";
import { AuthRepositoryImpl } from "@/infrastructure/repositories/auth.repository.impl";
import { LoginUseCase } from "@/application/use-cases/login.use-case";
import { useEventSources } from "@/presentation/hooks/use-event-sources.hook";
import { useSession } from "@/presentation/hooks/use-session.hook";
import { formatLastIngestion } from "@/lib/format";

const loginUseCase = new LoginUseCase(new AuthRepositoryImpl());

const inputClassName =
  "w-full rounded-[10px] border border-[var(--app-border)] bg-white px-4 py-3 text-sm text-[var(--navy)] outline-none transition-colors placeholder:text-muted-foreground focus:border-[var(--blue)]";

// Mensaje para el usuario: CORE autenticó pero sin rol de Analítica (403) se explica aparte; un fallo
// de red no trae mensaje útil del backend.
function loginErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.code === "ANALYTICS_FORBIDDEN") {
      return "Tu usuario no tiene acceso a Analítica Institucional. El ingreso es para Dirección Académica, Dirección Financiera y administradores; si creés que es un error, pedí el permiso en Backoffice.";
    }
    return caught.message;
  }
  if (caught instanceof TypeError) return "No se pudo conectar con el servidor. Intentá de nuevo en unos minutos.";
  return caught instanceof Error ? caught.message : "No se pudo iniciar sesión.";
}

export function LoginPage() {
  const { login } = useSession();
  const { sources, isLoading } = useEventSources();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La más reciente entre los módulos; null = todavía no llegó ningún evento.
  const latestIso = sources.reduce<string | null>(
    (latest, source) => (source.lastIngestionAt && (!latest || Date.parse(source.lastIngestionAt) > Date.parse(latest)) ? source.lastIngestionAt : latest),
    null,
  );
  const lastIngestionAt = sources.length > 0 ? formatLastIngestion(latestIso) : null;
  const connectedModules = sources.filter((source) => source.lastIngestionAt !== null).length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      login(await loginUseCase.execute({ email, password }));
    } catch (caught) {
      setError(loginErrorMessage(caught));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[minmax(360px,0.85fr)_1.15fr]">
      {/* Panel izquierdo: identidad de la plataforma y las 9 fuentes de eventos */}
      <div className="flex flex-col justify-between gap-10 bg-[var(--navy)] px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-16">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--blue)] text-sm font-bold">
            U
          </div>
          <span className="text-base font-semibold tracking-wide">UADEnet</span>
        </div>

        <div className="flex flex-col gap-5">
          <h1 className="font-heading text-[32px] leading-[1.05] font-normal sm:text-[38px] lg:text-[44px]">
            Analítica
            <br />
            Institucional
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Un mismo tablero para los eventos que emiten los 9 módulos de UADEnet: portales,
            comedor, tienda, eventos, biblioteca y el resto de la operación.
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

      {/* Panel derecho: login con el mail de la universidad */}
      <div className="flex flex-col justify-between gap-10 bg-white px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-[var(--blue)]">INGRESO AL PORTAL</p>
            <h2 className="font-heading text-2xl font-normal text-[var(--navy)]">
              Ingresá con tu mail de la universidad
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--navy)]">
              Mail
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@uade.edu.ar"
                className={inputClassName}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--navy)]">
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClassName}
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer rounded-[10px] bg-[var(--navy)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Ingresando…" : "Ingresar"}
            </button>
          </div>
        </form>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[var(--green)]" />
          {lastIngestionAt
            ? latestIso
              ? `Última ingesta de eventos: ${lastIngestionAt} · ${connectedModules} de ${sources.length} módulos con datos`
              : "Sin datos recibidos todavía"
            : "Conectando con las fuentes de eventos…"}
        </div>
      </div>
    </div>
  );
}
