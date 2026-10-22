// Errores HTTP en application/problem+json, con la forma de la sección 13 del contrato de CORE.
import { Request, Response } from "express";
import { HttpError } from "../../shared/http-error";

export function sendProblem(req: Request, res: Response, error: HttpError) {
  res
    .status(error.status)
    .type("application/problem+json")
    .json({
      type: `https://uadenet.local/errors/${error.code.toLowerCase().replaceAll("_", "-")}`,
      title: error.title,
      status: error.status,
      code: error.code,
      detail: error.message,
      instance: req.originalUrl,
      correlationId: res.locals.correlationId,
    });
}
