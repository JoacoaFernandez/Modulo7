// Pages: top-level views assembled from components, wired to hooks and use cases.
import { useState } from "react";
import type { AuthUser } from "@/domain/entities/auth.entity";
import type { FilterOptions, Period } from "@/domain/entities/analytics.entity";
import { useSession } from "../hooks/use-session.hook";
import { useInstitutionalAnalytics } from "../hooks/use-institutional-analytics.hook";
import { useEventSources } from "../hooks/use-event-sources.hook";
import { useFilters } from "../hooks/use-filters.hook";
import { AcademicDashboard } from "../components/academic-dashboard.component";
import { FinancialDashboard } from "../components/financial-dashboard.component";
import { EventsDashboard } from "../components/events-dashboard.component";
import { Sidebar, type AnalyticsSection } from "../components/sidebar.component";
import { DataSources } from "../components/data-sources.component";
import { DataWarnings } from "../components/dashboard/data-warnings.component";
import { DashboardHeader } from "../components/dashboard-header.component";

// Eyebrow y título literales del prototipo (rolActual / tituloVista); "events" es la sección
// propia de estadísticas de eventos.
const sectionMeta: Record<AnalyticsSection, { eyebrow: string; title: string }> = {
  academic: { eyebrow: "Dirección Académica", title: "Rendimiento académico" },
  events: { eyebrow: "Dirección Académica", title: "Eventos académicos" },
  financial: { eyebrow: "Dirección Financiera", title: "Situación económica y financiera" },
  sources: { eyebrow: "Analítica Institucional", title: "Fuentes de datos" },
};

// Cada rol habilita sus secciones (la académica incluye los eventos). Un usuario con varios
// roles ve todas las que le corresponden.
const sectionsByRole: Record<AuthUser["roles"][number], AnalyticsSection[]> = {
  academica: ["academic", "events"],
  financiera: ["financial"],
};

// Sede efectiva: la guardada si sigue en el catálogo, si no la agregada (o la primera).
function resolveSiteId(options: FilterOptions | null, stored: string | null): string {
  if (!options) return "";
  const { sites } = options;
  return (
    sites.find((site) => site.id === stored)?.id ?? sites.find((site) => site.isAggregate)?.id ?? sites[0]?.id ?? ""
  );
}

// Período efectivo: el guardado si sigue en el catálogo, si no el default del backend, si no el
// último del catálogo. "" (catálogo vacío) hace que no se mande el param.
function resolvePeriodId(periods: Period[] | undefined, backendDefault: string | undefined, stored: string | null): string {
  if (!periods) return "";
  const ids = periods.map((period) => period.id);
  if (stored && ids.includes(stored)) return stored;
  if (backendDefault && ids.includes(backendDefault)) return backendDefault;
  return ids[ids.length - 1] ?? "";
}

// Facultad efectiva: la guardada si sigue en el catálogo, si no todas (null).
function resolveFacultyId(options: FilterOptions | null, stored: string | null): string | null {
  return options?.faculties.find((faculty) => faculty.id === stored)?.id ?? null;
}

// Valor del <select> para "todas las facultades" (las facultades reales nunca son un texto vacío).
const ALL_FACULTIES = "";

export function InstitutionalAnalyticsPage({ user }: { user: AuthUser }) {
  const availableSections = user.roles.flatMap((role) => sectionsByRole[role]);
  const [activeSection, setActiveSection] = useState<AnalyticsSection>(availableSections[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const {
    siteId: storedSiteId,
    quarter: storedQuarter,
    facultyId: storedFacultyId,
    month: storedMonth,
    eventsSiteId: storedEventsSiteId,
    eventsMonth: storedEventsMonth,
    setSiteId,
    setQuarter,
    setFacultyId,
    setMonth,
    setEventsSiteId,
    setEventsMonth,
    logout,
  } = useSession();
  const { options: filterOptions, error: filtersError, isRefreshing: isRefreshingFilters, reload: reloadFilters } = useFilters();
  const eventSources = useEventSources();

  // Los catálogos son dinámicos: la elección guardada puede haber dejado de existir. Se
  // resuelve contra GET /filters (elección válida, si no el default del backend, si no la
  // primera opción) y no se piden tableros hasta tener el catálogo.
  const isEventsSection = activeSection === "events";
  const isAcademicSection = activeSection === "academic";
  // Eventos tiene sede y mes propios, independientes de los demás tableros.
  const siteId = resolveSiteId(filterOptions, isEventsSection ? storedEventsSiteId : storedSiteId);
  const quarter = resolvePeriodId(filterOptions?.quarters, filterOptions?.defaults.quarter, storedQuarter);
  const facultyId = resolveFacultyId(filterOptions, storedFacultyId);
  const month = resolvePeriodId(
    filterOptions?.months,
    filterOptions?.defaults.month,
    isEventsSection ? storedEventsMonth : storedMonth,
  );
  const {
    academicStats,
    financialStats,
    eventsStats,
    isLoading,
    isRefreshing: isRefreshingStats,
    error,
    reload: reloadStats,
  } = useInstitutionalAnalytics({
    section: activeSection,
    enabled: filterOptions !== null,
    siteId,
    quarter,
    facultyId,
    month,
  });
  const { eyebrow, title } = sectionMeta[activeSection];

  // Actualizar: en los tableros recarga el tablero activo (mismos filtros), el catálogo de filtros
  // y las fuentes; en "Fuentes de datos", sólo las fuentes.
  const isRefreshing = isRefreshingFilters || isRefreshingStats || eventSources.isRefreshing;
  const handleRefresh = () => {
    if (activeSection !== "sources") {
      reloadFilters();
      reloadStats();
    }
    eventSources.reload();
  };

  // El académico filtra por cuatrimestre; financiero y eventos, por mes (mismo criterio que
  // el backend). Mientras GET /filters no responda, los selects muestran "Cargando…". La sede
  // se identifica por el id de Backoffice.
  const loadingOption = [{ value: "", label: "Cargando…" }];
  const siteOptions = filterOptions?.sites.map((site) => ({ value: site.id, label: site.name })) ?? loadingOption;
  const currentPeriod = isAcademicSection ? quarter : month;
  const periodOptions =
    (isAcademicSection ? filterOptions?.quarters : filterOptions?.months)?.map((period) => ({
      value: period.id,
      label: period.label,
    })) ?? loadingOption;

  const facultyOptions = filterOptions
    ? [
        { value: ALL_FACULTIES, label: "Todas las facultades" },
        ...filterOptions.faculties.map((faculty) => ({ value: faculty.id, label: faculty.name })),
      ]
    : loadingOption;

  return (
    <div className="flex min-h-screen w-full bg-[var(--app-bg)]">
      <Sidebar
        availableSections={availableSections}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          eyebrow={eyebrow}
          title={title}
          showFilters={activeSection !== "sources"}
          siteId={siteId}
          siteOptions={siteOptions}
          onSiteChange={isEventsSection ? setEventsSiteId : setSiteId}
          facultyFilter={
            isAcademicSection
              ? {
                  value: facultyId ?? ALL_FACULTIES,
                  options: facultyOptions,
                  onChange: (value) => setFacultyId(value === ALL_FACULTIES ? null : value),
                }
              : undefined
          }
          periodLabel={isAcademicSection ? "Cuatrimestre" : "Período"}
          periodValue={currentPeriod}
          periodOptions={periodOptions}
          onPeriodChange={isAcademicSection ? setQuarter : isEventsSection ? setEventsMonth : setMonth}
          userName={user.name}
          onLogout={logout}
          onOpenMenu={() => setIsSidebarOpen(true)}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8">
          {isLoading && !filtersError && activeSection !== "sources" && (
            <p className="text-sm text-muted-foreground">Cargando estadísticas...</p>
          )}
          {filtersError && activeSection !== "sources" && (
            <p className="text-sm text-destructive">No se pudieron cargar los filtros: {filtersError}</p>
          )}
          {error && <p className="text-sm text-destructive">Error al cargar las estadísticas: {error}</p>}
          {activeSection !== "sources" && filterOptions?.warnings && filterOptions.warnings.length > 0 && (
            <div className="mb-4">
              <DataWarnings warnings={filterOptions.warnings} />
            </div>
          )}

          {!isLoading && !error && (
            <>
              {activeSection === "sources" && <DataSources sources={eventSources.sources} isLoading={eventSources.isLoading} error={eventSources.error} />}
              {activeSection === "academic" && academicStats && <AcademicDashboard stats={academicStats} />}
              {activeSection === "events" && eventsStats && <EventsDashboard stats={eventsStats} />}
              {activeSection === "financial" && financialStats && <FinancialDashboard stats={financialStats} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
