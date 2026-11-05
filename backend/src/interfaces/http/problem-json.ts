// application/problem+json (CORE v1 §2): {type, title, status, code, detail, instance, correlationId}. Se mantiene
// `error: detail` para no romper al frontend actual.
import { Request, Response } from "express";

export interface Problem {
  status: number;
  code: string;
  detail: string;
  title?: string;
  // Campos extra (p. ej. errors[] de la validación de eventos).
  extra?: Record<string, unknown>;
}

const TITLES: Record<number, string> = {
  400: "Solicitud inválida",
  401: "No autenticado",
  403: "Acceso denegado",
  404: "No encontrado",
  429: "Demasiadas solicitudes",
  500: "Error interno",
  502: "Error en un servicio externo",
  503: "Servicio no disponible",
  504: "Un servicio externo no respondió a tiempo",
};

export function sendProblem(req: Request, res: Response, problem: Problem): void {
  const correlationId = res.getHeader("X-Correlation-Id");
  res
    .status(problem.status)
    .type("application/problem+json")
    .send(
      JSON.stringify({
        type: `urn:uadenet:problem:${problem.code.toLowerCase().replaceAll("_", "-")}`,
        title: problem.title ?? TITLES[problem.status] ?? "Error",
        status: problem.status,
        code: problem.code,
        detail: problem.detail,
        instance: req.originalUrl,
        correlationId: typeof correlationId === "string" ? correlationId : undefined,
        error: problem.detail,
        ...problem.extra,
      }),
    );
}
