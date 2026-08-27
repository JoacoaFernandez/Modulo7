// Hooks: reusable stateful logic that connects presentation components to use cases.
import { useEffect, useState } from "react";
import type { FilterOptions } from "@/domain/entities/analytics.entity";
import { AnalyticsRepositoryImpl } from "@/infrastructure/repositories/analytics.repository.impl";
import { GetFiltersUseCase } from "@/application/use-cases/get-filters.use-case";

const analyticsRepository = new AnalyticsRepositoryImpl();
const getFiltersUseCase = new GetFiltersUseCase(analyticsRepository);

interface FiltersState {
  options: FilterOptions | null;
  isLoading: boolean;
  error: string | null;
}

// Sedes, cuatrimestres, meses y defaults disponibles: GET /api/analytics/filters.
// Es data prácticamente estática (no depende de sede/período), así que se pide una sola vez.
export function useFilters() {
  const [state, setState] = useState<FiltersState>({ options: null, isLoading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();

    getFiltersUseCase
      .execute(controller.signal)
      .then((options) => {
        setState({ options, isLoading: false, error: null });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, isLoading: false, error: error.message }));
      });

    return () => controller.abort();
  }, []);

  return state;
}
