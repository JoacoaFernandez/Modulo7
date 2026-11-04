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

  // Tableros: arrancan del mock (shape completo) y pisan solo las métricas que se derivan de
  // eventos y tienen datos para los filtros pedidos. Si la DB falla, se devuelve el mock entero.
  async getAcademicStats(filters: AcademicFilters): Promise<AcademicStats> {
    const base = await this.fallback.getAcademicStats(filters);
    return this.overlay("académico", base, async (sedeId) => overlayAcademicStats(this.prisma, base, sedeId), filters.siteName);
  }

  async getFinancialStats(filters: FinancialFilters): Promise<FinancialStats> {
    const base = await this.fallback.getFinancialStats(filters);
    return this.overlay(
      "financiero",
      base,
      async (sedeId, sites) =>
        overlayFinancialStats(this.prisma, base, sedeId, new Map(sites.map((site) => [site.name, site.id]))),
      filters.siteName,
    );
  }

  async getEventsStats(filters: FinancialFilters): Promise<EventStats> {
    const base = await this.fallback.getEventsStats(filters);
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

  getQuarters(): Promise<Period[]> {
    return this.fallback.getQuarters();
  }

  getMonths(): Promise<Period[]> {
    return this.fallback.getMonths();
  }

  getFilterDefaults(): Promise<FilterDefaults> {
    return this.fallback.getFilterDefaults();
  }

  getRoles(): Promise<Role[]> {
    return this.fallback.getRoles();
  }

  getEventSources(): Promise<EventSource[]> {
    return this.fallback.getEventSources();
  }
}
