// Controllers: translate HTTP requests into use-case calls and shape HTTP responses.
import { Request, Response } from "express";
import { GetAcademicDashboardUseCase } from "../../../application/use-cases/get-academic-dashboard.use-case";
import { GetEventSourcesUseCase } from "../../../application/use-cases/get-event-sources.use-case";
import { GetEventsStatsUseCase } from "../../../application/use-cases/get-events-stats.use-case";
import { GetFiltersUseCase } from "../../../application/use-cases/get-filters.use-case";
import { GetFinancialDashboardUseCase } from "../../../application/use-cases/get-financial-dashboard.use-case";
import { GetRolesUseCase } from "../../../application/use-cases/get-roles.use-case";
import { ListEventsUseCase } from "../../../application/use-cases/list-events.use-case";
import { RecordEventUseCase } from "../../../application/use-cases/record-event.use-case";
import { analyticsRepository } from "../../../infrastructure/repositories/analytics-repository.provider";
import { inboxRepository } from "../../../infrastructure/repositories/inbox-repository.provider";
import { config } from "../../../shared/config";
import { EventValidationError } from "../../../shared/event-validation-error";
import {
  parseAcademicFilters,
  parseEventsPage,
  parseFinancialFilters,
} from "../validators/analytics.validator";

const getAcademicDashboardUseCase = new GetAcademicDashboardUseCase(analyticsRepository);
const getFinancialDashboardUseCase = new GetFinancialDashboardUseCase(analyticsRepository);
const getEventsStatsUseCase = new GetEventsStatsUseCase(analyticsRepository);
const getFiltersUseCase = new GetFiltersUseCase(analyticsRepository);
const getRolesUseCase = new GetRolesUseCase();
const getEventSourcesUseCase = new GetEventSourcesUseCase(analyticsRepository);
const listEventsUseCase = new ListEventsUseCase(inboxRepository);
const recordEventUseCase = new RecordEventUseCase(inboxRepository, { storeUnknown: config.events.inboxStoreUnknown });

export class AnalyticsController {
  async getAcademicDashboard(req: Request, res: Response) {
    const options = await getFiltersUseCase.execute();
    const stats = await getAcademicDashboardUseCase.execute(parseAcademicFilters(req.query, options));
    res.json(stats);
  }

  async getFinancialDashboard(req: Request, res: Response) {
    const options = await getFiltersUseCase.execute();
    const stats = await getFinancialDashboardUseCase.execute(
      parseFinancialFilters(req.query, options),
    );
    res.json(stats);
  }

  async getEventsStats(req: Request, res: Response) {
    const options = await getFiltersUseCase.execute();
    const stats = await getEventsStatsUseCase.execute(parseFinancialFilters(req.query, options));
    res.json(stats);
  }

  async getFilters(_req: Request, res: Response) {
    res.json(await getFiltersUseCase.execute());
  }

  async getRoles(_req: Request, res: Response) {
    res.json(getRolesUseCase.execute());
  }

  async getEventSources(_req: Request, res: Response) {
    res.json(await getEventSourcesUseCase.execute());
  }

  async listEvents(req: Request, res: Response) {
    const { limit, cursor } = parseEventsPage(req.query);
    res.json(await listEventsUseCase.execute(limit, cursor));
  }

  // Recibe el envelope v1 crudo (la validación vive en el caso de uso).
  async recordEvent(req: Request, res: Response) {
    try {
      const outcome = await recordEventUseCase.execute(req.body);
      const eventId = (req.body as { eventId: string }).eventId;

      if (outcome === "stored") res.status(201).json({ eventId, status: "STORED" });
      else if (outcome === "duplicate") res.status(200).json({ eventId, status: "DUPLICATE" });
      else res.status(202).json({ eventId, status: "IGNORED" });
    } catch (error) {
      if (error instanceof EventValidationError) {
        res.status(400).json({ error: error.message, errors: error.problems });
        return;
      }
      throw error;
    }
  }
}
