import "./src/shared/load-env";
import express, { NextFunction, Request, Response } from "express";
import { authRoutes } from "./src/interfaces/http/routes/auth.routes";
import { analyticsRoutes } from "./src/interfaces/http/routes/analytics.routes";
import { startEventConsumer } from "./src/infrastructure/messaging/start-event-consumer";
import { prisma } from "./src/infrastructure/prisma-client";
import { config } from "./src/shared/config";
import { ValidationError } from "./src/shared/validation-error";

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Max-Age", "600");
  // Chrome bloquea pedidos de un sitio público a localhost/red privada sin este header.
  res.header("Access-Control-Allow-Private-Network", "true");

  // Preflight: se responde acá, sin llegar a las rutas.
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("ok");
});

app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Recurso no encontrado" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
});

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Ingesta HTTP de eventos: ${config.events.httpIngest ? "activada" : "apagada"}`);
});

// Consumer de RabbitMQ: sólo con RABBITMQ_URL; si el broker no responde, reintenta sin tirar el server.
const consumer = startEventConsumer();

// Apagado ordenado: se deja de consumir, se cierra el HTTP y la base.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: cerrando`);

  await consumer?.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
