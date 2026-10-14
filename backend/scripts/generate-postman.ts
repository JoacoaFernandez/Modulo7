// Genera la colección de Postman de la API de Analítica en docs/postman/. Los ejemplos de
// ingesta salen de EVENT_SCHEMAS, así que siempre cumplen el contrato vigente.
// Uso: npm run docs:postman
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FieldSpec } from "../src/domain/entities/event-schema.entity";
import { EVENT_SCHEMAS } from "../src/domain/entities/event-schemas";
import { SOURCE_MODULES } from "../src/domain/entities/event-source.entity";

const EXAMPLES_BY_FIELD: Record<string, unknown> = {
  sedeId: "sede-centro",
  cuatrimestre: "2026-2C",
  periodo: "2026-08",
  fecha: "2026-08-20",
};

function exampleValue(field: FieldSpec): unknown {
  if (field.name in EXAMPLES_BY_FIELD) return EXAMPLES_BY_FIELD[field.name];

  switch (field.type) {
    case "string":
      return field.oneOf ? field.oneOf[0] : `${field.name}-ejemplo`;
    case "number":
      return 1000;
    case "boolean":
      return true;
    case "date":
      return "2026-08-20";
    case "object":
      return exampleObject(field.fields ?? []);
    case "array":
      return [exampleObject(field.fields ?? [])];
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

const eventFolders = SOURCE_MODULES.flatMap((module) => {
  const schemas = EVENT_SCHEMAS.filter((schema) => schema.sourceModule === module);
  if (schemas.length === 0) return [];

  return [
    {
      name: module,
      item: schemas.map((schema) => ({
        name: schema.eventType,
        request: {
          method: "POST",
          header: jsonHeader,
          url: url("/api/analytics/events"),
          body: {
            mode: "raw",
            raw: JSON.stringify(
              {
                eventId: `${module}-${schema.eventType}-001`,
                sourceModule: module,
                eventType: schema.eventType,
                occurredAt: "2026-08-20T13:20:00-03:00",
                payload: exampleObject(schema.fields),
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
  "if (pm.response.code === 200) { pm.collectionVariables.set('token', body.token); }",
];

const dashboardRequest = (name: string, pathname: string, query: Record<string, string>) => ({
  name,
  request: { method: "GET", auth: bearer, header: [], url: url(pathname, query) },
});

const collection = {
  info: {
    name: "UADEnet · Analítica Institucional (Módulo 7)",
    description:
      "API del módulo de Analítica. Primero correr un Login (guarda el token solo); los tableros exigen sesión y el rol correcto. La ingesta de eventos es pública: la llaman los otros módulos. Generada con `npm run docs:postman`.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000" },
    { key: "token", value: "" },
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
            url: url("/api/auth/login"),
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
            url: url("/api/auth/login"),
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "direccion.financiera@uade.edu.ar", password: "{{demoPassword}}" }, null, 2),
            },
          },
        },
        {
          name: "Login · Dirección General (ambos roles)",
          event: [{ listen: "test", script: { type: "text/javascript", exec: saveTokenScript } }],
          request: {
            method: "POST",
            header: jsonHeader,
            url: url("/api/auth/login"),
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "direccion.general@uade.edu.ar", password: "{{demoPassword}}" }, null, 2),
            },
          },
        },
        { name: "Usuario actual", request: { method: "GET", auth: bearer, header: [], url: url("/api/auth/me") } },
      ],
    },
    {
      name: "Tableros (requieren token)",
      item: [
        dashboardRequest("Filtros (sedes de Backoffice, cuatrimestres, meses)", "/api/analytics/filters", {}),
        dashboardRequest("Tablero académico · rol académico", "/api/analytics/dashboard/academic", {
          sedeId: "todas-las-sedes",
          cuatrimestre: "2026-1C",
        }),
        dashboardRequest("Tablero financiero · rol financiero", "/api/analytics/dashboard/financial", {
          sedeId: "todas-las-sedes",
          periodo: "Ago 2026",
        }),
        dashboardRequest("Estadísticas de eventos · rol financiero", "/api/analytics/events/stats", {
          sedeId: "todas-las-sedes",
          periodo: "Ago 2026",
        }),
      ],
    },
    {
      name: "Públicos",
      item: [
        { name: "Fuentes de eventos", request: { method: "GET", header: [], url: url("/api/analytics/sources") } },
        { name: "Eventos ingeridos (solo desarrollo)", request: { method: "GET", header: [], url: url("/api/analytics/events") } },
      ],
    },
    {
      name: "Formato real de Gestión Académica (se normaliza)",
      item: [
        {
          name: "resultado publicado · formato con `tipo`",
          request: {
            method: "POST",
            header: jsonHeader,
            url: url("/api/analytics/events"),
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  tipo: "academica.resultado.publicado",
                  ocurridoEn: "2026-09-30T14:30:00Z",
                  alumnoId: "alumno-456",
                  cursoId: 42,
                  notaFinal: 8.0,
                  estado: "APROBADO",
                  fechaResultado: "2026-09-30",
                  enlace: "/alumnos/cursos/42",
                },
                null,
                2,
              ),
            },
          },
        },
      ],
    },
    { name: "Ingesta de eventos (los 9 módulos)", item: eventFolders },
  ],
};

// `demoPassword` no se versiona con valor: se completa en Postman con la contraseña de demo
// del README.
(collection.variable as Array<{ key: string; value: string }>).push({ key: "demoPassword", value: "" });

const outDir = path.join(__dirname, "..", "..", "docs", "postman");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "UADEnet-Analitica.postman_collection.json"), JSON.stringify(collection, null, 2) + "\n");
console.log("Colección generada en docs/postman/.");
