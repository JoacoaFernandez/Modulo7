// Context: sesión simulada (rol activo + filtros de sede/período), persistida en localStorage.
// El diseño no usa router: una sola pantalla que alterna entre "login" y "dash" según haya rol.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RoleId } from "@/domain/entities/analytics.entity";

const STORAGE_KEY = "uadenet.session";

// Defaults del diseño (coinciden con el fallback que aplica el backend cuando no llega
// query param): "Todas las sedes", "2026-1C", "Ago 2026". Se usan hasta que el primer
// GET /filters confirme cuáles son los valores vigentes del dataset.
const DEFAULT_SITE_NAME = "Todas las sedes";
const DEFAULT_QUARTER = "2026-1C";
const DEFAULT_MONTH = "Ago 2026";

interface SessionState {
  role: RoleId | null;
  siteName: string;
  quarter: string;
  month: string;
}

const initialState: SessionState = {
  role: null,
  siteName: DEFAULT_SITE_NAME,
  quarter: DEFAULT_QUARTER,
  month: DEFAULT_MONTH,
};

function readStoredState(): SessionState {
  if (typeof window === "undefined") return initialState;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return {
      role: parsed.role === "academica" || parsed.role === "financiera" ? parsed.role : null,
      siteName: typeof parsed.siteName === "string" ? parsed.siteName : DEFAULT_SITE_NAME,
      quarter: typeof parsed.quarter === "string" ? parsed.quarter : DEFAULT_QUARTER,
      month: typeof parsed.month === "string" ? parsed.month : DEFAULT_MONTH,
    };
  } catch {
    // localStorage corrupto o inaccesible (modo privado, etc.): arrancar de cero.
    return initialState;
  }
}

interface SessionContextValue extends SessionState {
  selectRole: (role: RoleId) => void;
  // "Cambiar rol": vuelve al selector, pero conserva sede/período elegidos.
  changeRole: () => void;
  setSiteName: (siteName: string) => void;
  setQuarter: (quarter: string) => void;
  setMonth: (month: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readStoredState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sin persistencia disponible: la sesión sigue funcionando solo en memoria.
    }
  }, [state]);

  const selectRole = useCallback((role: RoleId) => {
    setState((prev) => ({ ...prev, role }));
  }, []);

  const changeRole = useCallback(() => {
    setState((prev) => ({ ...prev, role: null }));
  }, []);

  const setSiteName = useCallback((siteName: string) => {
    setState((prev) => ({ ...prev, siteName }));
  }, []);

  const setQuarter = useCallback((quarter: string) => {
    setState((prev) => ({ ...prev, quarter }));
  }, []);

  const setMonth = useCallback((month: string) => {
    setState((prev) => ({ ...prev, month }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, selectRole, changeRole, setSiteName, setQuarter, setMonth }),
    [state, selectRole, changeRole, setSiteName, setQuarter, setMonth],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return context;
}
