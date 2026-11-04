// Crea el repositorio de analítica sobre Postgres: DATABASE_URL es obligatoria, no hay datos de respaldo.
import { PrismaClient } from "@prisma/client";
import { AnalyticsRepository } from "../../domain/repositories/analytics.repository";
import { AnalyticsRepositoryPrisma } from "./analytics.repository.prisma";

function createAnalyticsRepository(): AnalyticsRepository {
  if (!process.env.DATABASE_URL) {
    console.error(
      [
        "Falta la variable DATABASE_URL: el módulo de analítica lee todos sus datos de Postgres y no arranca sin ella.",
        "Copiá backend/.env.example a backend/.env (o definila en el entorno), por ejemplo:",
        "  DATABASE_URL=postgresql://usuario:clave@localhost:5432/analitica",
        "Para levantar la base local: npm run db:up && npm run db:migrate",
      ].join("\n"),
    );
    process.exit(1);
  }

  return new AnalyticsRepositoryPrisma(new PrismaClient());
}

export const analyticsRepository = createAnalyticsRepository();
