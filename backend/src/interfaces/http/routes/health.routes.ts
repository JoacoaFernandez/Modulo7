// Routes: Express route definitions that wire URLs to controllers.
// Healthchecks: live = el proceso responde; ready = la base responde (y se informa el estado del resto).
import { Router } from "express";
import { gatewayModes } from "../../../infrastructure/integrations/gateways";
import { prisma } from "../../../infrastructure/prisma-client";

export interface BrokerStatus {
  isConnected(): boolean;
}

export function createHealthRoutes(consumer: BrokerStatus | null): Router {
  const router = Router();

  router.get("/live", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/ready", async (_req, res) => {
    let db: "up" | "down" = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }

    const broker = consumer === null ? "disabled" : consumer.isConnected() ? "up" : "down";
    // Sin base no se puede servir ningún tablero; el broker caído sólo degrada (se reconecta solo).
    const status = db === "down" ? "down" : broker === "down" ? "degraded" : "ok";
    res.status(db === "down" ? 503 : 200).json({ status, checks: { db, broker, ...gatewayModes } });
  });

  return router;
}
