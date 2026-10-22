// Context: sesión del usuario (login de CORE + filtros de sede/período). Solo los filtros se persisten
// en localStorage; el access token vive en memoria y la sesión se reabre con la cookie de refresh.
// El diseño no usa router: una sola pantalla que alterna entre login y dashboard según haya sesión.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthSession } from "@/domain/entities/auth.entity";
import { authTokenStore } from "@/infrastructure/api/auth-token.store";
import { AuthRepositoryImpl } from "@/infrastructure/repositories/auth.repository.impl";
import { RestoreSessionUseCase } from "@/application/use-cases/restore-session.use-case";
import { LogoutUseCase } from "@/application/use-cases/logout.use-case";
import { SessionContext, type SessionContextValue, type SessionState } from "../hooks/use-session.hook";

const authRepository = new AuthRepositoryImpl();
const restoreSessionUseCase = new RestoreSessionUseCase(authRepository);
const logoutUseCase = new LogoutUseCase(authRepository);

// Clave nueva: la anterior guardaba también el token, que CORE no permite persistir.
const STORAGE_KEY = "uadenet.filters";
const LEGACY_STORAGE_KEY = "uadenet.session";

// Vacío = "usar el default del backend" (todas las sedes, cuatrimestre y mes vigentes). Los
// valores guardados que ya no estén en GET /filters se reemplazan por esos defaults en la página.
const initialState: SessionState = {
  auth: null,
  siteId: "",
  quarter: "",
  month: "",
};

function readStoredState(): SessionState {
  if (typeof window === "undefined") return initialState;

  try {
    // Limpia lo que dejó la versión anterior, que guardaba el token en claro.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw) as Partial<Record<keyof SessionState, unknown>>;
    return {
      auth: null,
      siteId: typeof parsed.siteId === "string" ? parsed.siteId : "",
      quarter: typeof parsed.quarter === "string" ? parsed.quarter : "",
      month: typeof parsed.month === "string" ? parsed.month : "",
    };
  } catch {
    // localStorage corrupto o inaccesible (modo privado, etc.): arrancar de cero.
    return initialState;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readStoredState);
  const [isRestoring, setIsRestoring] = useState(true);
  const { siteId, quarter, month } = state;

  // Solo se persisten los filtros; la sesión no.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ siteId, quarter, month }));
    } catch {
      // Sin persistencia disponible: los filtros siguen funcionando solo en memoria.
    }
  }, [siteId, quarter, month]);

  const login = useCallback((auth: AuthSession) => {
    authTokenStore.set(auth.accessToken);
    setState((prev) => ({ ...prev, auth }));
  }, []);

  // Al cargar la app se intenta reabrir la sesión con la cookie de refresh (sobrevive a recargas).
  // Si no hay cookie vigente, queda el login. Los refresh en paralelo (StrictMode) se comparten.
  useEffect(() => {
    let cancelled = false;

    restoreSessionUseCase
      .execute()
      .then((auth) => {
        if (!cancelled) login(auth);
      })
      .catch(() => {
        // Sin sesión previa o vencida: se muestra el login.
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [login]);

  const logout = useCallback(() => {
    authTokenStore.set(null);
    setState((prev) => ({ ...prev, auth: null }));
    // Revoca la cookie de refresh en CORE; si falla igual se cierra localmente.
    logoutUseCase.execute().catch(() => undefined);
  }, []);

  // Si el backend responde 401 y el refresh falla, se vuelve al login.
  useEffect(() => {
    authTokenStore.onUnauthorized(logout);
    return () => authTokenStore.onUnauthorized(null);
  }, [logout]);

  const setSiteId = useCallback((siteId: string) => {
    setState((prev) => ({ ...prev, siteId }));
  }, []);

  const setQuarter = useCallback((quarter: string) => {
    setState((prev) => ({ ...prev, quarter }));
  }, []);

  const setMonth = useCallback((month: string) => {
    setState((prev) => ({ ...prev, month }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, user: state.auth?.user ?? null, isRestoring, login, logout, setSiteId, setQuarter, setMonth }),
    [state, isRestoring, login, logout, setSiteId, setQuarter, setMonth],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
