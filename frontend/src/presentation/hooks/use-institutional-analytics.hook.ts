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
  // Tablero que se está viendo: "financial" incluye las estadísticas de eventos.
  // "sources" no es un tablero: no pide nada.
  section: "academic" | "financial" | "sources";
  siteId: string;
  quarter: string;
  month: string;
}

interface Loaded {
  // Filtros con los que se pidió este resultado: si no coinciden con los actuales, está viejo.
  key: string;
  academicStats: AcademicStats | null;
  financialStats: FinancialStats | null;
  eventsStats: EventStats | null;
  error: string | null;
}

// Refetchea el tablero visible cada vez que cambia sección/sede/cuatrimestre/mes. Cada cambio
// cancela el pedido anterior con AbortController, para no pisar el estado con una respuesta
// que llegó tarde y ya no corresponde a los filtros actuales. Se pide solo lo de la sección
// activa (académico, o financiero + eventos): el backend responde 403 si el usuario no tiene
// ese rol.
export function useInstitutionalAnalytics(filters: InstitutionalAnalyticsFilters) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const { section, siteId, quarter, month } = filters;
  const key = `${section}|${siteId}|${quarter}|${month}`;

  useEffect(() => {
    if (section === "sources") return;

    const controller = new AbortController();
    const { signal } = controller;

    const request =
      section === "academic"
        ? getAcademicDashboardUseCase
            .execute({ siteId, quarter }, signal)
            .then((academicStats) => ({ academicStats, financialStats: null, eventsStats: null }))
        : Promise.all([
            getFinancialDashboardUseCase.execute({ siteId, month }, signal),
            getEventsStatsUseCase.execute({ siteId, month }, signal),
          ]).then(([financialStats, eventsStats]) => ({ academicStats: null, financialStats, eventsStats }));

    request
      .then((stats) => {
        if (signal.aborted) return;
        setLoaded({ key, ...stats, error: null });
      })
      .catch((error: Error) => {
        if (signal.aborted) return;
        setLoaded({ key, academicStats: null, financialStats: null, eventsStats: null, error: error.message });
      });

    return () => controller.abort();
  }, [key, section, siteId, quarter, month]);

  if (section === "sources") {
    return { academicStats: null, financialStats: null, eventsStats: null, isLoading: false, error: null };
  }

  const current = loaded?.key === key ? loaded : null;

  return {
    academicStats: current?.academicStats ?? null,
    financialStats: current?.financialStats ?? null,
    eventsStats: current?.eventsStats ?? null,
    isLoading: current === null,
    error: current?.error ?? null,
  };
}
