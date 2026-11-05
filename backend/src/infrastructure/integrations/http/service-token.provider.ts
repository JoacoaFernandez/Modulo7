// Token de servicio de Analítica (POST /internal/v1/service-auth/token), en memoria hasta `exp − 60 s`.
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { HttpClient } from "./http-client";

export interface ServiceTokenProvider {
  getToken(): Promise<string>;
  // Descarta el token (un 401 lo renueva).
  invalidate(): void;
}

// Con CORE mockeado el token de servicio es un string fijo y no hay llamada.
export class MockServiceTokenProvider implements ServiceTokenProvider {
  async getToken(): Promise<string> {
    return "mock-service-token";
  }
  invalidate(): void {}
}

export class CoreServiceTokenProvider implements ServiceTokenProvider {
  private token: { value: string; refreshAt: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly credentials: { clientId: string; clientSecret: string },
  ) {}

  getToken(): Promise<string> {
    if (this.token && this.token.refreshAt > Date.now()) return Promise.resolve(this.token.value);
    // Varios requests simultáneos comparten una sola llamada.
    this.pending ??= this.fetchToken().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  invalidate(): void {
    this.token = null;
  }

  private async fetchToken(): Promise<string> {
    const body = await this.http.request<{ accessToken?: string; expiresIn?: number }>({
      method: "POST",
      path: "/internal/v1/service-auth/token",
      body: this.credentials,
      auth: false,
    });
    if (!body.accessToken) {
      throw new GatewayError("core", 502, "INVALID_RESPONSE", "CORE no devolvió accessToken en service-auth/token.");
    }
    const lifetimeMs = (body.expiresIn ?? 900) * 1000;
    this.token = { value: body.accessToken, refreshAt: Date.now() + Math.max(lifetimeMs - 60_000, 1_000) };
    return body.accessToken;
  }
}
