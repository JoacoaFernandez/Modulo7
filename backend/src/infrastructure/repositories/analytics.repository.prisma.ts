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
import { AcademicCatalogService } from "../../application/services/academic-catalog.service";
import { AcademicGateway, AcademicPeriod } from "../../domain/gateways/academic.gateway";
import { BackofficeGateway } from "../../domain/gateways/backoffice.gateway";
import { CoreWalletGateway } from "../../domain/gateways/core-wallet.gateway";
import { argentinaToday, buildMonthRange, buildQuarterCatalog, quarterIdOf } from "../../domain/services/period-catalog.service";
import { ACADEMIC_FEEDERS, EVENTS_FEEDERS, FINANCIAL_FEEDERS } from "../config/dashboard.config";
import { buildAcademicStats } from "./builders/academic-stats.builder";
import { buildEventStats } from "./builders/event-stats.builder";
import { buildFinancialStats } from "./builders/financial-stats.builder";
import { buildSourceMeta } from "./builders/source-meta.builder";
import { queryModuleIngestions } from "./queries/catalog.queries";
import { WarningCollector } from "./builders/warning-collector";

// Dependencias del repositorio: los gateways (siempre por su interfaz de dominio) y la configuración de los tableros.
export interface RepositoryDeps {
  backoffice: BackofficeGateway;
  academic: AcademicGateway;
  wallet: CoreWalletGateway;
  // Catálogo de asignaturas (carreras → planes → asignaturas) con su caché.
  catalog: AcademicCatalogService;
  // DASHBOARD_FIRST_MONTH (AAAA-MM): primer mes del filtro de períodos.
  firstMonth: string;
  // DINING_REVENUE_NET_OF_ATTENDANCE.
  diningNetOfAttendance: boolean;
  // Reloj inyectable (los tests lo fijan).
  now?: () => Date;
}

// Catálogos de los filtros tal como los resuelven los gateways; si uno falla, su lista sale reducida y con aviso.
interface Catalogs {
  sites: Site[];
  quarters: Period[];
  // Períodos de G9 tal cual (para pasar de "2026-1C" al id numérico).
  periods: AcademicPeriod[];
  faculties: Faculty[];
  warnings: DashboardWarning[];
}

// Un tablero que no usa G9 (financiero, eventos) sólo avisa de la caída de Backoffice (sedes).
const backofficeOnly = (warnings: DashboardWarning[]): DashboardWarning[] => warnings.filter((warning) => warning.source === "backoffice");

export class AnalyticsRepositoryPrisma implements AnalyticsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateways: RepositoryDeps,
  ) {}

  private now(): Date {
    return this.gateways.now?.() ?? new Date();
  }

  // Tableros: cada request lee los catálogos de los gateways (una sola vez) y las métricas del recorte pedido.
  // Si un gateway falla, el bloque afectado sale vacío con un warning; si falla la DB sube al error handler (500).
  async getAcademicStats(filters: AcademicFilters): Promise<AcademicStats> {
    const [catalogs, ingestions] = await Promise.all([this.loadCatalogs(), queryModuleIngestions(this.prisma)]);

    return buildAcademicStats(this.prisma, filters, {
      sites: catalogs.sites,
      quarters: catalogs.quarters,
      periods: catalogs.periods,
      gateways: { academic: this.gateways.academic, backoffice: this.gateways.backoffice, catalog: this.gateways.catalog },
      warnings: new WarningCollector(catalogs.warnings),
      meta: buildSourceMeta(ingestions, ACADEMIC_FEEDERS),
    });
  }

  async getFinancialStats(filters: FinancialFilters): Promise<FinancialStats> {
    const [catalogs, ingestions] = await Promise.all([this.loadCatalogs(), queryModuleIngestions(this.prisma)]);

    return buildFinancialStats(this.prisma, filters, {
      sites: catalogs.sites,
      months: this.getMonthsSync(),
      wallet: this.gateways.wallet,
      warnings: new WarningCollector(backofficeOnly(catalogs.warnings)),
      diningNetOfAttendance: this.gateways.diningNetOfAttendance,
      now: this.now(),
      meta: buildSourceMeta(ingestions, FINANCIAL_FEEDERS),
    });
  }

  async getEventsStats(filters: FinancialFilters): Promise<EventStats> {
    const [catalogs, ingestions] = await Promise.all([this.loadCatalogs(), queryModuleIngestions(this.prisma)]);

    return buildEventStats(this.prisma, filters, {
      sites: catalogs.sites,
      months: this.getMonthsSync(),
      warnings: new WarningCollector(backofficeOnly(catalogs.warnings)),
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
    return this.getMonthsSync();
  }

  private getMonthsSync(): Period[] {
    return buildMonthRange(this.gateways.firstMonth, this.now());
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
    const { warnings, sites, quarters, faculties } = await this.loadCatalogs();
    const months = this.getMonthsSync();
    const defaults: FilterDefaults = {
      siteName: AGGREGATE_SITE.name,
      quarter: quarters[quarters.length - 1].id,
      month: months[months.length - 1].id,
    };

    return { sites, quarters, months, faculties, defaults, ...(warnings.length > 0 ? { warnings } : {}) };
  }

  private async loadCatalogs(): Promise<Catalogs> {
    const warnings = new WarningCollector();

    const [sites, periods, careers] = await Promise.all([
      warnings.guard("backoffice", "las sedes", () => this.gateways.backoffice.listSites(), []),
      warnings.guard("academic", "los períodos", () => this.gateways.academic.listPeriods(), []),
      warnings.guard("academic", "las carreras", () => this.gateways.academic.listCareers(), []),
    ]);

    const now = this.now();
    const today = argentinaToday(now);
    const started = periods.value.filter((period) => period.fechaInicio <= today).map(quarterIdOf);
    const faculties = [...new Set(careers.value.map((career) => career.facultad).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

    return {
      sites: [
        AGGREGATE_SITE,
        ...sites.value.filter((site) => site.status === "ACTIVE").map((site) => ({ id: site.siteId, name: site.name, isAggregate: false })),
      ],
      quarters: buildQuarterCatalog(started, now),
      periods: periods.value,
      faculties: faculties.map((name) => ({ id: name, name })),
      warnings: warnings.warnings ?? [],
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
