// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
import { API_BASE_URL, toApiError } from "./http";
import { authTokenStore } from "./auth-token.store";
import { refreshSession } from "./session-refresh";
import type {
  AcademicFilters,
  AcademicStats,
  EventSource,
  EventStats,
  FilterOptions,
  FinancialFilters,
  FinancialStats,
} from "../../domain/entities/analytics.entity";

async function fetchWithToken(path: string, signal?: AbortSignal): Promise<{ response: Response; usedToken: string | null }> {
  const usedToken = authTokenStore.get();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    headers: usedToken ? { Authorization: `Bearer ${usedToken}` } : undefined,
  });
  return { response, usedToken };
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const first = await fetchWithToken(path, signal);
  const usedToken = first.usedToken;
  let response = first.response;

  // El access token (15 min) venció: un único refresh compartido y un reintento. Si otro pedido ya
  // renovó el token mientras este viajaba, se reintenta directo con el nuevo.
  if (response.status === 401) {
    try {
      if (authTokenStore.get() === usedToken) await refreshSession();
    } catch {
      // Sin refresh posible (cookie vencida o revocada): la sesión se cierra y vuelve el login.
      authTokenStore.notifyUnauthorized();
      throw await toApiError(response, "Sesión vencida");
    }
    response = (await fetchWithToken(path, signal)).response;
    if (response.status === 401) {
      authTokenStore.notifyUnauthorized();
    }
  }

  if (!response.ok) throw await toApiError(response, "Error al consultar el servidor");
  return response.json() as Promise<T>;
}

// Arma el query string sin params vacíos, para que el backend use sus propios defaults
// cuando el front todavía no conoce sede/período (primer render, antes de GET /filters).
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
      `/analytics/dashboard/academic${toQueryString({ sedeId: filters.siteId, cuatrimestre: filters.quarter, facultad: filters.facultyId ?? undefined })}`,
      signal,
    ),

  getFinancialStats: (filters: FinancialFilters, signal?: AbortSignal) =>
    getJson<FinancialStats>(
      `/analytics/dashboard/financial${toQueryString({ sedeId: filters.siteId, periodo: filters.month })}`,
      signal,
    ),

  getEventsStats: (filters: FinancialFilters, signal?: AbortSignal) =>
    getJson<EventStats>(
      `/analytics/events/stats${toQueryString({ sedeId: filters.siteId, periodo: filters.month })}`,
      signal,
    ),

  getFilters: (signal?: AbortSignal) => getJson<FilterOptions>("/analytics/filters", signal),

  getEventSources: (signal?: AbortSignal) => getJson<EventSource[]>("/analytics/sources", signal),
};
