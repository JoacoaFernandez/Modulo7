// Middleware: CORS manual con orígenes explícitos (CORS_ORIGINS) y credenciales, porque la cookie de refresh
// no admite `*`. Un origen no listado no recibe Access-Control-Allow-Origin (el navegador bloquea la respuesta).
import { NextFunction, Request, Response } from "express";
import { config } from "../../../shared/config";

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.header("Origin");
  res.header("Vary", "Origin");

  if (origin && config.corsOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Expose-Headers", "X-Correlation-Id");
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Correlation-Id");
  res.header("Access-Control-Max-Age", "600");
  // Chrome bloquea pedidos de un sitio público a localhost/red privada sin este header.
  res.header("Access-Control-Allow-Private-Network", "true");

  // Preflight: se responde acá, sin llegar a las rutas.
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
