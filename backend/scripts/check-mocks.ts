// Verifica backend/mocks/ (docs/INTEGRACION.md, 5.3): que cada archivo tenga el shape de la spec y que los ids
// referenciados existan (entre mocks y contra los eventos de demo de demo/dataset.ts). Sale con código 1 si algo falla.
//   npm run mocks:check
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildDemoDataset } from "../demo/dataset";
import { UNKNOWN_LOCATION_ID } from "../demo/ids";
import { validateEnvelope } from "../src/domain/services/event-envelope-validator.service";

const MOCKS_DIR = path.resolve(__dirname, "..", process.env.MOCKS_DIR?.trim() || "mocks");
const errors: string[] = [];
let checked = 0;

const fail = (file: string, message: string) => errors.push(`${file}: ${message}`);

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY = /^\d+\.\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function read(relativePath: string): unknown {
  const file = path.join(MOCKS_DIR, relativePath);
  if (!existsSync(file)) {
    fail(relativePath, "no existe");
    return undefined;
  }
  checked += 1;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (isObj(parsed) && "__mockStatus" in parsed) {
      fail(relativePath, "es una falla simulada (__mockStatus): el demo no debería dejarla activa");
      return undefined;
    }
    return parsed;
  } catch (error) {
    fail(relativePath, `JSON inválido (${(error as Error).message})`);
    return undefined;
  }
}

function list(relativePath: string): string[] {
  const dir = path.join(MOCKS_DIR, path.dirname(relativePath));
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)) : [];
}

// Chequea que `item` tenga los campos con el tipo pedido; "?" al final = opcional.
function shape(file: string, where: string, item: unknown, spec: Record<string, string>): item is Obj {
  if (!isObj(item)) {
    fail(file, `${where} debe ser un objeto`);
    return false;
  }
  let ok = true;
  for (const [key, kind] of Object.entries(spec)) {
    const optional = kind.endsWith("?");
    const type = optional ? kind.slice(0, -1) : kind;
    const value = item[key];
    if (value === undefined || value === null) {
      if (!optional) {
        fail(file, `${where}.${key} es obligatorio`);
        ok = false;
      }
      continue;
    }
    const valid =
      type === "uuid" ? typeof value === "string" && UUID.test(value)
      : type === "money" ? typeof value === "string" && MONEY.test(value)
      : type === "date" ? typeof value === "string" && DATE.test(value)
      : type === "int" ? Number.isInteger(value)
      : type === "array" ? Array.isArray(value)
      : type === "object" ? isObj(value)
      : typeof value === type;
    if (!valid) {
      fail(file, `${where}.${key} debe ser ${type} (vino ${JSON.stringify(value)})`);
      ok = false;
    }
  }
  return ok;
}

function array(file: string, content: unknown): Obj[] {
  if (!Array.isArray(content)) {
    if (content !== undefined) fail(file, "debe ser una lista");
    return [];
  }
  return content.filter((item): item is Obj => isObj(item) || (fail(file, "todos los elementos deben ser objetos"), false));
}

// ---------------------------------------------------------------------------------------------
// backoffice
// ---------------------------------------------------------------------------------------------

const siteIds = new Set<string>();
{
  const file = "backoffice/sites.json";
  const content = read(file);
  if (content !== undefined) {
    if (!isObj(content) || !Array.isArray(content.items)) fail(file, 'debe ser { "items": [...], "nextCursor": null }');
    else {
      content.items.forEach((site, index) => {
        if (shape(file, `items[${index}]`, site, { siteId: "uuid", code: "string", name: "string", status: "string", timezone: "string?" })) {
          if (!["ACTIVE", "INACTIVE"].includes(String(site.status))) fail(file, `items[${index}].status inválido (${site.status})`);
          siteIds.add(String(site.siteId));
        }
      });
    }
  }
}

const userIds = new Set(list("backoffice/users/x.json"));
for (const id of userIds) {
  const file = `backoffice/users/${id}.json`;
  const user = read(file);
  if (shape(file, "ficha", user, { userId: "uuid", firstName: "string", lastName: "string", roles: "array", status: "string", siteId: "uuid?" })) {
    if (user.userId !== id) fail(file, `userId (${user.userId}) no coincide con el nombre del archivo`);
    if (user.siteId && !siteIds.has(String(user.siteId))) fail(file, `siteId ${user.siteId} no existe en backoffice/sites.json`);
  }
}

// ---------------------------------------------------------------------------------------------
// core
// ---------------------------------------------------------------------------------------------

{
  const file = "core/users.json";
  array(file, read(file)).forEach((user, index) => {
    if (shape(file, `[${index}]`, user, { id: "uuid", email: "string", password: "string", roles: "array", permissions: "array", careerIds: "array", status: "string" })) {
      if (!String(user.email).endsWith("@uade.edu.ar")) fail(file, `[${index}].email debe ser @uade.edu.ar`);
    }
  });
}

for (const month of list("core/wallets-aggregates/x.json").filter((name) => /^\d{4}-\d{2}$/.test(name))) {
  const file = `core/wallets-aggregates/${month}.json`;
  const content = read(file);
  if (!shape(file, "body", content, { range: "object", currency: "string", outstandingBalance: "money", walletCount: "int", groups: "array" })) continue;
  const range = content.range as Obj;
  if (!DATE.test(String(range.from)) || !DATE.test(String(range.to))) fail(file, "range.from y range.to deben ser AAAA-MM-DD");
  if (String(range.from).slice(0, 7) !== month) fail(file, `range.from (${range.from}) no es del mes ${month}`);
  (content.groups as unknown[]).forEach((group, index) => {
    if (shape(file, `groups[${index}]`, group, { key: "string", type: "string", count: "int", total: "money" })) {
      if (!["CREDIT", "DEBIT", "REVERSAL"].includes(String(group.type))) fail(file, `groups[${index}].type inválido (${group.type})`);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// academic
// ---------------------------------------------------------------------------------------------

const periodIds = new Set<number>();
const periodById = new Map<number, Obj>();
array("academic/periodos.json", read("academic/periodos.json")).forEach((period, index) => {
  const file = "academic/periodos.json";
  if (shape(file, `[${index}]`, period, { id: "int", anio: "int", numero: "int", fechaInicio: "date", fechaFin: "date" })) {
    periodIds.add(Number(period.id));
    periodById.set(Number(period.id), period);
  }
});

const academicSites = new Map<number, string>();
array("academic/sedes.json", read("academic/sedes.json")).forEach((site, index) => {
  const file = "academic/sedes.json";
  if (shape(file, `[${index}]`, site, { id: "int", backofficeSiteId: "uuid", nombre: "string" })) {
    academicSites.set(Number(site.id), String(site.backofficeSiteId));
    if (!siteIds.has(String(site.backofficeSiteId))) fail(file, `[${index}].backofficeSiteId ${site.backofficeSiteId} no existe en backoffice/sites.json`);
  }
});

const careerIds = new Set<number>();
array("academic/carreras.json", read("academic/carreras.json")).forEach((career, index) => {
  if (shape("academic/carreras.json", `[${index}]`, career, { id: "int", codigo: "string", nombre: "string", facultad: "string" })) careerIds.add(Number(career.id));
});

const planIds = new Set<number>();
for (const id of list("academic/planes/x.json")) {
  const file = `academic/planes/${id}.json`;
  if (!careerIds.has(Number(id))) fail(file, `la carrera ${id} no existe en carreras.json`);
  array(file, read(file)).forEach((plan, index) => {
    if (shape(file, `[${index}]`, plan, { id: "int", codigo: "string", nombre: "string", estado: "string", carreraId: "int" })) {
      planIds.add(Number(plan.id));
      if (String(plan.carreraId) !== id) fail(file, `[${index}].carreraId (${plan.carreraId}) no coincide con el archivo`);
      if (!["ACTIVO", "PLANIFICADO"].includes(String(plan.estado))) fail(file, `[${index}].estado inválido (${plan.estado})`);
    }
  });
}

const subjectById = new Map<number, Obj>();
for (const id of list("academic/asignaturas/x.json")) {
  const file = `academic/asignaturas/${id}.json`;
  if (!planIds.has(Number(id))) fail(file, `el plan ${id} no existe en ningún planes/<carreraId>.json`);
  array(file, read(file)).forEach((subject, index) => {
    if (shape(file, `[${index}]`, subject, { id: "int", codigo: "string", nombre: "string", planId: "int" })) {
      if (String(subject.planId) !== id) fail(file, `[${index}].planId (${subject.planId}) no coincide con el archivo`);
      subjectById.set(Number(subject.id), subject);
    }
  });
}

interface CourseRef {
  id: number;
  periodId: number;
  asignaturaId: number;
  sedeId: number;
}
const courseById = new Map<number, CourseRef>();
const COURSE_STATES = ["PLANIFICADO", "EN_CURSO", "FINALIZADO", "CANCELADO"];
const teacherRefs: [file: string, id: string][] = [];

for (const id of list("academic/cursos/x.json")) {
  const file = `academic/cursos/${id}.json`;
  if (!periodIds.has(Number(id))) fail(file, `el período ${id} no existe en periodos.json`);
  array(file, read(file)).forEach((course, index) => {
    const where = `[${index}]`;
    if (!shape(file, where, course, { id: "int", codigo: "string", asignaturaId: "int", periodoId: "int", sedeId: "int", estado: "string", inscriptosActivos: "int", cupoMaximo: "int?", docentes: "array?" })) return;
    courseById.set(Number(course.id), { id: Number(course.id), periodId: Number(course.periodoId), asignaturaId: Number(course.asignaturaId), sedeId: Number(course.sedeId) });
    if (String(course.periodoId) !== id) fail(file, `${where}.periodoId (${course.periodoId}) no coincide con el archivo`);
    if (!subjectById.has(Number(course.asignaturaId))) fail(file, `${where}.asignaturaId ${course.asignaturaId} no existe en academic/asignaturas`);
    if (!academicSites.has(Number(course.sedeId))) fail(file, `${where}.sedeId ${course.sedeId} no existe en academic/sedes.json`);
    if (!COURSE_STATES.includes(String(course.estado))) fail(file, `${where}.estado inválido (${course.estado})`);
    for (const docente of (course.docentes as Obj[] | undefined) ?? []) {
      if (shape(file, `${where}.docentes[]`, docente, { docenteId: "uuid", rol: "string" })) teacherRefs.push([file, String(docente.docenteId)]);
    }
  });
}

for (const id of list("academic/curso-detalle/x.json")) {
  const file = `academic/curso-detalle/${id}.json`;
  const detail = read(file);
  if (!shape(file, "body", detail, { curso: "object", docentes: "array" })) continue;
  const curso = detail.curso as Obj;
  if (shape(file, "curso", curso, { id: "int", asignatura: "object", periodo: "object", sedeId: "int", estado: "string" })) {
    if (String(curso.id) !== id) fail(file, `curso.id (${curso.id}) no coincide con el archivo`);
    const listed = courseById.get(Number(curso.id));
    if (!listed) fail(file, `el curso ${id} no figura en ningún academic/cursos/<periodoId>.json`);
    else {
      if (Number((curso.periodo as Obj).id) !== listed.periodId) fail(file, "curso.periodo.id no coincide con el listado de cursos");
      if (Number((curso.asignatura as Obj).id) !== listed.asignaturaId) fail(file, "curso.asignatura.id no coincide con el listado de cursos");
      if (Number(curso.sedeId) !== listed.sedeId) fail(file, "curso.sedeId no coincide con el listado de cursos");
    }
  }
  for (const docente of detail.docentes as Obj[]) {
    if (shape(file, "docentes[]", docente, { docenteId: "uuid", rol: "string" })) {
      teacherRefs.push([file, String(docente.docenteId)]);
      if (!["TITULAR", "ADJUNTO", "AUXILIAR"].includes(String(docente.rol))) fail(file, `docentes[].rol inválido (${docente.rol})`);
    }
  }
}

for (const [file, teacherId] of teacherRefs) {
  if (!userIds.has(teacherId)) fail(file, `el docente ${teacherId} no tiene ficha en backoffice/users/`);
}

// ---------------------------------------------------------------------------------------------
// Eventos de demo contra los mocks
// ---------------------------------------------------------------------------------------------

const { events } = buildDemoDataset();
const upsertedLocations = new Set(events.filter((event) => event.eventType === "backoffice.location.upserted.v1").map((event) => String(event.data.locationId)));
const eventProblems = new Map<string, number>();
const note = (message: string) => eventProblems.set(message, (eventProblems.get(message) ?? 0) + 1);
const checkedKeys = new Set<string>();

for (const event of events) {
  const validation = validateEnvelope(event);
  if ("problems" in validation) note(`${event.eventType}: no pasa la validación del contrato (${validation.problems[0]})`);

  const data = event.data;
  const siteId = typeof data.siteId === "string" ? data.siteId : null;
  if (siteId && !siteIds.has(siteId)) note(`${event.eventType}: siteId ${siteId} no existe en backoffice/sites.json`);

  if (event.eventType === "academic.course-result.published.v1") {
    const course = courseById.get(Number(data.courseId));
    const key = `${data.courseId}`;
    if (checkedKeys.has(key)) continue;
    checkedKeys.add(key);
    if (!course) note(`course-result: courseId ${data.courseId} no existe en academic/cursos`);
    else {
      if (String(course.periodId) !== data.periodId) note(`course-result: periodId ${data.periodId} no es el del curso ${data.courseId} (${course.periodId})`);
      if (String(course.asignaturaId) !== data.subjectId) note(`course-result: subjectId ${data.subjectId} no es el del curso ${data.courseId} (${course.asignaturaId})`);
      if (academicSites.get(course.sedeId) !== siteId) note(`course-result: siteId del curso ${data.courseId} no coincide con la sede del curso en academic/sedes.json`);
    }
    if (!periodIds.has(Number(data.periodId))) note(`course-result: periodId ${data.periodId} no existe en academic/periodos.json`);
    if (!subjectById.has(Number(data.subjectId))) note(`course-result: subjectId ${data.subjectId} no existe en academic/asignaturas`);
  }

  // La locación sin location.upserted es el caso borde "evento sin sede" y es la única permitida.
  if (event.eventType === "events.event.created.v1" && data.locationId !== UNKNOWN_LOCATION_ID && !upsertedLocations.has(String(data.locationId))) {
    note(`events.event.created: locationId ${data.locationId} no tiene backoffice.location.upserted.v1`);
  }
}
for (const [message, count] of eventProblems) errors.push(`eventos de demo: ${message}${count > 1 ? ` (${count} veces)` : ""}`);

// ---------------------------------------------------------------------------------------------

if (errors.length > 0) {
  console.error(`mocks:check falló (${errors.length} problemas en ${checked} archivos):`);
  for (const message of errors.slice(0, 60)) console.error(`  - ${message}`);
  if (errors.length > 60) console.error(`  ... y ${errors.length - 60} más`);
  process.exit(1);
}
console.log(`mocks:check OK: ${checked} archivos con el shape de la spec y ${events.length} eventos de demo con ids que existen en los mocks.`);
