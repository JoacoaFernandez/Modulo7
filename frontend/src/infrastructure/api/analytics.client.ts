// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
import type { AcademicStats, FinancialStats, EventStats } from "../../domain/entities/analytics.entity";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const analyticsClient = {
  getAcademicStats: () => getJson<AcademicStats>("/analytics/dashboard/academic"),
  getFinancialStats: () => getJson<FinancialStats>("/analytics/dashboard/financial"),
  getEventsStats: () => getJson<EventStats[]>("/analytics/events/stats"),
};
