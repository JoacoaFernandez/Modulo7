// Configuración por variables de entorno (backend/.env en desarrollo, nunca versionado). Sin
// una URL, el gateway de ese módulo usa su mock; con la URL, habla HTTP con el módulo real.
import { existsSync } from "node:fs";
import path from "node:path";

// backend/.env, tanto corriendo con tsx (src/infrastructure) como compilado (dist/src/infrastructure).
const envFile = [path.join(__dirname, "..", "..", ".env"), path.join(__dirname, "..", "..", "..", ".env")].find(existsSync);
if (envFile) process.loadEnvFile(envFile);

const optional = (name: string): string | null => process.env[name]?.trim() || null;

export const config = {
  // CORE (módulo 10): base de /internal/v1/* para el token de servicio.
  coreBaseUrl: optional("CORE_BASE_URL"),
  // Credenciales de servicio que asignó CORE a Analítica.
  clientId: optional("ANALYTICS_CLIENT_ID") ?? "analytics-service",
  clientSecret: optional("ANALYTICS_CLIENT_SECRET"),
  // Backoffice (módulo 8): se consulta directo, sin pasar por el gateway, con token de servicio.
  backofficeUrl: optional("BACKOFFICE_URL"),
  // Gestión Académica (módulo 9): ídem, directo a su backend con token de servicio.
  academicUrl: optional("ACADEMIC_URL"),
};
