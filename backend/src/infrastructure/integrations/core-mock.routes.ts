// Rutas HTTP del mock de CORE (módulo 10). No son parte de la API de Analítica: representan a
// CORE mientras no exista el real, con las rutas y los shapes de su contrato v1. El frontend
// del portal llama a estas rutas para el login, igual que llamaría a CORE.
import { Request, Response, Router } from "express";
import { HttpError, UnauthorizedError } from "../../shared/http-error";
import { ValidationError } from "../../shared/validation-error";
import { coreAuthGateway } from "./gateways";
import { CoreSession, coreMock } from "./core.mock";

const UNIVERSITY_DOMAIN = "@uade.edu.ar";
const REFRESH_COOKIE = "uadenet_refresh";
const REFRESH_COOKIE_PATH = "/api/v1/auth";
const REFRESH_COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60;

export const coreAuthMockRoutes = Router();

coreAuthMockRoutes.post("/login", (req, res) => {
  const { email, password } = parseLoginBody(req.body);
  const session = coreMock.login(email, password);
  if (!session) {
    throw new HttpError(401, "AUTH_INVALID_CREDENTIALS", "Credenciales inválidas", "Mail o contraseña incorrectos.");
  }

  sendSession(res, session);
});

coreAuthMockRoutes.post("/refresh", (req, res) => {
  const session = coreMock.refresh(readRefreshCookie(req));
  if (!session) {
    clearRefreshCookie(res);
    throw new UnauthorizedError("La sesión venció. Iniciá sesión de nuevo.");
  }

  // El refresh devuelve sólo el access token nuevo; la cookie rota.
  setRefreshCookie(res, session.refreshToken);
  res.json({ accessToken: session.response.accessToken, expiresIn: session.response.expiresIn });
});

coreAuthMockRoutes.post("/logout", (req, res) => {
  coreMock.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.sendStatus(204);
});

coreAuthMockRoutes.get("/me", async (req, res) => {
  const header = req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const identity = token ? await coreAuthGateway.verifyAccessToken(token) : null;
  const user = identity ? coreMock.findUser(identity.userId) : null;
  if (!user) throw new UnauthorizedError();

  res.json(user);
});

// API interna de CORE (/internal/v1/*), la que usan los backends con su token de servicio.
export const coreInternalMockRoutes = Router();

coreInternalMockRoutes.post("/service-auth/token", (req, res) => {
  const body = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  const token = coreMock.issueServiceToken(clientId, clientSecret);
  if (!token) {
    throw new HttpError(401, "AUTH_INVALID_CLIENT", "Credenciales de servicio inválidas", "clientId o clientSecret incorrectos.");
  }

  res.json({ ...token, tokenType: "Bearer" });
});

export const coreJwksMockRoutes = Router();

coreJwksMockRoutes.get("/jwks.json", (_req, res) => {
  res.json(coreMock.jwks());
});

function sendSession(res: Response, session: CoreSession) {
  setRefreshCookie(res, session.refreshToken);
  res.json(session.response);
}

function parseLoginBody(body: unknown): { email: string; password: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("El cuerpo del login debe ser un objeto JSON.");
  }

  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || !email.trim().toLowerCase().endsWith(UNIVERSITY_DOMAIN)) {
    throw new ValidationError(`Ingresá tu mail de la universidad (${UNIVERSITY_DOMAIN}).`);
  }
  if (typeof password !== "string" || password === "") {
    throw new ValidationError("La contraseña es obligatoria.");
  }

  return { email, password };
}

// Sin dependencia de cookie-parser: alcanza con leer una sola cookie.
function readRefreshCookie(req: Request): string {
  const cookies = (req.header("Cookie") ?? "").split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(REFRESH_COOKIE.length + 1)) : "";
}

// SameSite=Lax alcanza en desarrollo: localhost:5173 y localhost:3000 son el mismo sitio.
// Secure sólo en producción, porque en localhost se sirve por http.
function setRefreshCookie(res: Response, value: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${REFRESH_COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=${REFRESH_COOKIE_PATH}; Max-Age=${REFRESH_COOKIE_MAX_AGE_S}${secure}`,
  );
}

function clearRefreshCookie(res: Response) {
  res.append("Set-Cookie", `${REFRESH_COOKIE}=; HttpOnly; SameSite=Lax; Path=${REFRESH_COOKIE_PATH}; Max-Age=0`);
}
