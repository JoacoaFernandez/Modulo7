// Crea el repositorio de analítica sobre Postgres: DATABASE_URL es obligatoria (la valida shared/config), no hay datos de respaldo.
// Sedes, períodos y facultades de los filtros salen de los gateways (mock o real según los flags).
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { config } from "../../shared/config";
import { academicGateway, backofficeGateway } from "../integrations/gateways";
import { prisma } from "../prisma-client";
import { AnalyticsRepositoryPrisma } from "./analytics.repository.prisma";

export const analyticsRepository: AnalyticsRepository = new AnalyticsRepositoryPrisma(prisma, {
  backoffice: backofficeGateway,
  academic: academicGateway,
  firstMonth: config.dashboard.firstMonth,
});
