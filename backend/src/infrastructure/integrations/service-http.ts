// GET backend a backend hacia otro módulo, directo (sin gateway) y con el token de servicio de
// CORE, que el módulo destino valida contra el JWKS. 404 se devuelve como null.
import { randomUUID } from "node:crypto";
import { CoreServiceAuthGateway } from "../../domain/gateways/core-service-auth.gateway";

const TIMEOUT_MS = 10_000;

export async function getAsService<T>(
  serviceAuth: CoreServiceAuthGateway,
  url: string,
  correlationId: string = randomUUID(),
): Promise<T | null> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${await serviceAuth.getServiceToken()}`,
      "X-Service-Name": "analytics-service",
      "X-Correlation-Id": correlationId,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${url} respondió ${response.status}.`);
  return (await response.json()) as T;
}
