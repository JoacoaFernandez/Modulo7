// Shared: cross-cutting helpers used by more than one layer.

// Error con status HTTP y `code` estable, como pide el contrato de CORE: los clientes
// programan contra `code`, nunca contra el texto. El error handler lo traduce a
// application/problem+json.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    detail: string,
  ) {
    super(detail);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(detail = "Sesión inválida o vencida. Iniciá sesión de nuevo.") {
    super(401, "AUTH_UNAUTHENTICATED", "No autenticado", detail);
  }
}

export class ForbiddenError extends HttpError {
  constructor(detail = "Tu usuario no tiene permiso para ver este tablero.") {
    super(403, "FORBIDDEN", "Sin permiso", detail);
  }
}

export class NotFoundError extends HttpError {
  constructor(detail = "Recurso no encontrado.") {
    super(404, "NOT_FOUND", "No encontrado", detail);
  }
}
