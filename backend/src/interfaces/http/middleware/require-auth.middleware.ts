// Middleware: exige un access token de CORE válido (Authorization: Bearer <jwt>). El gateway
// ya lo validó, pero el contrato pide revalidarlo localmente contra el JWKS.
import { NextFunction, Request, Response } from "express";
import { AuthenticateTokenUseCase } from "../../../application/use-cases/authenticate-token.use-case";
import { ForbiddenError, UnauthorizedError } from "../../../shared/http-error";
import { coreAuthGateway } from "../../../infrastructure/integrations/gateways";

const authenticateTokenUseCase = new AuthenticateTokenUseCase(coreAuthGateway);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  const user = token ? await authenticateTokenUseCase.execute(token) : null;
  if (!user) throw new UnauthorizedError();

  res.locals.user = user;
  next();
}

// Autoriza por permiso de Backoffice, después de requireAuth: con analytics:academic:read se
// ve el tablero académico (que incluye las estadísticas de eventos), con
// analytics:finance:read el financiero.
export function requirePermission(permission: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user?.permissions.includes(permission)) throw new ForbiddenError();

    next();
  };
}
