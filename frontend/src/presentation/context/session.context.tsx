// Context: sesión del usuario (login de CORE + filtros de sede/período).
// El access token vive sólo en memoria (CORE lo exige así); lo único que se persiste en localStorage
// son las preferencias de filtros. Al cargar la página se intenta un refresh con la cookie HttpOnly
// para restaurar la sesión. El diseño no usa router: una sola pantalla que alterna entre login y
// dashboard según haya sesión.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthSession } from "@/domain/entities/auth.entity";
import { authClient } from "@/infrastructure/api/auth.client";
import { authTokenStore } from "@/infrastructure/api/auth-token.store";
import { refreshSession } from "@/infrastructure/api/session-refresh";
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

// Una sesión sin al menos una sección de Analítica no sirve: se trata como sin sesión.
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

// Sólo preferencias de filtros. Las guardadas con la forma vieja (token incluido) se leen sin el token
// y se reescriben limpias en el primer guardado.
function readStoredPreferences(): SessionState {
  if (typeof window === "undefined") return initialState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw) as Partial<Record<keyof SessionState, unknown>>;
    const text = (value: unknown) => (typeof value === "string" ? value : null);

    return {
      auth: null,
      siteId: text(parsed.siteId),
      quarter: text(parsed.quarter),
      facultyId: text(parsed.facultyId),
      month: text(parsed.month),
      eventsSiteId: text(parsed.eventsSiteId),
      eventsMonth: text(parsed.eventsMonth),
    };
  } catch {
    // localStorage corrupto o inaccesible (modo privado, etc.): arrancar de cero.
    return initialState;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readStoredPreferences);
  // true hasta saber si la cookie de refresh restaura una sesión (evita el parpadeo del login).
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    try {
      // Sin `auth`: el token no se persiste.
      const { siteId, quarter, facultyId, month, eventsSiteId, eventsMonth } = state;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ siteId, quarter, facultyId, month, eventsSiteId, eventsMonth }),
      );
    } catch {
      // Sin persistencia disponible: las preferencias sólo duran la visita.
    }
  }, [state]);

  const login = useCallback((auth: AuthSession) => {
    authTokenStore.set(auth.token);
    setState((prev) => ({ ...prev, auth }));
  }, []);

  // Cierra la sesión local y revoca el refresh token en el backend (un fallo de red no la retiene).
  const logout = useCallback(() => {
    authTokenStore.set(null);
    setState((prev) => ({ ...prev, auth: null }));
    void authClient.logout();
  }, []);

  // Restauración al cargar. refreshSession comparte la promesa en vuelo: el doble efecto de StrictMode
  // en desarrollo no rota dos veces el refresh token.
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((session) => {
        if (!cancelled && isAuthSession(session)) setState((prev) => ({ ...prev, auth: session }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh silencioso (token vencido): actualiza el token de la sesión sin tocar nada más.
  // Si el refresh falla, el backend no puede renovar: se vuelve al login (sin llamar a /logout: ya no hay cookie válida).
  useEffect(() => {
    authTokenStore.onRefreshed((session) => {
      if (isAuthSession(session)) setState((prev) => (prev.auth ? { ...prev, auth: session } : prev));
    });
    authTokenStore.onUnauthorized(() => {
      authTokenStore.set(null);
      setState((prev) => ({ ...prev, auth: null }));
    });
    return () => {
      authTokenStore.onRefreshed(null);
      authTokenStore.onUnauthorized(null);
    };
  }, []);

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
    () => ({ ...state, isRestoring, user: state.auth?.user ?? null, login, logout, setSiteId, setQuarter, setFacultyId, setMonth, setEventsSiteId, setEventsMonth }),
    [state, isRestoring, login, logout, setSiteId, setQuarter, setFacultyId, setMonth, setEventsSiteId, setEventsMonth],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
