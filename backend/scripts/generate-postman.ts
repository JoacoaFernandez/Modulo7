// Genera la colección de Postman de la API de Analítica en docs/postman/. Los ejemplos de
// eventos salen de EVENT_SCHEMAS, así que siempre cumplen el contrato vigente.
// Uso: npm run docs:postman
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FieldSpec } from "../src/domain/entities/event-schema.entity";
import { EVENT_SCHEMAS } from "../src/domain/entities/event-schemas";
import { SOURCE_MODULES } from "../src/domain/entities/event-source.entity";
import { TERMS } from "../src/infrastructure/integrations/academic-terms.gateway.mock";
import { SITE_IDS } from "../src/infrastructure/integrations/backoffice-sites.gateway.mock";

const EXAMPLE_UUID = "ba310c57-a684-4dbf-a4a4-905fcfbefa08";

const EXAMPLES_BY_FIELD: Record<string, unknown> = {
  siteId: SITE_IDS.centro,
  currency: "ARS",
  roles: ["TEACHER"],
  permissions: [],
};

function exampleValue(field: FieldSpec): unknown {
  if (field.name in EXAMPLES_BY_FIELD) return EXAMPLES_BY_FIELD[field.name];
  if (field.oneOf) return field.oneOf[0];
  // Todo identificador del ecosistema es un UUID v4.
  if (field.type === "string" && field.name.endsWith("Id")) return EXAMPLE_UUID;

  switch (field.type) {
    case "string":
      return `${field.name}-ejemplo`;
    case "number":
      return 10;
    case "boolean":
      return true;
    case "date":
      return "2026-09-15";
    case "datetime":
      return "2026-09-15T15:00:00.000Z";
    case "decimal":
      return "1500.00";
    case "object":
      return exampleObject(field.fields ?? []);
    case "array":
      return field.fields ? [exampleObject(field.fields)] : [];
  }
}

function exampleObject(fields: readonly FieldSpec[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.name, exampleValue(field)]));
}

const jsonHeader = [{ key: "Content-Type", value: "application/json" }];
const bearer = { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] };

function url(pathname: string, query: Record<string, string> = {}) {
  const queryString = Object.entries(query)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return {
    raw: `{{baseUrl}}${pathname}${queryString ? `?${queryString}` : ""}`,
    host: ["{{baseUrl}}"],
    path: pathname.split("/").filter(Boolean),
    query: Object.entries(query).map(([key, value]) => ({ key, value })),
  };
}

// Cada request simula una entrega de la cola analytics.all-events.v1. {{$guid}} genera un
// eventId nuevo por envío; para probar la deduplicación, fijarlo a mano y mandarlo dos veces.
const eventFolders = SOURCE_MODULES.flatMap((module) => {
  const schemas = EVENT_SCHEMAS.filter((schema) => schema.source === module);
  if (schemas.length === 0) return [];

  return [
    {
      name: module,
      item: schemas.map((schema) => ({
        name: schema.eventType,
        request: {
          method: "POST",
          header: jsonHeader,
          url: url("/api/v1/dev/events"),
          body: {
            mode: "raw",
            raw: JSON.stringify(
              {
                specVersion: "1.0",
                eventId: "{{$guid}}",
                eventType: schema.eventType,
                source: schema.source,
                occurredAt: "2026-09-15T15:00:00.000Z",
                subject: `${schema.eventType.split(".")[1]}/${EXAMPLE_UUID}`,
                correlationId: "{{$guid}}",
                causationId: null,
                actor: { type: "service", id: `${module}-service` },
                data: exampleObject(schema.fields),
              },
              null,
              2,
            ),
          },
        },
      })),
    },
  ];
});

const saveTokenScript = [
  "const body = pm.response.json();",
  "if (pm.response.code === 200) { pm.collectionVariables.set('token', body.accessToken); }",
];

const dashboardRequest = (name: string, pathname: string, query: Record<string, string>) => ({
  name,
  request: { method: "GET", auth: bearer, header: [], url: url(pathname, query) },
});

const collection = {
  info: {
    name: "UADEnet · Analítica Institucional (Módulo 7)",
    description:
      "API del módulo de Analítica (ruta interna /api/v1/*; por el gateway de CORE es /api/v1/analytics/*). Primero correr un Login del mock de CORE (guarda el access token solo); los tableros exigen el permiso analytics:* correspondiente. Los eventos se simulan con /api/v1/dev/events, que reemplaza a la cola analytics.all-events.v1 en desarrollo. Generada con `npm run docs:postman`.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000" },
    { key: "token", value: "" },
    { key: "siteId", value: SITE_IDS.centro },
    { key: "termId", value: TERMS[TERMS.length - 1].termId },
    { key: "month", value: "2026-08" },
  ],
  item: [
    {
      name: "Auth (mock de CORE)",
      item: [
        {
          name: "Login · Dirección Académica",
          event: [{ listen: "test", script: { type: "text/javascript", exec: saveTokenScript } }],
          request: {
            method: "POST",
            header: jsonHeader,
            url: url("/api/v1/auth/login"),
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "direccion.academica@uade.edu.ar", password: "{{demoPassword}}" }, null, 2),
            },
          },
        },
        {
          name: "Login · Dirección Financiera",
          event: [{ listen: "test", script: { type: "text/javascript", exec: saveTokenScript } }],
          request: {
            method: "POST",
            header: jsonHeader,
            url: url("/api/v1/auth/login"),
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "direccion.financiera@uade.edu.ar", password: "{{demoPassword}}" }, null, 2),
            },
          },
        },
        {
          name: "Login · Dirección General (ambos permisos)",
          event: [{ listen: "test", script: { type: "text/javascript", exec: saveTokenScript } }],
          request: {
            method: "POST",
            header: jsonHeader,
            url: url("/api/v1/auth/login"),
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "direccion.general@uade.edu.ar", password: "{{demoPassword}}" }, null, 2),
            },
          },
        },
        { name: "Refresh (cookie de refresh)", request: { method: "POST", header: [], url: url("/api/v1/auth/refresh") } },
        { name: "Logout", request: { method: "POST", header: [], url: url("/api/v1/auth/logout") } },
        { name: "Identidad en CORE (/auth/me)", request: { method: "GET", auth: bearer, header: [], url: url("/api/v1/auth/me") } },
        { name: "JWKS", request: { method: "GET", header: [], url: url("/.well-known/jwks.json") } },
      ],
    },
    {
      name: "Analítica (requieren token)",
      item: [
        dashboardRequest("Usuario del portal (nombre y perfiles)", "/api/v1/me", {}),
        dashboardRequest("Filtros (sedes de Backoffice, cuatrimestres, meses)", "/api/v1/filters", {}),
        dashboardRequest("Tablero académico · analytics:academic:read", "/api/v1/dashboard/academic", {
          siteId: "{{siteId}}",
          termId: "{{termId}}",
        }),
        dashboardRequest("Tablero financiero · analytics:finance:read", "/api/v1/dashboard/financial", {
          siteId: "{{siteId}}",
          month: "{{month}}",
        }),
        dashboardRequest("Estadísticas de eventos · analytics:academic:read", "/api/v1/events/stats", {
          siteId: "{{siteId}}",
          month: "{{month}}",
        }),
      ],
    },
    {
      name: "Públicos",
      item: [
        { name: "Fuentes de eventos", request: { method: "GET", header: [], url: url("/api/v1/sources") } },
        { name: "Perfiles de Analítica", request: { method: "GET", header: [], url: url("/api/v1/roles") } },
        { name: "Health · live", request: { method: "GET", header: [], url: url("/health/live") } },
        { name: "Health · ready", request: { method: "GET", header: [], url: url("/health/ready") } },
        { name: "Eventos consumidos (solo desarrollo)", request: { method: "GET", header: [], url: url("/api/v1/dev/events") } },
      ],
    },
    { name: "Eventos de CORE (simulan la cola)", item: eventFolders },
  ],
};

// `demoPassword` no se versiona con valor: se completa en Postman con la contraseña de demo
// del README.
(collection.variable as Array<{ key: string; value: string }>).push({ key: "demoPassword", value: "" });

const outDir = path.join(__dirname, "..", "..", "docs", "postman");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "UADEnet-Analitica.postman_collection.json"), JSON.stringify(collection, null, 2) + "\n");
console.log("Colección generada en docs/postman/.");
