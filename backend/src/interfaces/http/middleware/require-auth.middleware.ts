// Middleware: exige un token de CORE válido (Authorization: Bearer <token>).
import { NextFunction, Request, Response } from "express";
import { AuthenticateTokenUseCase } from "../../../application/use-cases/authenticate-token.use-case";
import { RoleId } from "../../../domain/entities/role.entity";
import { coreAuthGateway } from "../../../infrastructure/integrations/gateways";

const authenticateTokenUseCase = new AuthenticateTokenUseCase(coreAuthGateway);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  const user = token ? await authenticateTokenUseCase.execute(token) : null;
  if (!user) {
    res.status(401).json({ error: "Sesión inválida o vencida. Iniciá sesión de nuevo." });
    return;
  }

  res.locals.user = user;
  next();
}

// Autoriza por rol, después de requireAuth: quien solo tiene el rol académico no ve el
// tablero financiero ni al revés. Alcanza con tener el rol entre los suyos.
export function requireRole(role: RoleId) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user?.roles.includes(role)) {
      res.status(403).json({ error: "Tu rol no tiene acceso a este tablero." });
      return;
    }

    next();
  };
}
