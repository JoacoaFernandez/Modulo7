// Domain entities: core business objects, independent of frameworks and infrastructure.

// Aviso de que una fuente no respondió y el bloque afectado salió vacío (nunca se inventan números).
export interface DashboardWarning {
  // Servicio afectado: "core", "backoffice", "academic".
  source: string;
  message: string;
}
