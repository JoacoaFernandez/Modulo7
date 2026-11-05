import "./src/shared/load-env";
import express, { NextFunction, Request, Response } from "express";
import { GatewayError } from "./src/domain/gateways/gateway-error";
import { startWalletSnapshotJob } from "./src/infrastructure/jobs/wallet-snapshot.job";
import { corsMiddleware } from "./src/interfaces/http/middleware/cors.middleware";
import { correlationMiddleware } from "./src/interfaces/http/middleware/correlation.middleware";
import { sendProblem } from "./src/interfaces/http/problem-json";
import { analyticsRoutes } from "./src/interfaces/http/routes/analytics.routes";
import { authRoutes } from "./src/interfaces/http/routes/auth.routes";
import { createHealthRoutes } from "./src/interfaces/http/routes/health.routes";
import { startEventConsumer } from "./src/infrastructure/messaging/start-event-consumer";
import { gatewayModes } from "./src/infrastructure/integrations/gateways";
import { prisma } from "./src/infrastructure/prisma-client";
import { config } from "./src/shared/config";
import { EventValidationError } from "./src/shared/event-validation-error";
import { ProblemError } from "./src/shared/problem-error";
import { ValidationError } from "./src/shared/validation-error";

const app = express();

app.use(correlationMiddleware);
app.use(corsMiddleware);
app.use(express.json());

// Consumer de RabbitMQ: sólo con RABBITMQ_URL; si el broker no responde, reintenta sin tirar el server.
const consumer = startEventConsumer();

app.get("/", (_req, res) => {
  res.send("ok");
});

app.use("/health", createHealthRoutes(consumer));
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);
// El gateway de CORE reescribe /api/v1/analytics/* → /api/v1/* (CORE v1 §6): mismas rutas, sin quitar las anteriores.
app.use("/api/v1", analyticsRoutes);

app.use((req, res) => {
  sendProblem(req, res, { status: 404, code: "NOT_FOUND", detail: "Recurso no encontrado" });
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof EventValidationError) {
    sendProblem(req, res, { status: 400, code: "INVALID_EVENT", detail: error.message, extra: { errors: error.problems } });
    return;
  }

  if (error instanceof ValidationError) {
    sendProblem(req, res, { status: 400, code: "VALIDATION_ERROR", detail: error.message });
    return;
  }

  if (error instanceof ProblemError) {
    sendProblem(req, res, { status: error.status, code: error.code, detail: error.message });
    return;
  }

  // Un servicio externo falló y nadie lo absorbió como warning: 502/504, nunca datos inventados.
  if (error instanceof GatewayError) {
    console.error(`[gateway:${error.service}] ${error.status} ${error.code}: ${error.message} (correlationId ${error.correlationId ?? "-"})`);
    sendProblem(req, res, {
      status: error.status === 504 ? 504 : 502,
      code: `UPSTREAM_${error.service.toUpperCase()}_ERROR`,
      detail: `Falló una consulta a ${error.service} (${error.code}).`,
    });
    return;
  }

  // JSON mal formado u otros errores 4xx de express.json().
  const httpStatus = (error as { status?: unknown; type?: unknown } | null)?.status;
  if (typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500) {
    sendProblem(req, res, { status: httpStatus, code: "BAD_REQUEST", detail: "No se pudo interpretar el pedido (¿JSON mal formado?)." });
    return;
  }

  console.error(error);
  sendProblem(req, res, { status: 500, code: "INTERNAL_ERROR", detail: "Error interno del servidor" });
});

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Ingesta HTTP de eventos: ${config.events.httpIngest ? "activada" : "apagada"}`);
  console.log(`Integraciones: core=${gatewayModes.core} backoffice=${gatewayModes.backoffice} academic=${gatewayModes.academic}`);
});

// Snapshots mensuales del saldo de CORE (WALLET_SNAPSHOT_ENABLED=false lo apaga).
const snapshotJob = startWalletSnapshotJob();

// Apagado ordenado: se deja de consumir, se cierra el HTTP y la base.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: cerrando`);

  snapshotJob?.stop();
  await consumer?.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
