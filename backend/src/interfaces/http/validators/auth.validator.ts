// Validators: turn untrusted HTTP input into the shapes the use cases expect.
import { LoginDto } from "../../../application/dtos/auth.dto";
import { ValidationError } from "../../../shared/validation-error";

const UNIVERSITY_DOMAIN = "@uade.edu.ar";

export function parseLoginDto(body: unknown): LoginDto {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("El cuerpo del login debe ser un objeto JSON.");
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || !email.trim().toLowerCase().endsWith(UNIVERSITY_DOMAIN)) {
    throw new ValidationError(`Ingresá tu mail de la universidad (${UNIVERSITY_DOMAIN}).`);
  }

  if (typeof password !== "string" || password === "") {
    throw new ValidationError("La contraseña es obligatoria.");
  }

  return { email: email.trim().toLowerCase(), password };
}
