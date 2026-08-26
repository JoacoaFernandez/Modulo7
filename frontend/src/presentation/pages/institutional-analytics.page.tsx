// Pages: top-level views assembled from components, wired to hooks and use cases.
import { useState } from "react";
import { useInstitutionalAnalytics } from "../hooks/use-institutional-analytics.hook";
import { AcademicDashboard } from "../components/academic-dashboard.component";
import { FinancialDashboard } from "../components/financial-dashboard.component";
import { EventsDashboard } from "../components/events-dashboard.component";
import { Sidebar, type AnalyticsSection } from "../components/sidebar.component";
import { DashboardHeader, QuarterFilter, SiteFilter, ExportReportButton } from "../components/dashboard-header.component";

const sectionMeta: Record<AnalyticsSection, { eyebrow: string; title: string }> = {
  academic: { eyebrow: "Dirección Académica", title: "Dashboard Académico" },
  financial: { eyebrow: "Dirección Financiera", title: "Dashboard Financiero" },
  events: { eyebrow: "Eventos Institucionales", title: "Estadísticas de Eventos" },
};

export function InstitutionalAnalyticsPage() {
  const [activeSection, setActiveSection] = useState<AnalyticsSection>("academic");
  const { academicStats, financialStats, eventsStats, isLoading, error } = useInstitutionalAnalytics();
  const { eyebrow, title } = sectionMeta[activeSection];

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <Sidebar activeSection={activeSection} onSelectSection={setActiveSection} />

      <div className="flex flex-1 flex-col">
        <DashboardHeader
          eyebrow={eyebrow}
          title={title}
          actions={
            <>
              <QuarterFilter />
              <SiteFilter />
              <ExportReportButton />
            </>
          }
        />

        <main className="flex-1 overflow-y-auto p-8">
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
