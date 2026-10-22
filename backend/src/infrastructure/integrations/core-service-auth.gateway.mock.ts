// Mock del token de servicio: lo emite el mock de CORE en el mismo proceso, firmado con la
// misma clave que publica en el JWKS.
import { CoreServiceAuthGateway } from "../../domain/gateways/core-service-auth.gateway";
import { coreMock } from "./core.mock";

export class CoreServiceAuthGatewayMock implements CoreServiceAuthGateway {
  constructor(private readonly clientId: string) {}

  async getServiceToken(): Promise<string> {
    const token = coreMock.issueServiceToken(this.clientId, "mock-secret");
    if (!token) throw new Error(`El mock de CORE no reconoce el clientId ${this.clientId}.`);

    return token.accessToken;
  }
}
