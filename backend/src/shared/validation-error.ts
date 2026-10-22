// Shared: cross-cutting helpers used by more than one layer.
import { HttpError } from "./http-error";

// Entrada inválida del cliente: el error handler la traduce a 400. `code` distingue un
// query param inválido (VALIDATION_ERROR) de un evento que no cumple su esquema
// (EVENT_SCHEMA_INVALID).
export class ValidationError extends HttpError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(400, code, "Solicitud inválida", message);
    this.name = "ValidationError";
  }
}
