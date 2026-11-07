// Genera TODOS los archivos de backend/mocks/ desde demo/ids.ts y el modelo de demo/dataset.ts (los mismos ids, nombres,
// cursos y montos que siembra prisma/demo-seed.ts). docs/INTEGRACION.md, 5.3.
//   npm run mocks:generate                  escribe los archivos; si alguno ya existe y difiere de lo que generaría (edición a
//                                           mano o mock viejo), no escribe NADA y avisa: hay que pasar --force
//   npm run mocks:generate -- --force       sobrescribe los archivos que difieren
//   npm run mocks:generate -- --force --prune   además borra los archivos de las carpetas generadas que ya no corresponden
//   npm run mocks:generate -- --dry-run     sólo informa qué haría
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { argYm, buildDemoDataset, createRng, SPANS } from "../demo/dataset";
import {
  CAREERS,
  CORE_USERS,
  DEMO_NOW,
  DEMO_PASSWORD,
  PERIODS,
  PLANS,
  SITES,
  TEACHERS,
  subjectsOfPlan,
} from "../demo/ids";

const MOCKS_DIR = path.resolve(__dirname, "..", "mocks");
const force = process.argv.includes("--force");
const prune = process.argv.includes("--prune");
const dryRun = process.argv.includes("--dry-run");

type Files = Map<string, unknown>;
const files: Files = new Map();
const put = (relativePath: string, content: unknown) => files.set(relativePath, content);

const money = (value: number) => value.toFixed(2);

// ---------------------------------------------------------------------------------------------
// core/
// ---------------------------------------------------------------------------------------------

put(
  "core/users.json",
  CORE_USERS.map((user) => ({
    id: user.id,
    email: user.email,
    password: DEMO_PASSWORD,
    roles: user.roles,
    permissions: user.permissions,
    careerIds: user.careerIds,
    status: user.status,
  })),
);

const dataset = buildDemoDataset();

// Totales mensuales (hora de Argentina) que salen de los eventos de demo: así `aggregates` es coherente con tienda, comedor y eventos.
interface MonthTotals {
  store: { count: number; total: number };
  dining: { count: number; total: number };
  cancelled: { count: number; total: number };
  registrations: { count: number; total: number };
}
const empty = (): MonthTotals => ({ store: { count: 0, total: 0 }, dining: { count: 0, total: 0 }, cancelled: { count: 0, total: 0 }, registrations: { count: 0, total: 0 } });
const totalsByMonth = new Map<string, MonthTotals>();
const monthOf = (ym: string) => totalsByMonth.get(ym) ?? totalsByMonth.set(ym, empty()).get(ym)!;
const reservationAmount = new Map<string, number>();
const bump = (bucket: { count: number; total: number }, amount: number) => {
  bucket.count += 1;
  bucket.total += amount;
};

for (const event of dataset.events) {
  const ym = argYm(Date.parse(event.occurredAt));
  const data = event.data;
  if (event.eventType === "store.purchase.completed.v1") bump(monthOf(ym).store, Number(data.total));
  else if (event.eventType === "dining.reservation.created.v1") {
    bump(monthOf(ym).dining, Number(data.amount));
    reservationAmount.set(String(data.reservationId), Number(data.amount));
  } else if (event.eventType === "events.registration.completed.v1" && Number(data.amount) > 0) bump(monthOf(ym).registrations, Number(data.amount));
}
for (const event of dataset.events) {
  if (event.eventType === "dining.reservation.cancelled.v1") {
    bump(monthOf(argYm(Date.parse(event.occurredAt))).cancelled, reservationAmount.get(String(event.data.reservationId)) ?? 0);
  }
}

{
  const rng = createRng(20261109);
  const lastDay = (ym: string) => {
    const [year, month] = ym.split("-").map(Number);
    return `${ym}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  };
  const todayYm = argYm(DEMO_NOW);
  const todayDate = new Date(DEMO_NOW - 3 * 3_600_000).toISOString().slice(0, 10);
  let balance = 6_200_000;

  for (const span of SPANS) {
    const totals = monthOf(span.ym);
    const partial = span.ym === todayYm;
    const group = (key: string, type: string, total: number, count: number) => ({ key, type, count: Math.max(0, Math.round(count)), total: money(total) });
    const rounded = (value: number) => Math.round(value / 100) * 100;

    // Saldo vigente creciente (entre +3% y +6% por mes; el mes en curso sólo suma lo de los primeros días).
    balance = rounded(balance * (1 + (partial ? 0.012 : 0.03 + rng.next() * 0.03)));

    const serviceSpend = totals.store.total + totals.dining.total + totals.registrations.total;
    const topUp = rounded(serviceSpend * (1.1 + rng.next() * 0.08));
    const libraryFine = rounded(130_000 * span.infl * span.frac * (0.8 + rng.next() * 0.4));
    const refund = rounded(totals.cancelled.total + totals.store.total * 0.015);
    const scholarship = rounded(1_800_000 * 1.015 ** span.index);
    // El sueldo se liquida a fin de mes: en el mes en curso todavía no hay acreditaciones.
    const payroll = partial ? 0 : rounded(9_000_000 * 1.018 ** span.index);

    const groups = [
      group("TOP_UP", "CREDIT", topUp, topUp / 14_000),
      ...(payroll > 0 ? [group("PAYROLL", "CREDIT", payroll, payroll / 19_000)] : []),
      group("SCHOLARSHIP", "CREDIT", scholarship, scholarship / 12_500),
      group("STORE_PURCHASE", "DEBIT", totals.store.total, totals.store.count),
      group("DINING_RESERVATION", "DEBIT", totals.dining.total, totals.dining.count),
      group("LIBRARY_FINE", "DEBIT", libraryFine, libraryFine / 2_400),
      group("EVENT_REGISTRATION", "DEBIT", totals.registrations.total, totals.registrations.count),
      group("REFUND", "REVERSAL", refund, totals.cancelled.count + totals.store.count * 0.015),
      // Concepto que el tablero no usa (ni ingreso ni egreso): ajustes manuales.
      ...(span.index % 3 === 1 ? [group("ADJUSTMENT", "CREDIT", 45_000, 3)] : []),
    ];

    put(`core/wallets-aggregates/${span.ym}.json`, {
      range: { from: `${span.ym}-01`, to: partial ? todayDate : lastDay(span.ym) },
      currency: "ARS",
      outstandingBalance: money(balance),
      walletCount: 1480 + span.index * 45,
      groups,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// backoffice/
// ---------------------------------------------------------------------------------------------

put("backoffice/sites.json", {
  items: SITES.map((site) => ({
    siteId: site.id,
    code: site.code,
    name: site.name,
    address: site.address,
    city: site.city,
    province: site.province,
    country: "Argentina",
    timezone: "America/Argentina/Buenos_Aires",
    status: site.status,
    updatedAt: "2026-09-10T13:00:00.000Z",
  })),
  nextCursor: null,
});

for (const teacher of TEACHERS) {
  put(`backoffice/users/${teacher.id}.json`, {
    userId: teacher.id,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    roles: ["TEACHER"],
    status: "ACTIVE",
    siteId: SITES.find((site) => site.key === teacher.siteKey)!.id,
  });
}
// Fichas de los usuarios de CORE que entran a Analítica (el nombre se muestra en la barra superior).
for (const user of CORE_USERS.filter((candidate) => candidate.status === "ACTIVE" && !candidate.roles.includes("STUDENT"))) {
  put(`backoffice/users/${user.id}.json`, { userId: user.id, firstName: user.firstName, lastName: user.lastName, roles: user.roles, status: "ACTIVE" });
}

// ---------------------------------------------------------------------------------------------
// academic/
// ---------------------------------------------------------------------------------------------

put("academic/periodos.json", PERIODS.map(({ id, anio, numero, fechaInicio, fechaFin }) => ({ id, anio, numero, fechaInicio, fechaFin })));
put(
  "academic/sedes.json",
  SITES.filter((site) => site.academicId !== null).map((site) => ({ id: site.academicId, backofficeSiteId: site.id, nombre: site.name })),
);
put(
  "academic/carreras.json",
  CAREERS.map(({ id, codigo, nombre, facultad, duracion, titulo }) => ({ id, codigo, nombre, facultad, duracion, titulo, estado: "ACTIVA" })),
);

for (const career of CAREERS) {
  put(
    `academic/planes/${career.id}.json`,
    PLANS.filter((plan) => plan.carreraId === career.id).map((plan) => ({
      id: plan.id,
      codigo: plan.codigo,
      nombre: plan.nombre,
      vigenciaDesde: plan.vigenciaDesde,
      cantidadAsignaturas: subjectsOfPlan(plan.id).length,
      estado: plan.estado,
      carreraId: plan.carreraId,
    })),
  );
}

// El plan ISI-2027 (PLANIFICADO) no tiene archivo de asignaturas: el gateway devuelve [] (caso borde a propósito).
for (const plan of PLANS.filter((candidate) => candidate.estado === "ACTIVO")) {
  put(
    `academic/asignaturas/${plan.id}.json`,
    subjectsOfPlan(plan.id).map((subject) => ({
      id: subject.id,
      codigo: subject.code,
      nombre: subject.name,
      anio: subject.anio,
      creditos: 6,
      cargaHoraria: 96,
      estado: "ACTIVA",
      planId: plan.id,
    })),
  );
}

const teachersOf = (course: (typeof dataset.courses)[number]) => [
  { docenteId: course.teacher.id, rol: "TITULAR" },
  ...(course.auxiliar ? [{ docenteId: course.auxiliar.id, rol: "AUXILIAR" }] : []),
];

for (const period of PERIODS) {
  const courses = dataset.courses.filter((course) => course.period.id === period.id);
  put(
    `academic/cursos/${period.id}.json`,
    courses.map((course) => ({
      id: course.id,
      codigo: course.codigo,
      asignaturaId: course.asignaturaId,
      periodoId: period.id,
      sedeId: course.site.academicId,
      sedeNombre: course.site.name,
      estado: course.estado,
      cupoMaximo: course.cupoMaximo,
      inscriptosActivos: course.inscriptosActivos,
      ...(course.listsTeachers && course.estado !== "CANCELADO" ? { docentes: teachersOf(course) } : {}),
    })),
  );

  for (const course of courses.filter((candidate) => candidate.hasDetail)) {
    put(`academic/curso-detalle/${course.id}.json`, {
      curso: {
        id: course.id,
        asignatura: { id: course.asignaturaId, codigo: course.subject.code, nombre: course.subject.name },
        periodo: { id: period.id, anio: period.anio, numero: period.numero },
        sedeId: course.site.academicId,
        estado: course.estado,
      },
      docentes: teachersOf(course),
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Escritura protegida
// ---------------------------------------------------------------------------------------------

// JSON con las claves ordenadas: dos archivos que sólo difieren en el formato o el orden de claves son iguales.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// Carpetas cuyo contenido es 100% generado: ahí un archivo de más es un huérfano.
const MANAGED_DIRS: [dir: string, filter: (name: string) => boolean][] = [
  ["academic/planes", (name) => name.endsWith(".json")],
  ["academic/asignaturas", (name) => name.endsWith(".json")],
  ["academic/cursos", (name) => name.endsWith(".json")],
  ["academic/curso-detalle", (name) => name.endsWith(".json")],
  ["backoffice/users", (name) => name.endsWith(".json")],
  ["core/wallets-aggregates", (name) => /^\d{4}-\d{2}\.json$/.test(name)],
];

const created: string[] = [];
const unchanged: string[] = [];
const differing: string[] = [];

for (const [relativePath, content] of files) {
  const file = path.join(MOCKS_DIR, relativePath);
  if (!existsSync(file)) {
    created.push(relativePath);
    continue;
  }
  let current: unknown;
  try {
    current = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    differing.push(relativePath);
    continue;
  }
  (canonical(current) === canonical(content) ? unchanged : differing).push(relativePath);
}

const orphans = MANAGED_DIRS.flatMap(([dir, filter]) => {
  const absolute = path.join(MOCKS_DIR, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter(filter)
    .map((name) => `${dir}/${name}`)
    .filter((relativePath) => !files.has(relativePath));
});

console.log(`Generaría ${files.size} archivos: ${created.length} nuevos, ${unchanged.length} idénticos, ${differing.length} distintos de lo que hay en disco.`);

if (differing.length > 0 && !force) {
  console.error("\nNo se escribió nada: estos archivos ya existen y difieren de lo generado (¿ediciones a mano o mocks viejos?):");
  for (const name of differing.slice(0, 40)) console.error(`  ${name}`);
  if (differing.length > 40) console.error(`  ... y ${differing.length - 40} más`);
  console.error("\nSi querés pisarlos: npm run mocks:generate -- --force (se pierden esas ediciones).");
  process.exit(1);
}

if (orphans.length > 0) {
  console.log(`\nArchivos en carpetas generadas que ya no corresponden (${orphans.length}):`);
  for (const name of orphans.slice(0, 20)) console.log(`  ${name}`);
  if (orphans.length > 20) console.log(`  ... y ${orphans.length - 20} más`);
  console.log(prune ? "Se borran (--prune)." : "Se dejan como están. Con --prune se borran.");
}

if (dryRun) {
  console.log("\n--dry-run: no se escribió nada.");
  process.exit(0);
}

for (const relativePath of [...created, ...differing]) {
  const file = path.join(MOCKS_DIR, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(files.get(relativePath), null, 2)}\n`);
}
if (prune) for (const relativePath of orphans) rmSync(path.join(MOCKS_DIR, relativePath));

console.log(`\nListo: ${created.length} creados, ${differing.length} sobrescritos${prune ? `, ${orphans.length} borrados` : ""}.`);
