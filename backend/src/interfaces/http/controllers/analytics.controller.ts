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
import { AnalyticsRepositoryMock } from "../../../infrastructure/repositories/analytics.repository.mock";
import {
  parseAcademicFilters,
  parseFinancialFilters,
  parseRecordEventDto,
} from "../validators/analytics.validator";

const analyticsRepository = new AnalyticsRepositoryMock();
const getAcademicDashboardUseCase = new GetAcademicDashboardUseCase(analyticsRepository);
const getFinancialDashboardUseCase = new GetFinancialDashboardUseCase(analyticsRepository);
const getEventsStatsUseCase = new GetEventsStatsUseCase(analyticsRepository);
const getFiltersUseCase = new GetFiltersUseCase(analyticsRepository);
const getRolesUseCase = new GetRolesUseCase(analyticsRepository);
const getEventSourcesUseCase = new GetEventSourcesUseCase(analyticsRepository);
const listEventsUseCase = new ListEventsUseCase(analyticsRepository);
const recordEventUseCase = new RecordEventUseCase(analyticsRepository);

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
    res.json(await getRolesUseCase.execute());
  }

  async getEventSources(_req: Request, res: Response) {
    res.json(await getEventSourcesUseCase.execute());
  }

  async listEvents(_req: Request, res: Response) {
    res.json(await listEventsUseCase.execute());
  }

  async recordEvent(req: Request, res: Response) {
    const event = parseRecordEventDto(req.body);
    await recordEventUseCase.execute(event);
    res.status(201).json({ eventId: event.eventId, status: "accepted" });
  }
}
