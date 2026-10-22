// Middleware: X-Correlation-Id. Se toma el que propaga el gateway de CORE o se genera uno, y
// se devuelve en la respuesta para poder rastrear la operación entre módulos.
import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

export function correlationId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("X-Correlation-Id")?.trim();
  const id = incoming || randomUUID();

  res.locals.correlationId = id;
  res.header("X-Correlation-Id", id);
  next();
}
