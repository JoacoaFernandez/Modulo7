// Middleware: toma X-Correlation-Id del request (o genera uno), lo devuelve en la respuesta y lo deja disponible
// para los gateways (AsyncLocalStorage).
import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { runWithCorrelationId } from "../../../shared/correlation";

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("X-Correlation-Id");
  const id = incoming && incoming.length <= 128 && /^[\w.:-]+$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Correlation-Id", id);
  runWithCorrelationId(id, next);
}
