// Hooks: reusable stateful logic that connects presentation components to use cases.
import { useCallback, useEffect, useState } from "react";
import type { EventSource } from "@/domain/entities/analytics.entity";
import { AnalyticsRepositoryImpl } from "@/infrastructure/repositories/analytics.repository.impl";
import { GetEventSourcesUseCase } from "@/application/use-cases/get-event-sources.use-case";

const getEventSourcesUseCase = new GetEventSourcesUseCase(new AnalyticsRepositoryImpl());

interface EventSourcesState {
  sources: EventSource[];
  isLoading: boolean;
  error: string | null;
  // reloadToken con el que se pidió este resultado.
  token: number;
}

// Los 9 módulos emisores con su estado y última ingesta: GET /api/analytics/sources (público).
export function useEventSources() {
  const [state, setState] = useState<EventSourcesState>({ sources: [], isLoading: true, error: null, token: 0 });
  // Se incrementa con reload(): vuelve a pedir las fuentes sin vaciar la lista que ya se ve.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getEventSourcesUseCase
      .execute(controller.signal)
      .then((sources) => {
        if (!controller.signal.aborted) setState({ sources, isLoading: false, error: null, token: reloadToken });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setState({ sources: [], isLoading: false, error: error.message, token: reloadToken });
      });

    return () => controller.abort();
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const { token, ...rest } = state;
  return { ...rest, isRefreshing: token !== reloadToken, reload };
}
