// Pages: top-level views assembled from components, wired to hooks and use cases.
import { useState } from "react";
import type { AuthUser } from "@/domain/entities/auth.entity";
import { useSession } from "../hooks/use-session.hook";
import { useInstitutionalAnalytics } from "../hooks/use-institutional-analytics.hook";
import { useEventSources } from "../hooks/use-event-sources.hook";
import { useFilters } from "../hooks/use-filters.hook";
import { AcademicDashboard } from "../components/academic-dashboard.component";
import { FinancialDashboard } from "../components/financial-dashboard.component";
import { EventsDashboard } from "../components/events-dashboard.component";
import { Sidebar, type AnalyticsSection } from "../components/sidebar.component";
import { DataSources } from "../components/data-sources.component";
import { DashboardHeader } from "../components/dashboard-header.component";

// Eyebrow y título literales del prototipo (rolActual / tituloVista). No hay un tercero para
// "eventos": esa sección vive dentro de "financial" (ver Sidebar y el <section id="eventos">
// más abajo), así que comparte el mismo encabezado.
const sectionMeta: Record<AnalyticsSection, { eyebrow: string; title: string }> = {
  academic: { eyebrow: "Dirección Académica", title: "Rendimiento académico" },
  financial: { eyebrow: "Dirección Financiera", title: "Situación económica y financiera" },
  sources: { eyebrow: "Analítica Institucional", title: "Fuentes de datos" },
};

// Cada rol habilita su tablero; los eventos académicos viven dentro del financiero. Un usuario
// con varios roles ve todos los tableros que le corresponden.
const sectionByRole: Record<AuthUser["roles"][number], AnalyticsSection> = {
  academica: "academic",
  financiera: "financial",
};

export function InstitutionalAnalyticsPage({ user }: { user: AuthUser }) {
  const availableSections = user.roles.map((role) => sectionByRole[role]);
  const [activeSection, setActiveSection] = useState<AnalyticsSection>(availableSections[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { siteId, quarter, month, setSiteId, setQuarter, setMonth, logout } = useSession();
  const { options: filterOptions } = useFilters();
  const eventSources = useEventSources();
  const { academicStats, financialStats, eventsStats, isLoading, error } = useInstitutionalAnalytics({
    section: activeSection,
    siteId,
    quarter,
    month,
  });
  const { eyebrow, title } = sectionMeta[activeSection];

  // El académico filtra por cuatrimestre; financiero y eventos, por mes (mismo criterio que
  // el backend). Mientras GET /filters no responda, se usa el valor de sesión como única
  // opción para que el <select> no quede vacío. La sede se identifica por el id de Backoffice.
  const isAcademicSection = activeSection === "academic";
  const siteOptions = filterOptions?.sites.map((site) => ({ value: site.id, label: site.name })) ?? [
    { value: siteId, label: siteId },
  ];
  const currentPeriod = isAcademicSection ? quarter : month;
  const periodOptions = (isAcademicSection ? filterOptions?.quarters : filterOptions?.months)?.map(
    (period) => ({ value: period.id, label: period.label }),
  ) ?? [{ value: currentPeriod, label: currentPeriod }];

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
          onSiteChange={setSiteId}
          periodLabel={isAcademicSection ? "Cuatrimestre" : "Período"}
          periodValue={currentPeriod}
          periodOptions={periodOptions}
          onPeriodChange={isAcademicSection ? setQuarter : setMonth}
          userName={user.name}
          onLogout={logout}
          onOpenMenu={() => setIsSidebarOpen(true)}
        />

        <main className="flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando estadísticas...</p>}
          {error && <p className="text-sm text-destructive">Error al cargar las estadísticas: {error}</p>}

          {!isLoading && !error && (
            <>
              {activeSection === "sources" && <DataSources {...eventSources} />}
              {activeSection === "academic" && academicStats && <AcademicDashboard stats={academicStats} />}
              {activeSection === "financial" && financialStats && (
                <div className="flex flex-col gap-8">
                  <FinancialDashboard stats={financialStats} />
                  {eventsStats && (
                    <section id="eventos">
                      <EventsDashboard stats={eventsStats} />
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
