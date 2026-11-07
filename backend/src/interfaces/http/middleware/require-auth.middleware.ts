// Middleware: exige un access token de CORE válido (Authorization: Bearer <JWT>) y deja el usuario en res.locals.user.
import { NextFunction, Request, Response } from "express";
import { AuthenticateTokenUseCase } from "../../../application/use-cases/authenticate-token.use-case";
import { RoleId } from "../../../domain/entities/role.entity";
import { accessTokenVerifier } from "../../../infrastructure/integrations/gateways";
import { ProblemError } from "../../../shared/problem-error";

const authenticateTokenUseCase = new AuthenticateTokenUseCase(accessTokenVerifier);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  const user = token ? await authenticateTokenUseCase.execute(token) : null;
  if (!user) {
    next(new ProblemError(401, "AUTH_REQUIRED", "Sesión inválida o vencida. Iniciá sesión de nuevo."));
    return;
  }

  res.locals.user = user;
  next();
}

// Autoriza por sección, después de requireAuth: quien solo tiene la sección académica no ve el
// tablero financiero ni al revés. Alcanza con tenerla entre las suyas.
export function requireRole(role: RoleId) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user?.roles.includes(role)) {
      next(new ProblemError(403, "ANALYTICS_FORBIDDEN", "Tu rol no tiene acceso a este tablero."));
      return;
    }

    next();
  };
}
