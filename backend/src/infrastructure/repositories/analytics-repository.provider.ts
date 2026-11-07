// Crea el repositorio de analítica sobre Postgres: DATABASE_URL es obligatoria (la valida shared/config), no hay datos de respaldo.
// Sedes, períodos, facultades, cursos y agregados de wallet salen de los gateways (mock o real según los flags).
import { AcademicCatalogService } from "../../application/services/academic-catalog.service";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { config } from "../../shared/config";
import { academicGateway, backofficeGateway, coreWalletGateway } from "../integrations/gateways";
import { prisma } from "../prisma-client";
import { AnalyticsRepositoryPrisma } from "./analytics.repository.prisma";

// Con el mock el catálogo se rearma en cada request (editar un .json se ve al instante); con HTTP, una vez por TTL estático.
const catalog = new AcademicCatalogService(academicGateway, config.mocks.academic ? 0 : config.cacheTtlSeconds.static);

export const analyticsRepository: AnalyticsRepository = new AnalyticsRepositoryPrisma(prisma, {
  backoffice: backofficeGateway,
  academic: academicGateway,
  wallet: coreWalletGateway,
  catalog,
  firstMonth: config.dashboard.firstMonth,
  diningNetOfAttendance: config.dashboard.diningRevenueNetOfAttendance,
});
