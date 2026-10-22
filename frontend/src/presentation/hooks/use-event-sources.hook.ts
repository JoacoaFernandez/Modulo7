// Hooks: reusable stateful logic that connects presentation components to use cases.
import { useEffect, useState } from "react";
import type { EventSource } from "@/domain/entities/analytics.entity";
import { AnalyticsRepositoryImpl } from "@/infrastructure/repositories/analytics.repository.impl";
import { GetEventSourcesUseCase } from "@/application/use-cases/get-event-sources.use-case";

const getEventSourcesUseCase = new GetEventSourcesUseCase(new AnalyticsRepositoryImpl());

interface EventSourcesState {
  sources: EventSource[];
  isLoading: boolean;
  error: string | null;
}

// Los módulos emisores con su última ingesta: GET /api/v1/sources (público).
export function useEventSources(): EventSourcesState {
  const [state, setState] = useState<EventSourcesState>({ sources: [], isLoading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();

    getEventSourcesUseCase
      .execute(controller.signal)
      .then((sources) => {
        if (!controller.signal.aborted) setState({ sources, isLoading: false, error: null });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setState({ sources: [], isLoading: false, error: error.message });
      });

    return () => controller.abort();
  }, []);

  return state;
}
