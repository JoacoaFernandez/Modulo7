import express, { NextFunction, Request, Response } from "express";
import { coreAuthMockRoutes, coreInternalMockRoutes, coreJwksMockRoutes } from "./src/infrastructure/integrations/core-mock.routes";
import { correlationId } from "./src/interfaces/http/middleware/correlation-id.middleware";
import { sendProblem } from "./src/interfaces/http/problem-details";
import { analyticsRoutes, devEventsRoutes } from "./src/interfaces/http/routes/analytics.routes";
import { HttpError, NotFoundError } from "./src/shared/http-error";

const app = express();
const port = process.env.PORT ?? 3000;
const isProduction = process.env.NODE_ENV === "production";

app.use(correlationId);

app.use((req, res, next) => {
  // Se devuelve el Origin concreto (no "*") porque el refresh de CORE viaja en una cookie y
  // el navegador sólo la manda con credentials cuando el origen es explícito.
  const origin = req.header("Origin");
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Correlation-Id");
  res.header("Access-Control-Expose-Headers", "X-Correlation-Id");
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

// Health checks que pide el gateway de CORE. Sin base de datos ni broker todavía, ready
// equivale a live.
app.get("/health/live", (_req, res) => {
  res.json({ status: "ok" });
});
app.get("/health/ready", (_req, res) => {
  res.json({ status: "ok", checks: { db: "n/a", broker: "n/a" } });
});

// Mock de CORE (módulo 10): login, token de servicio y JWKS con las rutas de su contrato.
app.use("/api/v1/auth", coreAuthMockRoutes);
app.use("/internal/v1", coreInternalMockRoutes);
app.use("/.well-known", coreJwksMockRoutes);

app.use("/api/v1", analyticsRoutes);
if (!isProduction) {
  app.use("/api/v1/dev", devEventsRoutes);
}

app.use((_req, _res) => {
  throw new NotFoundError();
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    sendProblem(req, res, error);
    return;
  }

  // Cuerpo que no es JSON válido: lo detecta express.json() antes de llegar a las rutas.
  if (error instanceof SyntaxError && "body" in error) {
    sendProblem(req, res, new HttpError(400, "VALIDATION_ERROR", "Solicitud inválida", "El cuerpo no es un JSON válido."));
    return;
  }

  console.error(`[${res.locals.correlationId}]`, error);
  sendProblem(req, res, new HttpError(500, "INTERNAL_ERROR", "Error interno", "Error interno del servidor."));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
