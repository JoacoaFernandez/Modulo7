// Hooks: reusable stateful logic that connects presentation components to use cases.
import { useEffect, useState } from "react";
import type { AcademicStats, FinancialStats, EventStats } from "../../domain/entities/analytics.entity";
import { AnalyticsRepositoryImpl } from "../../infrastructure/repositories/analytics.repository.impl";
import { GetAcademicDashboardUseCase } from "../../application/use-cases/get-academic-dashboard.use-case";
import { GetFinancialDashboardUseCase } from "../../application/use-cases/get-financial-dashboard.use-case";
import { GetEventsStatsUseCase } from "../../application/use-cases/get-events-stats.use-case";

const analyticsRepository = new AnalyticsRepositoryImpl();
const getAcademicDashboardUseCase = new GetAcademicDashboardUseCase(analyticsRepository);
const getFinancialDashboardUseCase = new GetFinancialDashboardUseCase(analyticsRepository);
const getEventsStatsUseCase = new GetEventsStatsUseCase(analyticsRepository);

interface InstitutionalAnalyticsState {
  academicStats: AcademicStats | null;
  financialStats: FinancialStats | null;
  eventsStats: EventStats[];
  isLoading: boolean;
  error: string | null;
}

export function useInstitutionalAnalytics() {
  const [state, setState] = useState<InstitutionalAnalyticsState>({
    academicStats: null,
    financialStats: null,
    eventsStats: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getAcademicDashboardUseCase.execute(),
      getFinancialDashboardUseCase.execute(),
      getEventsStatsUseCase.execute(),
    ])
      .then(([academicStats, financialStats, eventsStats]) => {
        if (!isMounted) return;
        setState({ academicStats, financialStats, eventsStats, isLoading: false, error: null });
      })
      .catch((error: Error) => {
        if (!isMounted) return;
        setState((prev) => ({ ...prev, isLoading: false, error: error.message }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
