// Instancias únicas de los gateways hacia otros módulos. Cuando exista el módulo real, se
// reemplaza la implementación acá y el resto del backend no cambia.
import { CoreAuthGatewayMock } from "./core-auth.gateway.mock";

export const coreAuthGateway = new CoreAuthGatewayMock();
