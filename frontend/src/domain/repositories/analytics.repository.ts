// Repository interfaces: contracts that infrastructure implementations must fulfill.
import type {
  AcademicFilters,
  AcademicStats,
  EventSource,
  EventStats,
  FilterOptions,
  FinancialFilters,
  FinancialStats,
  Role,
} from "../entities/analytics.entity";

// Toda consulta filtrada acepta un AbortSignal para que los hooks puedan descartar
// respuestas fuera de orden cuando el usuario cambia de sede/período rápido.
export interface AnalyticsRepository {
  getAcademicStats(filters: AcademicFilters, signal?: AbortSignal): Promise<AcademicStats>;
  getFinancialStats(filters: FinancialFilters, signal?: AbortSignal): Promise<FinancialStats>;
  getEventsStats(filters: FinancialFilters, signal?: AbortSignal): Promise<EventStats>;
  getFilters(signal?: AbortSignal): Promise<FilterOptions>;
  getRoles(signal?: AbortSignal): Promise<Role[]>;
  getEventSources(signal?: AbortSignal): Promise<EventSource[]>;
}
