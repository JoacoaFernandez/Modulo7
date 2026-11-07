// Controllers: translate HTTP requests into use-case calls and shape HTTP responses.
import { Request, Response } from "express";
import { UserProfileService } from "../../../application/services/user-profile.service";
import { LoginUseCase } from "../../../application/use-cases/login.use-case";
import { LogoutUseCase } from "../../../application/use-cases/logout.use-case";
import { RefreshSessionUseCase } from "../../../application/use-cases/refresh-session.use-case";
import { accessTokenVerifier, backofficeGateway, coreAuthGateway } from "../../../infrastructure/integrations/gateways";
import { clearCookies, cookieNames, rewriteRefreshCookie } from "../auth-cookie";
import { parseLoginDto } from "../validators/auth.validator";

const profiles = new UserProfileService(backofficeGateway);
const loginUseCase = new LoginUseCase(coreAuthGateway, profiles);
const refreshUseCase = new RefreshSessionUseCase(coreAuthGateway, accessTokenVerifier, profiles);
const logoutUseCase = new LogoutUseCase(coreAuthGateway);

export class AuthController {
  async login(req: Request, res: Response) {
    // Ni la contraseña ni el token se loguean.
    const { session, setCookie } = await loginUseCase.execute(parseLoginDto(req.body));
    if (setCookie) res.append("Set-Cookie", rewriteRefreshCookie(setCookie));
    res.json(session);
  }

  // El refresh token rota en cada uso: el frontend serializa las llamadas.
  async refresh(req: Request, res: Response) {
    const { session, setCookie } = await refreshUseCase.execute(req.headers.cookie);
    if (setCookie) res.append("Set-Cookie", rewriteRefreshCookie(setCookie));
    res.json(session);
  }

  async logout(req: Request, res: Response) {
    const setCookie = await logoutUseCase.execute(req.headers.cookie);
    const cookies = setCookie ? [rewriteRefreshCookie(setCookie)] : clearCookies(cookieNames(req.headers.cookie));
    for (const cookie of cookies) res.append("Set-Cookie", cookie);
    res.sendStatus(204);
  }

  // Usuario del JWT (middleware requireAuth) más el nombre a mostrar.
  async me(_req: Request, res: Response) {
    res.json(await profiles.withName(res.locals.user));
  }
}
