// CORE real: GET /internal/v1/events (permiso events:read). La forma de la respuesta no está documentada: se asume
// { items: [envelope], nextCursor } (convención de paginación de CORE v1 §2); validar contra el Swagger.
import { CoreEventsGateway, CoreEventsPage, CoreEventsQuery } from "../../../domain/gateways/core-events.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { HttpClient } from "../http/http-client";

export class CoreEventsGatewayHttp implements CoreEventsGateway {
  constructor(private readonly http: HttpClient) {}

  async listEvents(query: CoreEventsQuery): Promise<CoreEventsPage> {
    const body = await this.http.request<{ items?: unknown[]; nextCursor?: string | null }>({
      path: "/internal/v1/events",
      query: { ...query },
    });
    if (!body || !Array.isArray(body.items)) {
      throw new GatewayError("core", 502, "INVALID_RESPONSE", "CORE devolvió un events sin items (forma no documentada: ver docs/INTEGRACION.md, 4.1.e).");
    }
    return { items: body.items, nextCursor: body.nextCursor ?? null };
  }
}
