// Shared: cross-cutting helpers used by more than one layer.

// Entrada inválida del cliente: el error handler la traduce a 400.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
