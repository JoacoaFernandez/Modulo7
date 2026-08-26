// Controllers: translate HTTP requests into use-case calls and shape HTTP responses.
import { Request, Response } from "express";
import { GetAcademicDashboardUseCase } from "../../../application/use-cases/get-academic-dashboard.use-case";
import { GetFinancialDashboardUseCase } from "../../../application/use-cases/get-financial-dashboard.use-case";
import { GetEventsStatsUseCase } from "../../../application/use-cases/get-events-stats.use-case";
import { RecordEventUseCase } from "../../../application/use-cases/record-event.use-case";
import { AnalyticsRepositoryMock } from "../../../infrastructure/repositories/analytics.repository.mock";

const analyticsRepository = new AnalyticsRepositoryMock();
const getAcademicDashboardUseCase = new GetAcademicDashboardUseCase(analyticsRepository);
const getFinancialDashboardUseCase = new GetFinancialDashboardUseCase(analyticsRepository);
const getEventsStatsUseCase = new GetEventsStatsUseCase(analyticsRepository);
const recordEventUseCase = new RecordEventUseCase(analyticsRepository);

export class AnalyticsController {
  async getAcademicDashboard(_req: Request, res: Response) {
    const stats = await getAcademicDashboardUseCase.execute();
    res.json(stats);
  }

  async getFinancialDashboard(_req: Request, res: Response) {
    const stats = await getFinancialDashboardUseCase.execute();
    res.json(stats);
  }

  async getEventsStats(_req: Request, res: Response) {
    const stats = await getEventsStatsUseCase.execute();
    res.json(stats);
  }

  async recordEvent(req: Request, res: Response) {
    await recordEventUseCase.execute(req.body);
    res.status(201).json({ ok: true });
  }
}
