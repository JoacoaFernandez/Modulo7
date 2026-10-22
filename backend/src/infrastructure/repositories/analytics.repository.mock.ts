// Repository implementations: concrete adapters that fulfill the domain repository interfaces.
// Sin base de datos: los tableros salen del dataset del prototipo, calculados en el momento.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";
import { EventSource } from "../../domain/entities/event-source.entity";
import { EventStats } from "../../domain/entities/event-stats.entity";
import { AcademicFilters, FilterDefaults, FinancialFilters } from "../../domain/entities/filters.entity";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";
import { StoredCoreEvent } from "../../domain/entities/core-event.entity";
import { Period, termLabel } from "../../domain/entities/period.entity";
import { Role } from "../../domain/entities/role.entity";
import { Site } from "../../domain/entities/site.entity";
import { AnalyticsCalculatorService } from "../../domain/services/analytics-calculator.service";
import { AcademicTermsGateway } from "../../domain/gateways/academic-terms.gateway";
import { BackofficeSitesGateway } from "../../domain/gateways/backoffice-sites.gateway";
import { ANALYTICS_DATASET } from "../data/analytics.dataset";
import { academicTermsGateway, backofficeSitesGateway } from "../integrations/gateways";

export class AnalyticsRepositoryMock implements AnalyticsRepository {
  private readonly calculator = new AnalyticsCalculatorService(ANALYTICS_DATASET);
  // Los eventos consumidos se acumulan en memoria; todavía ningún tablero los lee.
  private readonly events: StoredCoreEvent[] = [];

  constructor(
    private readonly sitesGateway: BackofficeSitesGateway = backofficeSitesGateway,
    private readonly termsGateway: AcademicTermsGateway = academicTermsGateway,
  ) {}

  async getAcademicStats(filters: AcademicFilters): Promise<AcademicStats> {
    return this.calculator.calculateAcademicStats(filters, await this.getQuarters());
  }

  async getFinancialStats(filters: FinancialFilters): Promise<FinancialStats> {
    return this.calculator.calculateFinancialStats(filters);
  }

  async getEventsStats(filters: FinancialFilters): Promise<EventStats> {
    return this.calculator.calculateEventStats(filters);
  }

  // El catálogo de sedes (siteId, código y nombre) es de Backoffice; de acá salen solo las
  // métricas de cada sede. Una sede que Backoffice no define o dio de baja no aparece, y la
  // "agregada" siempre va primero.
  async getSites(): Promise<Site[]> {
    const catalog = await this.sitesGateway.listSites();
    const aggregate = ANALYTICS_DATASET.sites.filter((site) => site.isAggregate);
    const sites = catalog
      .filter((site) => site.status === "ACTIVE")
      .flatMap(({ siteId, code, name }) => {
        const metrics = ANALYTICS_DATASET.sites.find((site) => site.id === siteId);
        return metrics ? [{ ...metrics, code, name }] : [];
      });

    return [...aggregate, ...sites];
  }

  // Los cuatrimestres son de Gestión Académica; la etiqueta AAAA-NC la derivamos nosotros.
  async getQuarters(): Promise<Period[]> {
    const terms = [...(await this.termsGateway.listTerms())].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return terms.map((term, index) => ({ id: term.termId, label: termLabel(term.startDate), kind: "quarter", index }));
  }

  async getMonths(): Promise<Period[]> {
    return ANALYTICS_DATASET.months;
  }

  async getFilterDefaults(): Promise<FilterDefaults> {
    return ANALYTICS_DATASET.defaults;
  }

  async getRoles(): Promise<Role[]> {
    return ANALYTICS_DATASET.roles;
  }

  async getEventSources(): Promise<EventSource[]> {
    return ANALYTICS_DATASET.eventSources;
  }

  async getEvents(): Promise<StoredCoreEvent[]> {
    return this.events;
  }

  async recordEvent(event: StoredCoreEvent): Promise<void> {
    this.events.push(event);
  }
}
