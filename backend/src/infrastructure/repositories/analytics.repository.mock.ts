// Repository implementations: concrete adapters that fulfill the domain repository interfaces.
// Sin base de datos: los tableros salen del dataset del prototipo, calculados en el momento.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";
import { EventSource } from "../../domain/entities/event-source.entity";
import { EventStats } from "../../domain/entities/event-stats.entity";
import { AcademicFilters, FilterDefaults, FinancialFilters } from "../../domain/entities/filters.entity";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";
import { InstitutionalEvent } from "../../domain/entities/institutional-event.entity";
import { Period } from "../../domain/entities/period.entity";
import { Role } from "../../domain/entities/role.entity";
import { Site } from "../../domain/entities/site.entity";
import { AnalyticsCalculatorService } from "../../domain/services/analytics-calculator.service";
import { BackofficeSitesGateway } from "../../domain/gateways/backoffice-sites.gateway";
import { ANALYTICS_DATASET } from "../data/analytics.dataset";
import { backofficeSitesGateway } from "../integrations/gateways";

export class AnalyticsRepositoryMock implements AnalyticsRepository {
  private readonly calculator = new AnalyticsCalculatorService(ANALYTICS_DATASET);
  // Los eventos ingeridos se acumulan en memoria; todavía ningún tablero los lee.
  private readonly events: InstitutionalEvent[] = [];

  constructor(private readonly sitesGateway: BackofficeSitesGateway = backofficeSitesGateway) {}

  async getAcademicStats(filters: AcademicFilters): Promise<AcademicStats> {
    return this.calculator.calculateAcademicStats(filters);
  }

  async getFinancialStats(filters: FinancialFilters): Promise<FinancialStats> {
    return this.calculator.calculateFinancialStats(filters);
  }

  async getEventsStats(filters: FinancialFilters): Promise<EventStats> {
    return this.calculator.calculateEventStats(filters);
  }

  // El catálogo de sedes (id y nombre) es de Backoffice; de acá salen solo las métricas de
  // cada sede. Una sede que Backoffice no define no aparece, y la "agregada" siempre va primero.
  async getSites(): Promise<Site[]> {
    const catalog = await this.sitesGateway.listSites();
    const aggregate = ANALYTICS_DATASET.sites.filter((site) => site.isAggregate);
    const sites = catalog.flatMap(({ sedeId, nombre }) => {
      const metrics = ANALYTICS_DATASET.sites.find((site) => site.id === sedeId);
      return metrics ? [{ ...metrics, name: nombre }] : [];
    });

    return [...aggregate, ...sites];
  }

  async getQuarters(): Promise<Period[]> {
    return ANALYTICS_DATASET.quarters;
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

  async getEvents(): Promise<InstitutionalEvent[]> {
    return this.events;
  }

  async recordEvent(event: InstitutionalEvent): Promise<void> {
    this.events.push(event);
  }
}
