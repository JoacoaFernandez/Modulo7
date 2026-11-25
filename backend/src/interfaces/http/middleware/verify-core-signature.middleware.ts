// Middleware: verifica la firma `X-Core-Signature` que el gateway de CORE agrega a cada request que reenvía a /api/v1/*.
// HMAC-SHA256 en hex, con el secreto compartido CORE_GATEWAY_SECRET, sobre el texto
//   MÉTODO \n RUTA \n SUB \n X-Correlation-Id \n X-Core-Timestamp      (unido por \n, sin salto final)
// RUTA es la ruta completa que recibe este backend sin query (p. ej. /api/v1/dashboard/academic) y SUB el `sub` del JWT del
// usuario (= X-User-Id). El timestamp (ms) no puede diferir más de 5 minutos. Sin secreto configurado no valida.
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { sendProblem } from "../problem-json";

export const CORE_SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;

// Texto que firma CORE (exportado para armar la firma en pruebas).
export function signingText(parts: { method: string; path: string; sub: string; correlationId: string; timestamp: string }): string {
  return [parts.method, parts.path, parts.sub, parts.correlationId, parts.timestamp].join("\n");
}

export function signCore(secret: string, parts: Parameters<typeof signingText>[0]): string {
  return createHmac("sha256", secret).update(signingText(parts)).digest("hex");
}

// Qué falló, sólo para el log del servidor: al cliente no se le explica.
function checkSignature(req: Request, secret: string, now: number): string | null {
  const signature = req.header("X-Core-Signature");
  const timestamp = req.header("X-Core-Timestamp");
  if (!signature) return "falta X-Core-Signature";
  if (!timestamp || !/^\d{10,16}$/.test(timestamp)) return "X-Core-Timestamp ausente o inválido";
  if (Math.abs(now - Number(timestamp)) > CORE_SIGNATURE_MAX_SKEW_MS) return "X-Core-Timestamp fuera de la ventana de 5 minutos";

  const expected = signCore(secret, {
    method: req.method.toUpperCase(),
    path: req.originalUrl.split("?")[0],
    sub: req.header("X-User-Id") ?? "",
    correlationId: req.header("X-Correlation-Id") ?? "",
    timestamp,
  });

  // Comparación en tiempo constante (y de igual largo, que timingSafeEqual exige).
  const given = Buffer.from(signature.trim().toLowerCase());
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted) ? null : "la firma no coincide";
}

export function createVerifyCoreSignature(secret: string | undefined, now: () => number = Date.now): RequestHandler {
  if (!secret) {
    console.log("CORE_GATEWAY_SECRET vacío: la firma X-Core-Signature de /api/v1/* NO se valida (apagado).");
    return (_req, _res, next) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // El preflight de CORS no pasa por el gateway de CORE.
    if (req.method === "OPTIONS") return next();

    const failure = checkSignature(req, secret, now());
    if (failure) {
      console.warn(`[core-signature] rechazado ${req.method} ${req.originalUrl.split("?")[0]}: ${failure}`);
      sendProblem(req, res, { status: 401, code: "CORE_SIGNATURE_INVALID", detail: "La firma del gateway de CORE falta o no es válida." });
      return;
    }
    next();
  };
}
