// Error de negocio con status y `code` propios: el error handler lo traduce a application/problem+json.
export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
  ) {
    super(detail);
    this.name = "ProblemError";
  }
}
