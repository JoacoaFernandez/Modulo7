// Configuración: se lee una sola vez de process.env (docs/INTEGRACION.md, sección 2) y se valida al arrancar.
// Debe importarse después de load-env para que las variables de .env ya estén cargadas.

function text(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name: string, hint: string): string {
  const value = text(name);
  if (value === undefined) throw new Error(`Falta la variable ${name}. ${hint}`);
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const value = text(name)?.toLowerCase();
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} debe ser "true" o "false" (vino "${value}").`);
}

function int(name: string, fallback: number, min = 0): number {
  const raw = text(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} debe ser un entero mayor o igual a ${min} (vino "${raw}").`);
  }
  return value;
}

function validateRabbitUrl(url: string): void {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error("RABBITMQ_URL no es una URL válida (se espera amqp://... o amqps://...).");
  }
  if (protocol !== "amqp:" && protocol !== "amqps:") {
    throw new Error("RABBITMQ_URL debe empezar con amqp:// o amqps://.");
  }
}

function load() {
  const rabbitUrl = text("RABBITMQ_URL");
  if (rabbitUrl !== undefined) validateRabbitUrl(rabbitUrl);

  const coreBaseUrl = text("CORE_BASE_URL");
  const mocks = {
    core: bool("CORE_MOCK", true),
    backoffice: bool("BACKOFFICE_MOCK", true),
    academic: bool("ACADEMIC_MOCK", true),
    dir: text("MOCKS_DIR") ?? "./mocks",
  };

  // Variables obligatorias según el modo de cada servicio (docs/INTEGRACION.md, sección 2).
  const coreHint = "Con CORE_MOCK=false se usa el CORE real: definí CORE_BASE_URL, CORE_CLIENT_SECRET y CORE_JWT_ISSUER (o poné CORE_MOCK=true para usar backend/mocks/core).";
  if (!mocks.core) {
    required("CORE_BASE_URL", coreHint);
    required("CORE_CLIENT_SECRET", coreHint);
    required("CORE_JWT_ISSUER", coreHint);
  }
  if (!mocks.backoffice) {
    required("BACKOFFICE_BASE_URL", "Con BACKOFFICE_MOCK=false se usa el backend real de Backoffice (o poné BACKOFFICE_MOCK=true).");
  }
  if (!mocks.academic) {
    required("ACADEMIC_BASE_URL", "Con ACADEMIC_MOCK=false se usa el backend real de Gestión Académica (o poné ACADEMIC_MOCK=true).");
  }
  const sameSite = (text("AUTH_COOKIE_SAMESITE") ?? "lax").toLowerCase();
  if (sameSite !== "lax" && sameSite !== "none" && sameSite !== "strict") {
    throw new Error(`AUTH_COOKIE_SAMESITE debe ser lax, strict o none (vino "${sameSite}").`);
  }

  return {
    port: int("PORT", 3000, 1),
    databaseUrl: required(
      "DATABASE_URL",
      "El módulo lee todos sus datos de Postgres. Copiá backend/.env.example a backend/.env (o definila en el entorno) y levantá la base con: npm run db:up && npm run db:migrate",
    ),
    corsOrigins: (text("CORS_ORIGINS") ?? "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean),
    serviceName: text("SERVICE_NAME") ?? "analytics",

    events: {
      httpIngest: bool("EVENTS_HTTP_INGEST", false),
      inboxStoreUnknown: bool("INBOX_STORE_UNKNOWN", false),
    },
    rabbitmq: {
      // Sin URL no hay consumer.
      url: rabbitUrl,
      queue: text("RABBITMQ_QUEUE") ?? "analytics.all-events.v1",
      prefetch: int("RABBITMQ_PREFETCH", 20, 1),
      maxAttempts: int("RABBITMQ_MAX_ATTEMPTS", 3, 1),
    },

    mocks,
    production: process.env.NODE_ENV === "production",
    core: {
      baseUrl: coreBaseUrl,
      clientId: text("CORE_CLIENT_ID") ?? "analytics-service",
      clientSecret: text("CORE_CLIENT_SECRET"),
      jwtIssuer: text("CORE_JWT_ISSUER"),
      jwtAudience: text("CORE_JWT_AUDIENCE") ?? "uadenet",
      jwksUrl: text("CORE_JWKS_URL") ?? (coreBaseUrl ? `${coreBaseUrl}/.well-known/jwks.json` : undefined),
    },
    backoffice: { baseUrl: text("BACKOFFICE_BASE_URL") },
    academic: { baseUrl: text("ACADEMIC_BASE_URL") },
    gateway: {
      maxConcurrency: int("GATEWAY_MAX_CONCURRENCY", 4, 1),
      timeoutMs: int("GATEWAY_TIMEOUT_MS", 10000, 1),
    },
    cacheTtlSeconds: {
      static: int("CACHE_TTL_SECONDS_STATIC", 3600),
      users: int("CACHE_TTL_SECONDS_USERS", 600),
      courses: int("CACHE_TTL_SECONDS_COURSES", 300),
      aggregates: int("CACHE_TTL_SECONDS_AGGREGATES", 300),
    },
    walletSnapshot: {
      enabled: bool("WALLET_SNAPSHOT_ENABLED", true),
      intervalMin: int("WALLET_SNAPSHOT_INTERVAL_MIN", 360, 1),
      backfillMonths: int("WALLET_SNAPSHOT_BACKFILL_MONTHS", 0),
    },
    dashboard: {
      firstMonth: text("DASHBOARD_FIRST_MONTH") ?? "2026-03",
      diningRevenueNetOfAttendance: bool("DINING_REVENUE_NET_OF_ATTENDANCE", false),
    },
    authCookieSameSite: sameSite,
  };
}

export type Config = ReturnType<typeof load>;

// Si algo falta o está mal, el server no arranca y dice por qué.
function loadOrExit(): Config {
  try {
    return load();
  } catch (error) {
    console.error(`Configuración inválida: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export const config: Config = loadOrExit();
