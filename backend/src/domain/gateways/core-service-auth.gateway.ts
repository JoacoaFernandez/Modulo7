// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.

// CORE (módulo 10): emite el token de servicio de Analítica (clientId analytics-service). Se usa
// en toda llamada backend a backend: /internal/v1/* de CORE y las consultas directas a otros
// módulos, que lo validan contra el JWKS de CORE. Nunca se usa el token del usuario para esto.
export interface CoreServiceAuthGateway {
  // Token vigente; la implementación lo cachea hasta poco antes de que venza.
  getServiceToken(): Promise<string>;
}
