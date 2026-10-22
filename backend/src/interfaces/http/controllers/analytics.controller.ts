// Controllers: translate HTTP requests into use-case calls and shape HTTP responses.
import { Request, Response } from "express";
import { ConsumeCoreEventUseCase } from "../../../application/use-cases/consume-core-event.use-case";
import { GetAcademicDashboardUseCase } from "../../../application/use-cases/get-academic-dashboard.use-case";
import { GetCurrentUserUseCase } from "../../../application/use-cases/get-current-user.use-case";
import { GetEventSourcesUseCase } from "../../../application/use-cases/get-event-sources.use-case";
import { GetEventsStatsUseCase } from "../../../application/use-cases/get-events-stats.use-case";
import { GetFiltersUseCase } from "../../../application/use-cases/get-filters.use-case";
import { GetFinancialDashboardUseCase } from "../../../application/use-cases/get-financial-dashboard.use-case";
import { GetRolesUseCase } from "../../../application/use-cases/get-roles.use-case";
import { ListEventsUseCase } from "../../../application/use-cases/list-events.use-case";
import { backofficeUsersGateway } from "../../../infrastructure/integrations/gateways";
import { AnalyticsRepositoryMock } from "../../../infrastructure/repositories/analytics.repository.mock";
import { InboxRepositoryMemory } from "../../../infrastructure/repositories/inbox.repository.memory";
import { parseAcademicFilters, parseFinancialFilters } from "../validators/analytics.validator";

const analyticsRepository = new AnalyticsRepositoryMock();
const getAcademicDashboardUseCase = new GetAcademicDashboardUseCase(analyticsRepository);
const getFinancialDashboardUseCase = new GetFinancialDashboardUseCase(analyticsRepository);
const getEventsStatsUseCase = new GetEventsStatsUseCase(analyticsRepository);
const getFiltersUseCase = new GetFiltersUseCase(analyticsRepository);
const getRolesUseCase = new GetRolesUseCase(analyticsRepository);
const getEventSourcesUseCase = new GetEventSourcesUseCase(analyticsRepository);
const getCurrentUserUseCase = new GetCurrentUserUseCase(backofficeUsersGateway);
const listEventsUseCase = new ListEventsUseCase(analyticsRepository);
const consumeCoreEventUseCase = new ConsumeCoreEventUseCase(analyticsRepository, new InboxRepositoryMemory());

export class AnalyticsController {
  // Usuario del portal: identidad del token de CORE + nombre de Backoffice + perfiles.
  async getCurrentUser(_req: Request, res: Response) {
    res.json(await getCurrentUserUseCase.execute(res.locals.user));
  }

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

  // Simula una entrega de la cola analytics.all-events.v1 de CORE. 202 también para
  // DUPLICATE e IGNORED: el mensaje se confirma igual, sin efecto.
  async consumeEvent(req: Request, res: Response) {
    res.status(202).json(await consumeCoreEventUseCase.execute(req.body));
  }

  async listEvents(_req: Request, res: Response) {
    res.json(await listEventsUseCase.execute());
  }
}
