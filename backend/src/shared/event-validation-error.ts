// Evento rechazado de forma permanente (envelope o data inválidos): reintentar no lo arregla.
import { ValidationError } from "./validation-error";

export class EventValidationError extends ValidationError {
  constructor(readonly problems: string[]) {
    super(`Evento inválido: ${problems.join(" ")}`);
    this.name = "EventValidationError";
  }
}
