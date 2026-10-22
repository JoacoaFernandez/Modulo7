// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Errores application/problem+json: { type, title, status, code, detail, instance, correlationId }.
// Se le muestra al usuario el `detail`, que viene en castellano.
export async function toProblemError(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  const detail = typeof body?.detail === "string" && body.detail ? body.detail : `${fallback} (${response.status}).`;
  return new Error(detail);
}
