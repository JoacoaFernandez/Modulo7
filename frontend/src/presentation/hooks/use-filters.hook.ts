// Hooks: reusable stateful logic that connects presentation components to use cases.
import { useCallback, useEffect, useState } from "react";
import type { FilterOptions } from "@/domain/entities/analytics.entity";
import { AnalyticsRepositoryImpl } from "@/infrastructure/repositories/analytics.repository.impl";
import { GetFiltersUseCase } from "@/application/use-cases/get-filters.use-case";

const analyticsRepository = new AnalyticsRepositoryImpl();
const getFiltersUseCase = new GetFiltersUseCase(analyticsRepository);

interface FiltersState {
  options: FilterOptions | null;
  isLoading: boolean;
  error: string | null;
  // reloadToken con el que se pidió este resultado.
  token: number;
}

// Sedes, cuatrimestres, meses y defaults disponibles: GET /api/analytics/filters.
// Es data prácticamente estática (no depende de sede/período): se pide al montar y de nuevo con
// reload() (botón Actualizar), por si aparecieron sedes, meses o cuatrimestres nuevos.
export function useFilters() {
  const [state, setState] = useState<FiltersState>({ options: null, isLoading: true, error: null, token: 0 });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getFiltersUseCase
      .execute(controller.signal)
      .then((options) => {
        setState({ options, isLoading: false, error: null, token: reloadToken });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, isLoading: false, error: error.message, token: reloadToken }));
      });

    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const { token, ...rest } = state;
  return { ...rest, isRefreshing: token !== reloadToken, reload };
}
