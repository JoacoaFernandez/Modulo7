// Gateway real hacia CORE para el token de servicio: POST /internal/v1/service-auth/token con
// el clientId y el secret de Analítica. El token dura 15 minutos y se cachea hasta un minuto
// antes de vencer, así no se pide uno por request.
import { CoreServiceAuthGateway } from "../../domain/gateways/core-service-auth.gateway";

const RENEW_BEFORE_MS = 60 * 1000;

export class CoreServiceAuthGatewayHttp implements CoreServiceAuthGateway {
  private cached: { token: string; expiresAt: number } | null = null;
  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly coreBaseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async getServiceToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt - RENEW_BEFORE_MS > Date.now()) return this.cached.token;

    // Varios requests concurrentes comparten el mismo pedido a CORE.
    this.inFlight ??= this.requestToken().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async requestToken(): Promise<string> {
    const response = await fetch(`${this.coreBaseUrl}/internal/v1/service-auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Name": this.clientId },
      body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
    });
    if (!response.ok) throw new Error(`CORE rechazó el token de servicio (${response.status}).`);

    const body = (await response.json()) as { accessToken: string; expiresIn: number };
    this.cached = { token: body.accessToken, expiresAt: Date.now() + body.expiresIn * 1000 };
    return body.accessToken;
  }
}
