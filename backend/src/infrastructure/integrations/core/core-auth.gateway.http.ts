// CORE real: login, refresh y logout de usuario (/api/v1/auth/*). Sin token de servicio.
import { CoreAuthGateway, CoreLoginResult, CoreTokenResult } from "../../../domain/gateways/core-auth.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { HttpClient } from "../http/http-client";

interface CoreTokenBody {
  accessToken?: string;
  expiresIn?: number;
}

export class CoreAuthGatewayHttp implements CoreAuthGateway {
  constructor(private readonly http: HttpClient) {}

  async login(email: string, password: string): Promise<CoreLoginResult> {
    const response = await this.http.requestRaw<CoreTokenBody & { user?: CoreLoginResult["user"] }>({
      method: "POST",
      path: "/api/v1/auth/login",
      body: { email, password },
    });
    const { accessToken, expiresIn, user } = response.body ?? {};
    if (!accessToken || !user) throw invalid("login");
    return { accessToken, expiresIn: expiresIn ?? 900, user, setCookie: firstCookie(response.headers) };
  }

  async refresh(cookieHeader: string | undefined): Promise<CoreTokenResult> {
    if (!cookieHeader) throw new GatewayError("core", 401, "AUTH_REFRESH_INVALID", "No hay cookie de refresh.");
    const response = await this.http.requestRaw<CoreTokenBody>({
      method: "POST",
      path: "/api/v1/auth/refresh",
      headers: { Cookie: cookieHeader },
    });
    if (!response.body?.accessToken) throw invalid("refresh");
    return { accessToken: response.body.accessToken, expiresIn: response.body.expiresIn ?? 900, setCookie: firstCookie(response.headers) };
  }

  async logout(cookieHeader: string | undefined): Promise<{ setCookie: string | null }> {
    const response = await this.http.requestRaw<unknown>({
      method: "POST",
      path: "/api/v1/auth/logout",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    return { setCookie: firstCookie(response.headers) };
  }
}

function firstCookie(headers: Headers): string | null {
  return headers.getSetCookie()[0] ?? null;
}

function invalid(operation: string): GatewayError {
  return new GatewayError("core", 502, "INVALID_RESPONSE", `CORE devolvió una respuesta inesperada en ${operation}.`);
}
