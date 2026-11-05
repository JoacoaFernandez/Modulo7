// Crea el repositorio de analítica sobre Postgres: DATABASE_URL es obligatoria (la valida shared/config), no hay datos de respaldo.
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { prisma } from "../prisma-client";
import { AnalyticsRepositoryPrisma } from "./analytics.repository.prisma";

export const analyticsRepository: AnalyticsRepository = new AnalyticsRepositoryPrisma(prisma);
