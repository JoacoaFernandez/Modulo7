// Hooks: reusable stateful logic that connects presentation components to use cases.
import { useEffect, useState } from "react";
import type { AcademicStats, FinancialStats, EventStats } from "@/domain/entities/analytics.entity";
import { AnalyticsRepositoryImpl } from "@/infrastructure/repositories/analytics.repository.impl";
import { GetAcademicDashboardUseCase } from "@/application/use-cases/get-academic-dashboard.use-case";
import { GetFinancialDashboardUseCase } from "@/application/use-cases/get-financial-dashboard.use-case";
import { GetEventsStatsUseCase } from "@/application/use-cases/get-events-stats.use-case";

const analyticsRepository = new AnalyticsRepositoryImpl();
const getAcademicDashboardUseCase = new GetAcademicDashboardUseCase(analyticsRepository);
const getFinancialDashboardUseCase = new GetFinancialDashboardUseCase(analyticsRepository);
const getEventsStatsUseCase = new GetEventsStatsUseCase(analyticsRepository);

export interface InstitutionalAnalyticsFilters {
  siteName: string;
  quarter: string;
  month: string;
}

interface InstitutionalAnalyticsState {
  academicStats: AcademicStats | null;
  financialStats: FinancialStats | null;
  eventsStats: EventStats | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: InstitutionalAnalyticsState = {
  academicStats: null,
  financialStats: null,
  eventsStats: null,
  isLoading: true,
  error: null,
};

// Refetchea los 3 tableros cada vez que cambia sede/cuatrimestre/mes. Cada cambio de filtro
// cancela el pedido anterior con AbortController, para no pisar el estado con una respuesta
// que llegó tarde y ya no corresponde a los filtros actuales.
export function useInstitutionalAnalytics(filters: InstitutionalAnalyticsFilters) {
  const [state, setState] = useState<InstitutionalAnalyticsState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    Promise.all([
      getAcademicDashboardUseCase.execute({ siteName: filters.siteName, quarter: filters.quarter }, signal),
      getFinancialDashboardUseCase.execute({ siteName: filters.siteName, month: filters.month }, signal),
      getEventsStatsUseCase.execute({ siteName: filters.siteName, month: filters.month }, signal),
    ])
      .then(([academicStats, financialStats, eventsStats]) => {
        if (signal.aborted) return;
        setState({ academicStats, financialStats, eventsStats, isLoading: false, error: null });
      })
      .catch((error: Error) => {
        if (signal.aborted) return;
        setState((prev) => ({ ...prev, isLoading: false, error: error.message }));
      });

    return () => controller.abort();
  }, [filters.siteName, filters.quarter, filters.month]);

  return state;
}
