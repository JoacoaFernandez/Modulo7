// Repositorio sobre Postgres (Prisma): persiste la ingesta y arma catálogos y tableros 100% desde inbox_events.
import { Prisma, PrismaClient } from "@prisma/client";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";
import { EventSource, SOURCE_MODULE_LABELS, SOURCE_MODULES, SourceModule } from "../../domain/entities/event-source.entity";
import { EventStats } from "../../domain/entities/event-stats.entity";
import { AcademicFilters, FilterDefaults, FinancialFilters } from "../../domain/entities/filters.entity";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";
import { InstitutionalEvent } from "../../domain/entities/institutional-event.entity";
import { Period } from "../../domain/entities/period.entity";
import { AGGREGATE_SITE, Site } from "../../domain/entities/site.entity";
import { buildMonthCatalog, buildQuarterCatalog } from "../../domain/services/period-catalog.service";
import { ACADEMIC_FEEDERS, EVENTS_FEEDERS, FINANCIAL_FEEDERS } from "../config/dashboard.config";
import { buildAcademicStats } from "./builders/academic-stats.builder";
import { buildEventStats } from "./builders/event-stats.builder";
import { buildFinancialStats } from "./builders/financial-stats.builder";
import { buildSourceMeta } from "./builders/source-meta.builder";
import { queryDefinedSites, queryEventMonths, queryModuleIngestions, queryQuarterIds } from "./queries/catalog.queries";

export class AnalyticsRepositoryPrisma implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Idempotente: un eventId repetido no duplica ni pisa la fila original.
  async recordEvent(event: InstitutionalEvent): Promise<void> {
    await this.prisma.inboxEvent.upsert({
      where: { eventId: event.eventId },
      update: {},
      create: {
        eventId: event.eventId,
        sourceModule: event.sourceModule,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        payload: event.payload as Prisma.InputJsonObject,
      },
    });
  }

  async getEvents(): Promise<InstitutionalEvent[]> {
    const rows = await this.prisma.inboxEvent.findMany({ orderBy: { receivedAt: "desc" } });
    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      sourceModule: row.sourceModule as SourceModule,
      eventType: row.eventType,
      payload: row.payload as Record<string, unknown>,
      occurredAt: row.occurredAt.toISOString(),
      receivedAt: row.receivedAt.toISOString(),
    }));
  }

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

  // "Todas las sedes" siempre primera, y después las que Backoffice definió con `sede.definida`.
  async getSites(): Promise<Site[]> {
    const defined = await queryDefinedSites(this.prisma);
    return [AGGREGATE_SITE, ...defined.map((site) => ({ ...site, isAggregate: false }))];
  }

  // Cuatrimestres que nombra algún evento; sin ninguno, el actual según la fecha de hoy.
  async getQuarters(): Promise<Period[]> {
    return buildQuarterCatalog(await queryQuarterIds(this.prisma), new Date());
  }

  // Meses (hora de Argentina) en que ocurrió algún evento; sin ninguno, el actual.
  async getMonths(): Promise<Period[]> {
    return buildMonthCatalog(await queryEventMonths(this.prisma), new Date());
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
