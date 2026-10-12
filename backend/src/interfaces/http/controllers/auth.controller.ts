// Controllers: translate HTTP requests into use-case calls and shape HTTP responses.
import { Request, Response } from "express";
import { LoginUseCase } from "../../../application/use-cases/login.use-case";
import { coreAuthGateway } from "../../../infrastructure/integrations/gateways";
import { parseLoginDto } from "../validators/auth.validator";

const loginUseCase = new LoginUseCase(coreAuthGateway);

export class AuthController {
  async login(req: Request, res: Response) {
    const session = await loginUseCase.execute(parseLoginDto(req.body));

    if (!session) {
      res.status(401).json({ error: "Mail o contraseña incorrectos." });
      return;
    }

    res.json(session);
  }

  // Devuelve el usuario que resolvió el middleware requireAuth.
  me(_req: Request, res: Response) {
    res.json(res.locals.user);
  }
}
