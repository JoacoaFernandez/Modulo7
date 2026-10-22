// Hooks: reusable stateful logic that connects presentation components to use cases.
import { createContext, useContext } from "react";
import type { AuthSession, SessionUser } from "@/domain/entities/auth.entity";

export interface SessionState {
  // Sesión de CORE; null mientras no se haya iniciado sesión.
  auth: AuthSession | null;
  // "" = todas las sedes (no se manda siteId).
  siteId: string;
  // termId del cuatrimestre; "" = el vigente según el backend.
  quarter: string;
  // AAAA-MM; "" = el vigente según el backend.
  month: string;
}

export interface SessionContextValue extends SessionState {
  user: SessionUser | null;
  // true mientras se intenta reabrir la sesión con la cookie de refresh al cargar la app.
  isRestoring: boolean;
  login: (session: AuthSession) => void;
  // Cierra la sesión pero conserva sede/período elegidos.
  logout: () => void;
  setSiteId: (siteId: string) => void;
  setQuarter: (quarter: string) => void;
  setMonth: (month: string) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return context;
}
