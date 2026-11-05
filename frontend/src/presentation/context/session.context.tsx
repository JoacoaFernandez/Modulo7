// Context: sesión del usuario (login de CORE + filtros de sede/período), persistida en localStorage.
// El diseño no usa router: una sola pantalla que alterna entre login y dashboard según haya sesión.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthSession } from "@/domain/entities/auth.entity";
import { authTokenStore } from "@/infrastructure/api/auth-token.store";
import { SessionContext, type SessionContextValue, type SessionState } from "../hooks/use-session.hook";

const STORAGE_KEY = "uadenet.session";

// Sede y períodos son la última elección del usuario (null si nunca eligió). Los catálogos
// son dinámicos (salen de los eventos), así que no hay defaults acá: la página resuelve el
// valor efectivo contra GET /filters y no pide tableros hasta tenerlo.
const initialState: SessionState = {
  auth: null,
  siteId: null,
  quarter: null,
  facultyId: null,
  month: null,
  eventsSiteId: null,
  eventsMonth: null,
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
      siteId: typeof parsed.siteId === "string" ? parsed.siteId : null,
      quarter: typeof parsed.quarter === "string" ? parsed.quarter : null,
      facultyId: typeof parsed.facultyId === "string" ? parsed.facultyId : null,
      month: typeof parsed.month === "string" ? parsed.month : null,
      // Estados guardados con la forma vieja no los tienen: null → default del backend.
      eventsSiteId: typeof parsed.eventsSiteId === "string" ? parsed.eventsSiteId : null,
      eventsMonth: typeof parsed.eventsMonth === "string" ? parsed.eventsMonth : null,
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

  const setFacultyId = useCallback((facultyId: string | null) => {
    setState((prev) => ({ ...prev, facultyId }));
  }, []);

  const setMonth = useCallback((month: string) => {
    setState((prev) => ({ ...prev, month }));
  }, []);

  const setEventsSiteId = useCallback((eventsSiteId: string) => {
    setState((prev) => ({ ...prev, eventsSiteId }));
  }, []);

  const setEventsMonth = useCallback((eventsMonth: string) => {
    setState((prev) => ({ ...prev, eventsMonth }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, user: state.auth?.user ?? null, login, logout, setSiteId, setQuarter, setFacultyId, setMonth, setEventsSiteId, setEventsMonth }),
    [state, login, logout, setSiteId, setQuarter, setFacultyId, setMonth, setEventsSiteId, setEventsMonth],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
