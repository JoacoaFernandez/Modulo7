// Junta los avisos de un tablero: cuando un gateway falla el bloque afectado sale vacío y se anota acá
// (docs/INTEGRACION.md, 1.1 "Falla de un gateway"). Nunca se inventan números.
import { DashboardWarning } from "../../../domain/entities/dashboard-warning.entity";
import { GatewayError, GatewayService } from "../../../domain/gateways/gateway-error";

export class WarningCollector {
  private readonly items: DashboardWarning[] = [];

  constructor(initial: readonly DashboardWarning[] = []) {
    initial.forEach((warning) => this.add(warning.source, warning.message));
  }

  // Sin repetidos: varias llamadas fallidas al mismo servicio con el mismo motivo son un solo aviso.
  add(source: string, message: string): void {
    if (!this.items.some((item) => item.source === source && item.message === message)) this.items.push({ source, message });
  }

  // Corre `load`; si falla (GatewayError u otro) anota el aviso y devuelve el valor de respaldo con ok=false.
  async guard<T>(source: GatewayService, what: string, load: () => Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
    try {
      return { value: await load(), ok: true };
    } catch (error) {
      const reason = describeFailure(error);
      console.warn(`[dashboard] ${source} (${what}) no respondió: ${reason}`);
      this.add(source, `No se pudo leer ${what}: ${reason}`);
      return { value: fallback, ok: false };
    }
  }

  get warnings(): DashboardWarning[] | undefined {
    return this.items.length > 0 ? [...this.items] : undefined;
  }
}

export function describeFailure(error: unknown): string {
  return error instanceof GatewayError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
}
