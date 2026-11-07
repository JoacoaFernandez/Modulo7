// Hooks: reusable stateful logic that connects presentation components to use cases.
import { useCallback, useEffect, useState } from "react";
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
  // Tablero que se está viendo. "sources" no es un tablero: no pide nada.
  section: "academic" | "financial" | "events" | "sources";
  // false mientras no se conozcan los filtros vigentes (GET /filters): no se pide nada para
  // no mandar un período fuera del catálogo (el backend responde 400).
  enabled: boolean;
  siteId: string;
  quarter: string;
  // Facultad del tablero académico; null = todas.
  facultyId: string | null;
  month: string;
}

interface Loaded {
  // Filtros con los que se pidió este resultado: si no coinciden con los actuales, está viejo.
  key: string;
  // reloadToken con el que se pidió: si es menor al actual, hay una recarga en curso.
  token: number;
  academicStats: AcademicStats | null;
  financialStats: FinancialStats | null;
  eventsStats: EventStats | null;
  error: string | null;
}

// Refetchea el tablero visible cada vez que cambian sección o los filtros que le corresponden
// (académico: sede/cuatrimestre/facultad; financiero y eventos: sede/mes, cada uno con la suya). Cada cambio
// cancela el pedido anterior con AbortController, para no pisar el estado con una respuesta
// que llegó tarde y ya no corresponde a los filtros actuales. Se pide solo lo de la sección
// activa (académico, financiero o eventos): el backend responde 403 si el usuario no tiene
// ese rol.
export function useInstitutionalAnalytics(filters: InstitutionalAnalyticsFilters) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Se incrementa con reload(): refetchea con los mismos filtros sin vaciar lo que ya se ve.
  const [reloadToken, setReloadToken] = useState(0);
  const { section, enabled, siteId, quarter, facultyId, month } = filters;
  // Cada sección sólo depende de sus filtros: cambiar el cuatrimestre no refetchea eventos, etc.
  const key = section === "academic" ? `${section}|${siteId}|${quarter}|${facultyId ?? ""}` : `${section}|${siteId}|${month}`;

  useEffect(() => {
    if (section === "sources" || !enabled) return;

    const controller = new AbortController();
    const { signal } = controller;

    const request =
      section === "academic"
        ? getAcademicDashboardUseCase
            .execute({ siteId, quarter, facultyId }, signal)
            .then((academicStats) => ({ academicStats, financialStats: null, eventsStats: null }))
        : section === "events"
          ? getEventsStatsUseCase
              .execute({ siteId, month }, signal)
              .then((eventsStats) => ({ academicStats: null, financialStats: null, eventsStats }))
          : getFinancialDashboardUseCase
              .execute({ siteId, month }, signal)
              .then((financialStats) => ({ academicStats: null, financialStats, eventsStats: null }));

    request
      .then((stats) => {
        if (signal.aborted) return;
        setLoaded({ key, token: reloadToken, ...stats, error: null });
      })
      .catch((error: Error) => {
        if (signal.aborted) return;
        setLoaded({
          key,
          token: reloadToken,
          academicStats: null,
          financialStats: null,
          eventsStats: null,
          error: error.message,
        });
      });

    return () => controller.abort();
  }, [key, section, enabled, siteId, quarter, facultyId, month, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  if (section === "sources") {
    return { academicStats: null, financialStats: null, eventsStats: null, isLoading: false, isRefreshing: false, error: null, reload };
  }

  const current = loaded?.key === key ? loaded : null;

  return {
    academicStats: current?.academicStats ?? null,
    financialStats: current?.financialStats ?? null,
    eventsStats: current?.eventsStats ?? null,
    isLoading: current === null,
    // Recarga manual en curso: los datos anteriores siguen en pantalla hasta que lleguen los nuevos.
    isRefreshing: current !== null && current.token !== reloadToken,
    error: current?.error ?? null,
    reload,
  };
}
