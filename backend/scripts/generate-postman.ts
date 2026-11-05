// Genera la colección de Postman en docs/postman/ (docs/INTEGRACION.md, Fase D). La carpeta "Cola (simulación)" tiene una
// request por eventType persistido, con el envelope v1 y un `data` coherente con demo/ids.ts (sedes, cursos, productos...)
// para que impacte en los tableros. Cada ejemplo se valida contra el contrato antes de escribir la colección.
// Uso: npm run docs:postman
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { buildDemoDataset } from "../demo/dataset";
import { CORE_USERS, DEMO_PASSWORD, LOCATIONS, PRODUCTS, SITE_BY_KEY, TEACHERS } from "../demo/ids";
import { EVENT_CATALOG, EventCatalogEntry } from "../src/domain/entities/event-catalog";
import { FieldSpec } from "../src/domain/entities/event-schema.entity";
import { validateEnvelope } from "../src/domain/services/event-envelope-validator.service";

// ---------------------------------------------------------------------------------------------
// Datos de ejemplo coherentes con el demo
// ---------------------------------------------------------------------------------------------

const { courses } = buildDemoDataset();
// Un curso del período en curso que ya publicó resultados y trae docentes: el resultado impacta en el tablero académico.
const course = courses.find((candidate) => candidate.period.label === "2026-2C" && candidate.hasResults && candidate.listsTeachers)!;
const monserrat = SITE_BY_KEY.monserrat;
const workshopRoom = LOCATIONS.find((location) => location.name === "Sala de Talleres")!;
const magna = LOCATIONS[0];
const hoodie = PRODUCTS.find((product) => product.name === "Buzo UADE")!;
const notebook = PRODUCTS.find((product) => product.name === "Cuaderno A4 rayado")!;

// Variables de Postman que usan los ejemplos. Las fija el script de pre-request de la colección o la request que las crea.
const GUID = "{{$guid}}";
const NOW = "{{$isoTimestamp}}";

// `data` por eventType persistido. Los tipos sin entrada usan FieldSpec.example del catálogo.
const SAMPLES: Record<string, Record<string, unknown>> = {
  "academic.course-result.published.v1": {
    studentId: "{{studentId}}",
    courseId: String(course.id),
    subjectId: String(course.asignaturaId),
    periodId: String(course.period.id),
    siteId: course.site.id,
    finalGrade: 8,
    status: "APROBADO",
    resultDate: "{{today}}",
  },
  "events.event.created.v1": {
    eventId: "{{eventUuid}}",
    title: "Taller de oratoria (Postman)",
    locationId: workshopRoom.id,
    startAt: "{{startAt}}",
    endAt: "{{endAt}}",
    capacity: 40,
    price: "0.00",
    currency: "ARS",
    category: "Taller",
  },
  "events.registration.completed.v1": { eventId: "{{eventUuid}}", registrationId: GUID, userId: GUID, amount: "0.00", currency: "ARS" },
  "events.attendance.recorded.v1": { eventId: "{{eventUuid}}", userId: GUID, present: true, checkedAt: NOW },
  "backoffice.location.upserted.v1": {
    locationId: magna.id,
    siteId: SITE_BY_KEY[magna.siteKey].id,
    name: "Aula Magna (renovada)",
    capacity: magna.capacity,
    status: "ACTIVE",
    type: magna.type,
  },
  "dining.reservation.created.v1": { reservationId: "{{reservationId}}", userId: GUID, siteId: monserrat.id, slotAt: "{{slotAt}}", amount: "2800.00", currency: "ARS" },
  "dining.reservation.cancelled.v1": { reservationId: "{{reservationId}}", userId: GUID, slotAt: "{{slotAt}}", cancelledAt: NOW },
  "dining.attendance.recorded.v1": { reservationId: "{{reservationId}}", userId: GUID, attendedAt: NOW },
  "store.purchase.completed.v1": {
    purchaseId: GUID,
    userId: GUID,
    total: "49000.00",
    currency: "ARS",
    siteId: monserrat.id,
    items: [
      { productId: hoodie.id, productName: hoodie.name, category: hoodie.category, quantity: 1, unitPrice: "46000.00", subtotal: "46000.00" },
      { productId: notebook.id, productName: notebook.name, category: notebook.category, quantity: 1, unitPrice: "3000.00", subtotal: "3000.00" },
    ],
  },
  "backoffice.user.upserted.v1": { userId: TEACHERS[0].id },
  "backoffice.user.disabled.v1": { userId: TEACHERS[1].id },
  "library.penalty.applied.v1": { penaltyId: GUID, userId: GUID, amount: "1500.00", currency: "ARS" },
  "core.wallet.transaction-posted.v1": { transactionId: GUID, concept: "TOP_UP", amount: "20000.00" },
};

function exampleValue(field: FieldSpec): unknown {
  if (field.example !== undefined) return field.example;
  switch (field.type) {
    case "string": return field.oneOf ? field.oneOf[0] : `${field.name}-ejemplo`;
    case "number": case "integer": return 1;
    case "boolean": return true;
    case "date": return "2026-11-04";
    case "datetime": return "2026-11-04T15:00:00.000Z";
    case "money": return "1000.00";
    case "uuid": return GUID;
    case "object": return exampleObject(field.fields ?? []);
    case "array": return [exampleObject(field.fields ?? [])];
  }
}

function exampleObject(fields: readonly FieldSpec[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => field.required).map((field) => [field.name, exampleValue(field)]));
}

const dataFor = (entry: EventCatalogEntry): Record<string, unknown> => SAMPLES[entry.eventType] ?? exampleObject(entry.fields);

// ---------------------------------------------------------------------------------------------
// Validación de los ejemplos contra el contrato
// ---------------------------------------------------------------------------------------------

const VARIABLE_DEFAULTS: Record<string, string> = {
  studentId: randomUUID(), eventUuid: randomUUID(), reservationId: randomUUID(),
  today: "2026-11-05", startAt: "2026-11-05T01:00:00.000Z", endAt: "2026-11-05T03:00:00.000Z", slotAt: "2026-11-05T07:00:00.000Z",
};

function resolve<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value)
      .replaceAll("{{$guid}}", () => randomUUID())
      .replaceAll("{{$isoTimestamp}}", new Date().toISOString())
      .replace(/\{\{(\w+)\}\}/g, (_match, name: string) => VARIABLE_DEFAULTS[name] ?? `{{${name}}}`),
  );
}

function assertValid(label: string, envelope: unknown): void {
  const result = validateEnvelope(resolve(envelope));
  if ("problems" in result) throw new Error(`El ejemplo de Postman "${label}" no cumple el contrato: ${result.problems.join(" | ")}`);
}

// ---------------------------------------------------------------------------------------------
// Armado de la colección
// ---------------------------------------------------------------------------------------------

const jsonHeader = [{ key: "Content-Type", value: "application/json" }];
const bearer = { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] };
const noAuth = { type: "noauth" };
const script = (listen: "test" | "prerequest", lines: string[]) => ({ listen, script: { type: "text/javascript", exec: lines } });

function url(pathname: string, query: Record<string, string> = {}) {
  const entries = Object.entries(query);
  const queryString = entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  return {
    raw: `{{baseUrl}}${pathname}${queryString ? `?${queryString}` : ""}`,
    host: ["{{baseUrl}}"],
    path: pathname.split("/").filter(Boolean),
    ...(entries.length > 0 ? { query: entries.map(([key, value]) => ({ key, value })) } : {}),
  };
}

function envelope(entry: Pick<EventCatalogEntry, "eventType" | "source">, data: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    specVersion: "1.0",
    eventId: GUID,
    eventType: entry.eventType,
    source: entry.source,
    occurredAt: NOW,
    correlationId: GUID,
    causationId: null,
    actor: { type: "service", id: `${entry.source}-service` },
    data,
    ...overrides,
  };
}

const postBody = (body: unknown) => ({ mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } });

function queueRequest(name: string, body: unknown, expected: { status: number; outcome?: string }, preRequest: string[] = [], description?: string) {
  const tests = [
    `pm.test('HTTP ${expected.status}', () => pm.response.to.have.status(${expected.status}));`,
    ...(expected.outcome ? [`pm.test('status ${expected.outcome}', () => pm.expect(pm.response.json().status).to.eql('${expected.outcome}'));`] : []),
  ];
  return {
    name,
    ...(description ? { description } : {}),
    event: [...(preRequest.length > 0 ? [script("prerequest", preRequest)] : []), script("test", tests)],
    request: { method: "POST", auth: noAuth, header: jsonHeader, url: url("/api/analytics/events"), body: postBody(body) },
  };
}

// Qué variable crea cada request (las siguientes del mismo flujo la reutilizan).
const PRE_REQUEST: Record<string, string[]> = {
  "academic.course-result.published.v1": ["pm.collectionVariables.set('studentId', pm.variables.replaceIn('{{$guid}}'));"],
  "events.event.created.v1": ["pm.collectionVariables.set('eventUuid', pm.variables.replaceIn('{{$guid}}'));"],
  "dining.reservation.created.v1": ["pm.collectionVariables.set('reservationId', pm.variables.replaceIn('{{$guid}}'));"],
};

const NOTES: Record<string, string> = {
  "academic.course-result.published.v1": `Resultado de un alumno nuevo en el curso ${course.codigo} (${course.subject.name}, ${course.site.name}, 2026-2C). Impacta en el tablero académico del cuatrimestre en curso. Guarda el alumno en {{studentId}} para la corrección de la carpeta de casos borde.`,
  "events.event.created.v1": "Crea un evento ya terminado (hace 1 hora) en la Sala de Talleres de Monserrat: cuenta como realizado en noviembre. Guarda su id en {{eventUuid}}; correr antes las inscripciones y asistencias que lo usan.",
  "dining.reservation.created.v1": "Reserva en Monserrat. Guarda el id en {{reservationId}} para cancelarla o registrar la asistencia.",
  "store.purchase.completed.v1": "Compra de un buzo y un cuaderno en Monserrat. `userId` se descarta al guardar (redact).",
};

const persisted = EVENT_CATALOG.filter((entry) => entry.handling === "persist");
const queueItems = persisted.map((entry) => {
  const body = envelope(entry, dataFor(entry));
  assertValid(entry.eventType, body);
  return queueRequest(entry.eventType, body, { status: 201, outcome: "STORED" }, PRE_REQUEST[entry.eventType], NOTES[entry.eventType]);
});

const discarded = ["backoffice.user.upserted.v1", "library.penalty.applied.v1", "core.wallet.transaction-posted.v1"].map((eventType) => {
  const entry = EVENT_CATALOG.find((candidate) => candidate.eventType === eventType)!;
  const body = envelope(entry, dataFor(entry));
  assertValid(eventType, body);
  return queueRequest(eventType, body, { status: 202, outcome: "IGNORED" }, [], "Se recibe, se confirma y no se guarda (sólo actualiza «Fuentes de datos»).");
});
{
  const body = envelope({ eventType: "library.reserva.creada.v1", source: "library" }, { cualquierCosa: true });
  assertValid("tipo fuera del catálogo", body);
  discarded.push(queueRequest("Tipo fuera del catálogo (library.reserva.creada.v1)", body, { status: 202, outcome: "IGNORED" }));
}

const resultEntry = EVENT_CATALOG.find((entry) => entry.eventType === "academic.course-result.published.v1")!;
const locationEntry = EVENT_CATALOG.find((entry) => entry.eventType === "backoffice.location.upserted.v1")!;
const storeEntry = EVENT_CATALOG.find((entry) => entry.eventType === "store.purchase.completed.v1")!;

const DUPLICATE_ID = "f0f0f0f0-0000-4000-8000-000000000001";
const duplicateBody = envelope(locationEntry, dataFor(locationEntry), { eventId: DUPLICATE_ID });
assertValid("duplicado", duplicateBody);

const edgeItems = [
  queueRequest(
    "Corrección de un resultado (mismo alumno y curso, nota nueva)",
    envelope(resultEntry, { ...dataFor(resultEntry), finalGrade: 3, status: "DESAPROBADO" }),
    { status: 201, outcome: "STORED" },
    [],
    "Correr después del resultado de la carpeta de la cola: republica el resultado con eventId nuevo y gana el último por (alumno, curso). La tasa de aprobación baja.",
  ),
  queueRequest("Duplicado · 1/2 primer envío (200 o 201)", duplicateBody, { status: 201 }, [], "Acepta 201 la primera vez de todas; después ya es duplicado."),
  queueRequest("Duplicado · 2/2 mismo eventId (200 DUPLICATE)", duplicateBody, { status: 200, outcome: "DUPLICATE" }, [], "Mismo eventId: no inserta ni pisa."),
];
// El primer envío puede dar 200 si ya se corrió antes: se acepta cualquiera de los dos.
edgeItems[1].event[edgeItems[1].event.length - 1] = script("test", ["pm.test('HTTP 200 o 201', () => pm.expect([200, 201]).to.include(pm.response.code));"]);

const errorRequest = (name: string, mutate: (body: Record<string, unknown>) => Record<string, unknown>) =>
  queueRequest(name, mutate(envelope(storeEntry, dataFor(storeEntry))), { status: 400 });

const errors = [
  errorRequest("400 · falta eventId", ({ eventId: _omit, ...rest }) => rest),
  errorRequest("400 · eventType no coincide con source", (body) => ({ ...body, source: "dining" })),
  errorRequest("400 · occurredAt sin zona horaria (Z)", (body) => ({ ...body, occurredAt: "2026-11-04T12:00:00" })),
  errorRequest("400 · data inválido (total como número, no texto)", (body) => ({ ...body, data: { ...(body.data as object), total: 49000 } })),
  queueRequest(
    "400 · data inválido (studentId no es UUID)",
    envelope(resultEntry, { ...dataFor(resultEntry), studentId: "alumno-123" }),
    { status: 400 },
  ),
];

const login = (name: string, email: string, expected: number) => ({
  name,
  event: [
    script("test", [
      `pm.test('HTTP ${expected}', () => pm.response.to.have.status(${expected}));`,
      ...(expected === 200 ? ["pm.collectionVariables.set('token', pm.response.json().token);"] : []),
    ]),
  ],
  request: { method: "POST", auth: noAuth, header: jsonHeader, url: url("/api/auth/login"), body: postBody({ email: `{{${email}}}`, password: "{{demoPassword}}" }) },
});

const get = (name: string, pathname: string, query: Record<string, string> = {}, options: { auth?: boolean; description?: string } = {}) => ({
  name,
  ...(options.description ? { description: options.description } : {}),
  event: [script("test", ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"])],
  request: { method: "GET", auth: options.auth === false ? noAuth : bearer, header: [], url: url(pathname, query) },
});

const emailVariable = (key: string, find: (user: (typeof CORE_USERS)[number]) => boolean) => ({ key, value: CORE_USERS.find(find)!.email });

const collection = {
  info: {
    name: "UADEnet · Analítica Institucional (Módulo 7)",
    description:
      "Simula la cola de CORE y consulta los tableros (docs/INTEGRACION.md). 1) Auth: iniciá sesión con «Dirección General» (ve los tres tableros) o con el rol que quieras probar; el token se guarda solo. 2) Cola (simulación): cada request es un envelope v1 de un eventType persistido, con `eventId` y `occurredAt` nuevos, y datos coherentes con el demo (backend/demo/ids.ts). 3) Tableros: mirá el impacto. Requiere el backend con EVENTS_HTTP_INGEST=true y la base con el demo (`npm run db:demo`). Generada con `npm run docs:postman`: no editar a mano.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: bearer,
  event: [
    script("prerequest", [
      "// Fechas relativas a ahora para los envelopes de la carpeta «Cola».",
      "const now = new Date();",
      "pm.collectionVariables.set('today', now.toISOString().slice(0, 10));",
      "pm.collectionVariables.set('startAt', new Date(now.getTime() - 3 * 3600e3).toISOString());",
      "pm.collectionVariables.set('endAt', new Date(now.getTime() - 1 * 3600e3).toISOString());",
      "pm.collectionVariables.set('slotAt', new Date(now.getTime() + 3 * 3600e3).toISOString());",
    ]),
  ],
  variable: [
    { key: "baseUrl", value: "http://localhost:3000" },
    { key: "token", value: "" },
    // Credenciales de demo del login mock (backend/mocks/core/users.json): no son credenciales reales de CORE.
    { key: "demoPassword", value: DEMO_PASSWORD },
    emailVariable("emailAcademica", (user) => user.roles.includes("ACADEMIC_ADMIN") && user.status === "ACTIVE"),
    emailVariable("emailFinanciera", (user) => user.roles.includes("FINANCE_ADMIN")),
    emailVariable("emailGeneral", (user) => user.roles.includes("ADMIN")),
    emailVariable("emailAlumno", (user) => user.roles.includes("STUDENT")),
    emailVariable("emailSuspendido", (user) => user.status === "SUSPENDED"),
    // Valores iniciales de los ids que encadenan requests de la cola (se pisan al correr la request que los crea).
    { key: "studentId", value: randomUUID() },
    { key: "eventUuid", value: randomUUID() },
    { key: "reservationId", value: randomUUID() },
  ],
  item: [
    {
      name: "Auth (mock de CORE)",
      description: "Login por el proxy /api/auth. Con CORE_MOCK=true los usuarios salen de backend/mocks/core/users.json. El refresh usa la cookie que fija el login (Postman la guarda sola).",
      item: [
        login("Login · Dirección General (ve los tres tableros)", "emailGeneral", 200),
        login("Login · Dirección Académica (académico y eventos)", "emailAcademica", 200),
        login("Login · Dirección Financiera (financiero)", "emailFinanciera", 200),
        login("Login · Alumno (403 ANALYTICS_FORBIDDEN)", "emailAlumno", 403),
        login("Login · Usuario suspendido (403 AUTH_IDENTITY_SUSPENDED)", "emailSuspendido", 403),
        {
          name: "Refresh (cookie del login)",
          event: [script("test", ["pm.test('HTTP 200', () => pm.response.to.have.status(200));", "pm.collectionVariables.set('token', pm.response.json().token);"])],
          request: { method: "POST", auth: noAuth, header: jsonHeader, url: url("/api/auth/refresh") },
        },
        get("Me (usuario actual)", "/api/auth/me"),
        {
          name: "Logout",
          event: [script("test", ["pm.test('HTTP 204 o 200', () => pm.expect([200, 204]).to.include(pm.response.code));"])],
          request: { method: "POST", auth: noAuth, header: jsonHeader, url: url("/api/auth/logout") },
        },
      ],
    },
    {
      name: "Cola (simulación)",
      description: "Lo que CORE entregaría por la cola analytics.all-events.v1, mandado por POST /api/analytics/events (EVENTS_HTTP_INGEST=true). Sin autenticación: igual que la cola.",
      item: [
        { name: "Eventos que se guardan (uno por eventType)", item: queueItems },
        { name: "Se reciben y se descartan (202 IGNORED)", item: discarded },
        { name: "Casos borde (corrección y duplicado)", item: edgeItems },
        { name: "Errores de contrato (400)", item: errors },
      ],
    },
    {
      name: "Tableros (requieren token)",
      description: "Después de enviar eventos, volvé a pedir el tablero. El académico y el de eventos piden rol académico; el financiero, rol financiero (Dirección General sirve para todos).",
      item: [
        get("Filtros (sedes, cuatrimestres, meses, facultades)", "/api/analytics/filters"),
        get("Tablero académico (defaults: todas las sedes, 2026-2C)", "/api/analytics/dashboard/academic"),
        get("Tablero académico · Sede Monserrat · 2026-1C", "/api/analytics/dashboard/academic", { sedeId: monserrat.id, cuatrimestre: "2026-1C" }),
        get("Tablero financiero (default: mes en curso, parcial)", "/api/analytics/dashboard/financial"),
        get("Tablero financiero · Oct 2026", "/api/analytics/dashboard/financial", { periodo: "Oct 2026" }),
        get("Estadísticas de eventos (default: mes en curso)", "/api/analytics/events/stats"),
        get("Estadísticas de eventos · Oct 2026 · Sede Monserrat", "/api/analytics/events/stats", { periodo: "Oct 2026", sedeId: monserrat.id }),
      ],
    },
    {
      name: "Públicos y diagnóstico",
      item: [
        get("Fuentes de datos (último evento por módulo)", "/api/analytics/sources", {}, { auth: false }),
        get("Eventos guardados (últimos 5)", "/api/analytics/events", { limit: "5" }, { auth: false, description: "Listado de depuración: sólo con EVENTS_HTTP_INGEST=true." }),
        get("Health · ready", "/health/ready", {}, { auth: false }),
      ],
    },
  ],
};

const outDir = path.join(__dirname, "..", "..", "docs", "postman");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "UADEnet-Analitica.postman_collection.json"), JSON.stringify(collection, null, 2) + "\n");
console.log(`Colección generada en docs/postman/: ${queueItems.length} eventType persistidos, ${discarded.length} descartados, ${edgeItems.length} casos borde, ${errors.length} errores.`);
