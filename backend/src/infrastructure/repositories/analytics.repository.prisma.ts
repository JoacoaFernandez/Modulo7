// Repositorio sobre Postgres (Prisma): persiste la ingesta y calcula métricas de los tableros desde los eventos, con el mock como base.
import { Prisma, PrismaClient } from "@prisma/client";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AcademicStats } from "../../domain/entities/academic-stats.entity";
import { EventSource, SourceModule } from "../../domain/entities/event-source.entity";
import { EventStats } from "../../domain/entities/event-stats.entity";
import { AcademicFilters, FilterDefaults, FinancialFilters } from "../../domain/entities/filters.entity";
import { FinancialStats } from "../../domain/entities/financial-stats.entity";
import { InstitutionalEvent } from "../../domain/entities/institutional-event.entity";
import { Period } from "../../domain/entities/period.entity";
import { Role } from "../../domain/entities/role.entity";
import { Site } from "../../domain/entities/site.entity";
import { AnalyticsRepositoryMock } from "./analytics.repository.mock";
import { buildAcademicBase, buildEventsBase, buildFinancialBase } from "./overlays/period-bases";
import { mergeMonths, mergeQuarters } from "./overlays/period-catalog";
import { queryDefinedQuarters, queryEventMonths } from "./queries/period.queries";
import { overlayAcademicStats } from "./overlays/academic.overlay";
import { overlayEventStats } from "./overlays/events.overlay";
import { overlayFinancialStats } from "./overlays/financial.overlay";

export class AnalyticsRepositoryPrisma implements AnalyticsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly fallback: AnalyticsRepositoryMock,
  ) {}

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

  // Tableros: arrancan de una base sobre el catálogo dinámico de períodos (el mock para los períodos que
  // conoce, una base vacía para los nuevos) y pisan las métricas que se derivan de eventos. Si la DB
  // falla, se devuelve la base sin pisar.
  async getAcademicStats(filters: AcademicFilters): Promise<AcademicStats> {
    const { stats, history, mockQuarters } = await buildAcademicBase(this.fallback, filters, await this.getQuarters());
    return this.overlay(
      "académico",
      stats,
      async (sedeId) => overlayAcademicStats(this.prisma, stats, sedeId, history, mockQuarters),
      filters.siteName,
    );
  }

  async getFinancialStats(filters: FinancialFilters): Promise<FinancialStats> {
    const base = await buildFinancialBase(this.fallback, filters, await this.getMonths());
    return this.overlay(
      "financiero",
      base,
      async (sedeId, sites) =>
        overlayFinancialStats(this.prisma, base, sedeId, new Map(sites.map((site) => [site.name, site.id]))),
      filters.siteName,
    );
  }

  async getEventsStats(filters: FinancialFilters): Promise<EventStats> {
    const base = await buildEventsBase(this.fallback, filters, await this.getMonths());
    return this.overlay("de eventos", base, async (sedeId) => overlayEventStats(this.prisma, base, sedeId), filters.siteName);
  }

  // Resuelve la sede (la agregada no filtra) y aplica el overlay; ante cualquier error de DB devuelve el mock.
  private async overlay<T>(
    dashboard: string,
    base: T,
    apply: (sedeId: string | null, sites: Site[]) => Promise<T>,
    siteName: string,
  ): Promise<T> {
    try {
      const sites = await this.fallback.getSites();
      const site = sites.find((candidate) => candidate.name === siteName);
      if (!site) return base;

      return await apply(site.isAggregate ? null : site.id, sites);
    } catch (error) {
      console.error(`No se pudo calcular el tablero ${dashboard} desde la base; se usa el mock.`, error);
      return base;
    }
  }

  getSites(): Promise<Site[]> {
    return this.fallback.getSites();
  }

  // Cuatrimestres del mock más los que Gestión Académica definió; sin DB disponible, solo los del mock.
  async getQuarters(): Promise<Period[]> {
    const mock = await this.fallback.getQuarters();
    try {
      return mergeQuarters(mock, await queryDefinedQuarters(this.prisma));
    } catch (error) {
      console.error("No se pudo leer el catálogo de cuatrimestres de la base; se usa el del mock.", error);
      return mock;
    }
  }

  // Meses del mock más los meses (hora de Argentina) en que ocurrió algún evento.
  async getMonths(): Promise<Period[]> {
    const mock = await this.fallback.getMonths();
    try {
      return mergeMonths(mock, await queryEventMonths(this.prisma));
    } catch (error) {
      console.error("No se pudo leer el catálogo de meses de la base; se usa el del mock.", error);
      return mock;
    }
  }

  // Por defecto, el período más reciente de cada catálogo; la sede sigue siendo la del mock.
  async getFilterDefaults(): Promise<FilterDefaults> {
    const [defaults, quarters, months] = await Promise.all([
      this.fallback.getFilterDefaults(),
      this.getQuarters(),
      this.getMonths(),
    ]);

    return {
      ...defaults,
      quarter: quarters[quarters.length - 1]?.id ?? defaults.quarter,
      month: months[months.length - 1]?.id ?? defaults.month,
    };
  }

  getRoles(): Promise<Role[]> {
    return this.fallback.getRoles();
  }

  getEventSources(): Promise<EventSource[]> {
    return this.fallback.getEventSources();
  }
}
