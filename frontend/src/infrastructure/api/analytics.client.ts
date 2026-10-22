// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
import { authClient } from "./auth.client";
import { authTokenStore } from "./auth-token.store";
import { toProblemError } from "./problem";
import type {
  AcademicFilters,
  AcademicStats,
  EventSource,
  EventStats,
  FilterOptions,
  FinancialFilters,
  FinancialStats,
} from "../../domain/entities/analytics.entity";

const ANALYTICS_BASE_URL = import.meta.env.VITE_ANALYTICS_BASE_URL ?? "http://localhost:3000/api/v1";

function request(path: string, token: string | null, signal?: AbortSignal): Promise<Response> {
  return fetch(`${ANALYTICS_BASE_URL}${path}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response = await request(path, authTokenStore.get(), signal);

  // Access token vencido: un único refresh (serializado) y se reintenta una vez. Si el refresh
  // falla, la sesión se cierra y vuelve el login.
  if (response.status === 401 && authTokenStore.get()) {
    try {
      const grant = await authClient.refresh();
      authTokenStore.set(grant.accessToken);
    } catch {
      authTokenStore.notifyUnauthorized();
      throw new Error("La sesión expiró. Volvé a iniciar sesión.");
    }
    response = await request(path, authTokenStore.get(), signal);
    if (response.status === 401) authTokenStore.notifyUnauthorized();
  }

  if (!response.ok) throw await toProblemError(response, "No se pudo completar el pedido");
  return response.json() as Promise<T>;
}

// Arma el query string sin params vacíos, para que el backend use sus propios defaults
// (sin siteId = todas las sedes; sin período = el vigente).
function toQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const analyticsClient = {
  getAcademicStats: (filters: AcademicFilters, signal?: AbortSignal) =>
    getJson<AcademicStats>(
      `/dashboard/academic${toQueryString({ siteId: filters.siteId ?? undefined, termId: filters.termId })}`,
      signal,
    ),

  getFinancialStats: (filters: FinancialFilters, signal?: AbortSignal) =>
    getJson<FinancialStats>(
      `/dashboard/financial${toQueryString({ siteId: filters.siteId ?? undefined, month: filters.month })}`,
      signal,
    ),

  getEventsStats: (filters: FinancialFilters, signal?: AbortSignal) =>
    getJson<EventStats>(
      `/events/stats${toQueryString({ siteId: filters.siteId ?? undefined, month: filters.month })}`,
      signal,
    ),

  getFilters: (signal?: AbortSignal) => getJson<FilterOptions>("/filters", signal),

  getEventSources: (signal?: AbortSignal) => getJson<EventSource[]>("/sources", signal),
};
