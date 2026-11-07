// Cliente HTTP de los gateways (docs/INTEGRACION.md, sección 4): headers de servicio, timeout, reintentos,
// problem+json → GatewayError, tope de llamadas simultáneas por servicio y de-duplicación de GET en vuelo.
import { GatewayError, GatewayService } from "../../../domain/gateways/gateway-error";
import { currentCorrelationId } from "../../../shared/correlation";
import type { ServiceTokenProvider } from "./service-token.provider";

export interface HttpClientOptions {
  service: GatewayService;
  baseUrl: string;
  timeoutMs: number;
  maxConcurrency: number;
  serviceName: string;
  // Sin proveedor no se manda Authorization (login de usuario, token de servicio).
  tokens?: () => ServiceTokenProvider;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  // false: sin token de servicio (por defecto true si el cliente tiene proveedor).
  auth?: boolean;
}

export interface RawResponse<T> {
  status: number;
  body: T;
  headers: Headers;
}

const RETRYABLE_GET_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 5_000;

class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

export class HttpClient {
  private readonly semaphore: Semaphore;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly options: HttpClientOptions) {
    this.semaphore = new Semaphore(options.maxConcurrency);
  }

  // GET/POST que devuelve sólo el body (JSON, o undefined si no hay).
  async request<T>(request: RequestOptions): Promise<T> {
    return (await this.requestRaw<T>(request)).body;
  }

  async requestRaw<T>(request: RequestOptions): Promise<RawResponse<T>> {
    const method = request.method ?? "GET";
    if (method !== "GET") return this.execute<T>(request);

    // Llamadas iguales en vuelo comparten la respuesta.
    const key = `${request.path}?${JSON.stringify(request.query ?? {})}`;
    const pending = this.inFlight.get(key) as Promise<RawResponse<T>> | undefined;
    if (pending) return pending;

    const promise = this.execute<T>(request).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private async execute<T>(request: RequestOptions): Promise<RawResponse<T>> {
    const method = request.method ?? "GET";
    const useAuth = request.auth !== false && this.options.tokens !== undefined;
    let renewedToken = false;
    let retried = false;

    for (;;) {
      const correlationId = currentCorrelationId();
      const headers: Record<string, string> = {
        Accept: "application/json",
        "X-Correlation-Id": correlationId,
        "X-Service-Name": this.options.serviceName,
        ...request.headers,
      };
      if (request.body !== undefined) headers["Content-Type"] = "application/json";
      if (useAuth) headers.Authorization = `Bearer ${await this.options.tokens!().getToken()}`;

      const url = new URL(request.path, this.options.baseUrl.endsWith("/") ? this.options.baseUrl : `${this.options.baseUrl}/`);
      for (const [name, value] of Object.entries(request.query ?? {})) {
        if (value !== undefined) url.searchParams.set(name, String(value));
      }

      let response: Response;
      try {
        response = await this.semaphore.run(() =>
          fetch(url, {
            method,
            headers,
            body: request.body === undefined ? undefined : JSON.stringify(request.body),
            redirect: "manual",
            signal: AbortSignal.timeout(this.options.timeoutMs),
          }),
        );
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        // Sólo los GET se reintentan ante fallas de red.
        if (method === "GET" && !retried) {
          retried = true;
          continue;
        }
        throw new GatewayError(
          this.options.service,
          timedOut ? 504 : 502,
          timedOut ? "GATEWAY_TIMEOUT" : "GATEWAY_UNREACHABLE",
          timedOut ? `${this.options.service} no respondió en ${this.options.timeoutMs} ms.` : `No se pudo conectar con ${this.options.service}.`,
          correlationId,
        );
      }

      if (response.status === 401 && useAuth && !renewedToken) {
        renewedToken = true;
        this.options.tokens!().invalidate();
        continue;
      }

      if (method === "GET" && !retried && RETRYABLE_GET_STATUS.has(response.status)) {
        retried = true;
        await sleep(retryAfterMs(response));
        continue;
      }

      const text = await response.text();
      const parsed = parseJson(text);

      if (!response.ok) throw toGatewayError(this.options.service, response.status, parsed, correlationId);
      return { status: response.status, body: parsed as T, headers: response.headers };
    }
  }
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  return 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJson(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// problem+json de CORE: {type, title, status, code, detail, instance, correlationId}.
function toGatewayError(service: GatewayService, status: number, body: unknown, fallbackCorrelationId: string): GatewayError {
  const problem = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const code = typeof problem.code === "string" ? problem.code : `HTTP_${status}`;
  const detail = [problem.detail, problem.title].find((value): value is string => typeof value === "string") ?? `${service} respondió ${status}.`;
  const correlationId = typeof problem.correlationId === "string" ? problem.correlationId : fallbackCorrelationId;
  return new GatewayError(service, status, code, detail, correlationId);
}
