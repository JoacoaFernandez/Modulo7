// Fallo de una llamada a otro módulo (o a su mock): lleva el servicio, el status y el `code` del problem+json
// para que quien la atrape programe contra `code` y no contra el texto.
export type GatewayService = "core" | "backoffice" | "academic";

export class GatewayError extends Error {
  constructor(
    readonly service: GatewayService,
    readonly status: number,
    readonly code: string,
    message: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}
