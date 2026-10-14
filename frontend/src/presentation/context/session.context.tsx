// Context: sesión del usuario (login de CORE + filtros de sede/período), persistida en localStorage.
// El diseño no usa router: una sola pantalla que alterna entre login y dashboard según haya sesión.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthSession } from "@/domain/entities/auth.entity";
import { authTokenStore } from "@/infrastructure/api/auth-token.store";
import { SessionContext, type SessionContextValue, type SessionState } from "../hooks/use-session.hook";

const STORAGE_KEY = "uadenet.session";

// Defaults del diseño (coinciden con el fallback que aplica el backend cuando no llega
// query param): "Todas las sedes", "2026-1C", "Ago 2026". Se usan hasta que el primer
// GET /filters confirme cuáles son los valores vigentes del dataset.
const DEFAULT_SITE_ID = "todas-las-sedes";
const DEFAULT_QUARTER = "2026-1C";
const DEFAULT_MONTH = "Ago 2026";

const initialState: SessionState = {
  auth: null,
  siteId: DEFAULT_SITE_ID,
  quarter: DEFAULT_QUARTER,
  month: DEFAULT_MONTH,
};

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.token === "string" &&
    typeof candidate.expiresAt === "string" &&
    typeof candidate.user?.email === "string" &&
    Array.isArray(candidate.user.roles) &&
    candidate.user.roles.length > 0 &&
    candidate.user.roles.every((role) => role === "academica" || role === "financiera")
  );
}

function readStoredState(): SessionState {
  if (typeof window === "undefined") return initialState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw) as Partial<Record<keyof SessionState, unknown>>;
    const auth = isAuthSession(parsed.auth) && Date.parse(parsed.auth.expiresAt) > Date.now() ? parsed.auth : null;

    // El token tiene que estar disponible antes del primer render de los hijos, que ya
    // piden datos en su primer efecto.
    authTokenStore.set(auth?.token ?? null);

    return {
      auth,
      siteId: typeof parsed.siteId === "string" ? parsed.siteId : DEFAULT_SITE_ID,
      quarter: typeof parsed.quarter === "string" ? parsed.quarter : DEFAULT_QUARTER,
      month: typeof parsed.month === "string" ? parsed.month : DEFAULT_MONTH,
    };
  } catch {
    // localStorage corrupto o inaccesible (modo privado, etc.): arrancar de cero.
    return initialState;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readStoredState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sin persistencia disponible: la sesión sigue funcionando solo en memoria.
    }
  }, [state]);

  const login = useCallback((auth: AuthSession) => {
    authTokenStore.set(auth.token);
    setState((prev) => ({ ...prev, auth }));
  }, []);

  const logout = useCallback(() => {
    authTokenStore.set(null);
    setState((prev) => ({ ...prev, auth: null }));
  }, []);

  // Si el backend responde 401 (token vencido), se vuelve al login.
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
    () => ({ ...state, user: state.auth?.user ?? null, login, logout, setSiteId, setQuarter, setMonth }),
    [state, login, logout, setSiteId, setQuarter, setMonth],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
