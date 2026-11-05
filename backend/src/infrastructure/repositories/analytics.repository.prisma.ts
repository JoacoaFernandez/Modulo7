// Repositorio sobre Postgres (Prisma): arma catálogos y tableros desde la bandeja de entrada (la ingesta vive en InboxRepository).
import { PrismaClient } from "@prisma/client";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";
import { EventSource, SOURCE_MODULE_LABELS, SOURCE_MODULES } from "../../domain/entities/event-source.entity";
import { EventStats } from "../../domain/entities/event-stats.entity";
import { AcademicFilters, Faculty, FilterDefaults, FinancialFilters } from "../../domain/entities/filters.entity";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";
import { Period } from "../../domain/entities/period.entity";
import { AGGREGATE_SITE, Site } from "../../domain/entities/site.entity";
import { DashboardWarning } from "../../domain/entities/dashboard-warning.entity";
import { FilterOptions } from "../../domain/entities/filters.entity";
import { AcademicGateway } from "../../domain/gateways/academic.gateway";
import { BackofficeGateway } from "../../domain/gateways/backoffice.gateway";
import { GatewayError } from "../../domain/gateways/gateway-error";
import { argentinaToday, buildMonthRange, buildQuarterCatalog, quarterIdOf } from "../../domain/services/period-catalog.service";
import { ACADEMIC_FEEDERS, EVENTS_FEEDERS, FINANCIAL_FEEDERS } from "../config/dashboard.config";
import { buildAcademicStats } from "./builders/academic-stats.builder";
import { buildEventStats } from "./builders/event-stats.builder";
import { buildFinancialStats } from "./builders/financial-stats.builder";
import { buildSourceMeta } from "./builders/source-meta.builder";
import { queryModuleIngestions } from "./queries/catalog.queries";

export interface CatalogGateways {
  backoffice: BackofficeGateway;
  academic: AcademicGateway;
  // DASHBOARD_FIRST_MONTH (AAAA-MM): primer mes del filtro de períodos.
  firstMonth: string;
}

// Catálogos de los filtros tal como los resuelven los gateways; si uno falla, su lista sale reducida y con aviso.
interface Catalogs {
  sites: Site[];
  quarters: Period[];
  faculties: Faculty[];
  warnings: DashboardWarning[];
}

export class AnalyticsRepositoryPrisma implements AnalyticsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateways: CatalogGateways,
  ) {}

  // Tableros: cada request lee de la base los catálogos (sedes, períodos) y las métricas del recorte pedido.
  // Si la DB falla la excepción sube al error handler (500): nunca se devuelven números inventados.
  async getAcademicStats(filters: AcademicFilters): Promise<AcademicStats> {
    const [sites, quarters, ingestions] = await Promise.all([
      this.getSites(),
      this.getQuarters(),
      queryModuleIngestions(this.prisma),
    ]);

    return buildAcademicStats(this.prisma, filters, {
      sites,
      quarters,
      meta: buildSourceMeta(ingestions, ACADEMIC_FEEDERS),
    });
  }

  async getFinancialStats(filters: FinancialFilters): Promise<FinancialStats> {
    const [sites, months, ingestions] = await Promise.all([
      this.getSites(),
      this.getMonths(),
      queryModuleIngestions(this.prisma),
    ]);

    return buildFinancialStats(this.prisma, filters, {
      sites,
      months,
      meta: buildSourceMeta(ingestions, FINANCIAL_FEEDERS),
    });
  }

  async getEventsStats(filters: FinancialFilters): Promise<EventStats> {
    const [sites, months, ingestions] = await Promise.all([
      this.getSites(),
      this.getMonths(),
      queryModuleIngestions(this.prisma),
    ]);

    return buildEventStats(this.prisma, filters, {
      sites,
      months,
      meta: buildSourceMeta(ingestions, EVENTS_FEEDERS),
    });
  }

  // "Todas las sedes" siempre primera, y después las sedes ACTIVE de Backoffice (el id es el siteId UUID).
  async getSites(): Promise<Site[]> {
    return (await this.loadCatalogs()).sites;
  }

  // Cuatrimestres de Gestión Académica que ya empezaron; sin ninguno (o si G9 falla), el actual según la fecha.
  async getQuarters(): Promise<Period[]> {
    return (await this.loadCatalogs()).quarters;
  }

  // Meses desde DASHBOARD_FIRST_MONTH hasta el actual (hora de Argentina).
  async getMonths(): Promise<Period[]> {
    return buildMonthRange(this.gateways.firstMonth, new Date());
  }

  // Facultades de las carreras de Gestión Académica; el id es el nombre tal cual.
  async getFaculties(): Promise<Faculty[]> {
    return (await this.loadCatalogs()).faculties;
  }

  // Por defecto, el período más reciente de cada catálogo y la sede agregada.
  async getFilterDefaults(): Promise<FilterDefaults> {
    const [quarters, months] = await Promise.all([this.getQuarters(), this.getMonths()]);

    return {
      siteName: AGGREGATE_SITE.name,
      quarter: quarters[quarters.length - 1].id,
      month: months[months.length - 1].id,
    };
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const [catalogs, months, defaults] = await Promise.all([this.loadCatalogs(), this.getMonths(), this.getFilterDefaults()]);
    const { warnings, ...lists } = catalogs;
    return { sites: lists.sites, quarters: lists.quarters, months, faculties: lists.faculties, defaults, ...(warnings.length > 0 ? { warnings } : {}) };
  }

  private async loadCatalogs(): Promise<Catalogs> {
    const warnings: DashboardWarning[] = [];
    const guard = async <T>(source: "backoffice" | "academic", what: string, load: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await load();
      } catch (error) {
        const reason = error instanceof GatewayError ? `${error.code}: ${error.message}` : String(error);
        console.warn(`[filters] ${source} (${what}) no respondió: ${reason}`);
        warnings.push({ source, message: `No se pudo leer ${what}: ${reason}` });
        return fallback;
      }
    };

    const [sites, periods, careers] = await Promise.all([
      guard("backoffice", "las sedes", () => this.gateways.backoffice.listSites(), []),
      guard("academic", "los períodos", () => this.gateways.academic.listPeriods(), []),
      guard("academic", "las carreras", () => this.gateways.academic.listCareers(), []),
    ]);

    const now = new Date();
    const today = argentinaToday(now);
    const started = periods.filter((period) => period.fechaInicio <= today).map(quarterIdOf);
    const faculties = [...new Set(careers.map((career) => career.facultad).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

    return {
      sites: [
        AGGREGATE_SITE,
        ...sites.filter((site) => site.status === "ACTIVE").map((site) => ({ id: site.siteId, name: site.name, isAggregate: false })),
      ],
      quarters: buildQuarterCatalog(started, now),
      faculties: faculties.map((name) => ({ id: name, name })),
      warnings,
    };
  }

  // Un renglón por módulo emisor; lastIngestionAt es el último evento recibido de ese módulo (null si nunca mandó).
  async getEventSources(): Promise<EventSource[]> {
    const lastByModule = new Map(
      (await queryModuleIngestions(this.prisma)).map((ingestion) => [ingestion.module, ingestion.lastReceivedAt]),
    );

    return SOURCE_MODULES.map((module) => ({
      module,
      label: SOURCE_MODULE_LABELS[module],
      lastIngestionAt: lastByModule.get(module) ?? null,
    }));
  }
}
