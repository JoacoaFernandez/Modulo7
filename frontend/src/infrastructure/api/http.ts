// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Base de la API y manejo común de errores `problem+json` del backend.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

// Error HTTP con el status y el `code` de problem+json (p. ej. ANALYTICS_FORBIDDEN).
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ProblemBody {
  error?: string;
  detail?: string;
  code?: string;
}

// Arma el ApiError de una respuesta no exitosa; el mensaje sale de `error`/`detail` del backend.
export async function toApiError(response: Response, fallback: string): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ProblemBody | null;
  return new ApiError(body?.error ?? body?.detail ?? `${fallback} (${response.status}).`, response.status, body?.code ?? null);
}
