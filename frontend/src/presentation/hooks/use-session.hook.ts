// Hooks: reusable stateful logic that connects presentation components to use cases.
import { createContext, useContext } from "react";
import type { AuthSession, AuthUser } from "@/domain/entities/auth.entity";

export interface SessionState {
  // Sesión de CORE; null mientras no se haya iniciado sesión.
  auth: AuthSession | null;
  // Última elección del usuario; null hasta que elija. Puede quedar fuera del catálogo vigente
  // (los catálogos salen de los eventos): la página lo valida contra GET /filters.
  siteId: string | null;
  quarter: string | null;
  month: string | null;
  // Filtros propios de la sección de eventos, independientes de los demás tableros.
  eventsSiteId: string | null;
  eventsMonth: string | null;
}

export interface SessionContextValue extends SessionState {
  user: AuthUser | null;
  login: (session: AuthSession) => void;
  // Cierra la sesión pero conserva sede/período elegidos.
  logout: () => void;
  setSiteId: (siteId: string) => void;
  setQuarter: (quarter: string) => void;
  setMonth: (month: string) => void;
  setEventsSiteId: (siteId: string) => void;
  setEventsMonth: (month: string) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return context;
}
