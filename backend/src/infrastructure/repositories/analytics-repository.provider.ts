// Elige la implementación del repositorio según el entorno: Postgres si hay DATABASE_URL, mock en memoria si no.
import { PrismaClient } from "@prisma/client";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AnalyticsRepositoryMock } from "./analytics.repository.mock";
import { AnalyticsRepositoryPrisma } from "./analytics.repository.prisma";

function createAnalyticsRepository(): AnalyticsRepository {
  if (process.env.DATABASE_URL) {
    console.log("Repositorio de analítica: Postgres (Prisma)");
    return new AnalyticsRepositoryPrisma(new PrismaClient(), new AnalyticsRepositoryMock());
  }

  console.log("Repositorio de analítica: mock en memoria (sin DATABASE_URL)");
  return new AnalyticsRepositoryMock();
}

export const analyticsRepository = createAnalyticsRepository();
