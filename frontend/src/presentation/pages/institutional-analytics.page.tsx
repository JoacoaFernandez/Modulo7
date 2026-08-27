// Pages: top-level views assembled from components, wired to hooks and use cases.
import { useState } from "react";
import { useSession } from "../context/session.context";
import { useInstitutionalAnalytics } from "../hooks/use-institutional-analytics.hook";
import { useFilters } from "../hooks/use-filters.hook";
import { AcademicDashboard } from "../components/academic-dashboard.component";
import { FinancialDashboard } from "../components/financial-dashboard.component";
import { EventsDashboard } from "../components/events-dashboard.component";
import { Sidebar, type AnalyticsSection } from "../components/sidebar.component";
import { DashboardHeader } from "../components/dashboard-header.component";

// Eyebrow y título literales del prototipo (rolActual / tituloVista). "events" vive dentro
// del mismo rol "financiera" que "financial" (ver Sidebar): comparte su encabezado hasta que
// el Paso 7 la anide dentro de esa página con <section id="eventos">.
const sectionMeta: Record<AnalyticsSection, { eyebrow: string; title: string }> = {
  academic: { eyebrow: "Dirección Académica", title: "Rendimiento académico" },
  financial: { eyebrow: "Dirección Financiera", title: "Situación económica y financiera" },
  events: { eyebrow: "Dirección Financiera", title: "Situación económica y financiera" },
};

export function InstitutionalAnalyticsPage() {
  const [activeSection, setActiveSection] = useState<AnalyticsSection>("academic");
  const { siteName, quarter, month, setSiteName, setQuarter, setMonth, changeRole } = useSession();
  const { options: filterOptions } = useFilters();
  const { academicStats, financialStats, eventsStats, isLoading, error } = useInstitutionalAnalytics({
    siteName,
    quarter,
    month,
  });
  const { eyebrow, title } = sectionMeta[activeSection];

  // El académico filtra por cuatrimestre; financiero y eventos, por mes (mismo criterio que
  // el backend). Mientras GET /filters no responda, se usa el valor de sesión como única
  // opción para que el <select> no quede vacío.
  const isAcademicSection = activeSection === "academic";
  const siteOptions = filterOptions?.sites.map((site) => site.name) ?? [siteName];
  const periodOptions = (isAcademicSection ? filterOptions?.quarters : filterOptions?.months)?.map(
    (period) => period.id,
  ) ?? [isAcademicSection ? quarter : month];

  return (
    <div className="flex min-h-screen w-full bg-[var(--app-bg)]">
      <Sidebar activeSection={activeSection} onSelectSection={setActiveSection} />

      <div className="flex flex-1 flex-col overflow-x-auto">
        <DashboardHeader
          eyebrow={eyebrow}
          title={title}
          siteName={siteName}
          siteOptions={siteOptions}
          onSiteChange={setSiteName}
          periodLabel={isAcademicSection ? "Cuatrimestre" : "Período"}
          periodValue={isAcademicSection ? quarter : month}
          periodOptions={periodOptions}
          onPeriodChange={isAcademicSection ? setQuarter : setMonth}
          onChangeRole={changeRole}
        />

        <main className="min-w-[1180px] flex-1 p-8">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando estadísticas...</p>}
          {error && <p className="text-sm text-destructive">Error al cargar las estadísticas: {error}</p>}

          {!isLoading && !error && (
            <>
              {activeSection === "academic" && academicStats && <AcademicDashboard stats={academicStats} />}
              {activeSection === "financial" && financialStats && <FinancialDashboard stats={financialStats} />}
              {activeSection === "events" && <EventsDashboard stats={eventsStats} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
