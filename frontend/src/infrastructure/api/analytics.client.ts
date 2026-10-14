// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
import { authTokenStore } from "./auth-token.store";
import type {
  AcademicFilters,
  AcademicStats,
  EventSource,
  EventStats,
  FilterOptions,
  FinancialFilters,
  FinancialStats,
} from "../../domain/entities/analytics.entity";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = authTokenStore.get();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  // CORE rechazó el token (vencido o inválido): la sesión se cierra y vuelve el login.
  if (response.status === 401) {
    authTokenStore.notifyUnauthorized();
  }

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
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
      `/analytics/dashboard/academic${toQueryString({ sedeId: filters.siteId, cuatrimestre: filters.quarter })}`,
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
