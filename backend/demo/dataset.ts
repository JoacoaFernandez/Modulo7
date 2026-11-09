// Dataset del demo: genera de forma determinística (PRNG con semilla fija) los envelopes v1 que siembra
// prisma/demo-seed.ts y el modelo académico (cursos por período) con el que scripts/generate-demo-mocks.ts arma los
// mocks. Los dos salen de la MISMA corrida: así los courseId, subjectId, periodId y siteId de los eventos existen en
// los mocks (docs/INTEGRACION.md, 5.3). No toca la base ni los archivos.
import { createHash } from "node:crypto";
import { CoreSource } from "../src/domain/entities/event-source.entity";
import {
  ACTIVE_SITES,
  CAREERS,
  CURRENT_PERIOD,
  DEMO_EVENT_ID_PREFIX,
  DEMO_NOW,
  DINING_SITES,
  DemoLocation,
  DemoPeriod,
  DemoSite,
  DemoSubject,
  DemoTeacher,
  EVENT_CATEGORIES,
  EventCategory,
  FIRST_DEMO_MONTH,
  LOCATIONS,
  PERIODS,
  PRODUCTS,
  SITE_BY_KEY,
  SiteKey,
  SUBJECTS,
  TEACHERS,
  UNKNOWN_LOCATION_ID,
  demoUuid,
} from "./ids";

// ---------------------------------------------------------------------------------------------
// Azar determinístico
// ---------------------------------------------------------------------------------------------

export function createRng(seed: number) {
  let state = seed;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  const chance = (probability: number) => next() < probability;
  // Cantidad entera alrededor de una media (ruido proporcional a la raíz).
  const around = (mean: number) => Math.max(0, Math.round(mean + gauss() * Math.sqrt(Math.max(mean, 0)) * 0.6));
  const weighted = <T>(items: readonly (readonly [T, number])[]): T => {
    const total = items.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = next() * total;
    for (const [item, weight] of items) {
      cursor -= weight;
      if (cursor < 0) return item;
    }
    return items[items.length - 1][0];
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return { next, gauss, int, pick, chance, around, weighted, shuffle };
}

export type Rng = ReturnType<typeof createRng>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------------------------
// Tiempo (Argentina es UTC-3 todo el año)
// ---------------------------------------------------------------------------------------------

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Instante (ms UTC) de una fecha y hora de pared en Argentina.
export const at = (year: number, month: number, day: number, hour = 12, minute = 0) => Date.UTC(year, month - 1, day, hour + 3, minute);
export const argDate = (ms: number) => new Date(ms - 3 * HOUR).toISOString().slice(0, 10);
export const argYm = (ms: number) => argDate(ms).slice(0, 7);
const argWeekday = (ms: number) => new Date(ms - 3 * HOUR).getUTCDay();
const dateMs = (text: string) => {
  const [y, m, d] = text.split("-").map(Number);
  return at(y, m, d, 0);
};
const iso = (ms: number) => new Date(ms).toISOString();
const money = (value: number) => value.toFixed(2);

// ---------------------------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------------------------

export interface DemoEnvelope {
  specVersion: "1.0";
  eventId: string;
  eventType: string;
  source: CoreSource;
  occurredAt: string;
  subject?: string;
  correlationId: string;
  causationId: null;
  actor: { type: string; id: string };
  data: Record<string, unknown>;
}

function hashHex(text: string): string {
  return createHash("sha1").update(`uadenet-demo-v1:${text}`).digest("hex");
}

// eventId estable derivado de una clave: re-ejecutar el seed produce los mismos ids (idempotencia) y todos llevan el
// prefijo DEMO_EVENT_ID_PREFIX, que usa `--clear` para borrar sólo el demo.
export function demoEventId(key: string): string {
  const h = hashHex(key);
  return `${DEMO_EVENT_ID_PREFIX}-${h.slice(0, 4)}-4${h.slice(4, 7)}-8${h.slice(7, 10)}-${h.slice(10, 22)}`;
}

function correlationIdOf(key: string): string {
  const h = hashHex(`corr:${key}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(12, 15)}-8${h.slice(15, 18)}-${h.slice(18, 30)}`;
}

class Emitter {
  readonly events: DemoEnvelope[] = [];
  private readonly keys = new Set<string>();

  // Devuelve false (sin emitir) si el instante cae después del "ahora" del demo.
  emit(key: string, source: CoreSource, eventType: string, ms: number, data: Record<string, unknown>, subject?: string): boolean {
    if (ms > DEMO_NOW) return false;
    if (this.keys.has(key)) throw new Error(`Clave de evento repetida en el demo: ${key}`);
    this.keys.add(key);
    this.events.push({
      specVersion: "1.0",
      eventId: demoEventId(key),
      eventType,
      source,
      occurredAt: iso(ms),
      ...(subject ? { subject } : {}),
      correlationId: correlationIdOf(key),
      causationId: null,
      actor: { type: "service", id: `${source}-service` },
      data,
    });
    return true;
  }
}

// ---------------------------------------------------------------------------------------------
// Modelo académico
// ---------------------------------------------------------------------------------------------

export type DemoCourseStatus = "PLANIFICADO" | "EN_CURSO" | "FINALIZADO" | "CANCELADO";

export interface DemoCourse {
  // Id numérico de G9: período * 1000 + posición.
  id: number;
  codigo: string;
  subject: DemoSubject;
  // Asignatura de G9 a la que está atado el curso (la del plan 2026 o, en algunos cursos de Sistemas, la del plan 2020).
  asignaturaId: number;
  period: DemoPeriod;
  site: DemoSite;
  comision: string;
  teacher: DemoTeacher;
  // Segundo docente (rol AUXILIAR): el tablero sólo atribuye al TITULAR.
  auxiliar: DemoTeacher | null;
  estado: DemoCourseStatus;
  cupoMaximo: number;
  inscriptosActivos: number;
  // `docentes` en GET /cursos?periodoId=. false = el listado no lo trae y hay que pedir el detalle del curso.
  listsTeachers: boolean;
  // Existe curso-detalle/<id>.json (false en un curso sin ficha: devuelve 404 y no se atribuye).
  hasDetail: boolean;
  // Tiene resultados publicados.
  hasResults: boolean;
  studentIds: string[];
}

export interface DemoDataset {
  courses: DemoCourse[];
  events: DemoEnvelope[];
}

const SITE_RATE_DELTA: Record<SiteKey, number> = { monserrat: 0, belgrano: -1.5, pinamar: 1.5, online: -3.5, recoleta: 0.5 };
// Tamaño base de la población estudiantil de cada sede.
const POOLS: Record<SiteKey, number> = { monserrat: 360, belgrano: 240, pinamar: 170, online: 130, recoleta: 200 };

const NOTAS_APROBADO: readonly (readonly [number, number])[] = [[4, 0.16], [5, 0.13], [6, 0.17], [7, 0.2], [8, 0.17], [9, 0.1], [10, 0.07]];
const NOTAS_DESAPROBADO: readonly (readonly [number, number])[] = [[1, 0.2], [2, 0.35], [3, 0.45]];

const siteIndexOf = (site: DemoSite) => ACTIVE_SITES.indexOf(site) + 1;
const studentIdOf = (site: DemoSite, n: number) => demoUuid("student", siteIndexOf(site) * 10000 + n);

function buildAcademic(out: Emitter): DemoCourse[] {
  const rng = createRng(20261104);
  const allCourses: DemoCourse[] = [];
  const careerOfStudent = new Map<string, number>();
  const careerFor = (studentId: string): number => {
    let career = careerOfStudent.get(studentId);
    if (career === undefined) {
      career = rng.weighted(CAREERS.map((candidate) => [candidate.id, candidate.share] as const));
      careerOfStudent.set(studentId, career);
    }
    return career;
  };

  for (const period of PERIODS) {
    const qi = period.index;
    const current = period.id === CURRENT_PERIOD.id;
    const endMs = dateMs(period.fechaFin);

    // --- Cursos del período: materia × sede × comisión.
    const courses: DemoCourse[] = [];
    for (const subject of SUBJECTS) {
      if ((subject.since ?? 0) > qi) continue;
      const sameCareer = SUBJECTS.filter((candidate) => candidate.careerId === subject.careerId);
      const subjectIndex = sameCareer.indexOf(subject);
      const careerTeachers = TEACHERS.filter((teacher) => teacher.careerId === subject.careerId);

      ACTIVE_SITES.forEach((site, siteIdx) => {
        if (!subject.sedes.includes(site.letter)) return;
        // Pinamar y el campus online amplían su oferta con los años.
        if (site.key === "pinamar" && qi < 2 && subjectIndex >= 3) return;
        if (site.key === "online" && qi < 1 && subject.popular !== true) return;

        const commissions = subject.popular && (site.key === "monserrat" || (site.key === "belgrano" && qi >= 3)) ? ["A", "B"] : ["A"];
        commissions.forEach((comision, commIndex) => {
          const teacher = careerTeachers[(subjectIndex * 2 + siteIdx + commIndex + Math.floor(qi / 2)) % careerTeachers.length];
          const auxiliar = rng.chance(0.25) ? careerTeachers[(careerTeachers.indexOf(teacher) + 3) % careerTeachers.length] : null;
          // Los cursos de Pinamar y Online (y la comisión B) de las materias que existen en el plan 2020 usan ese id.
          const legacy = subject.legacyId !== undefined && (site.key === "pinamar" || site.key === "online" || comision === "B");
          courses.push({
            id: period.id * 1000 + courses.length + 1,
            codigo: `${subject.code}-${site.code.slice(0, 3)}-${comision}`,
            subject,
            asignaturaId: legacy ? subject.legacyId! : subject.id,
            period,
            site,
            comision,
            teacher,
            auxiliar: auxiliar && auxiliar !== teacher ? auxiliar : null,
            // Cuatrimestres cerrados: finalizados. Cuatrimestre en curso: sólo los de promoción directa (35%) ya publicaron.
            estado: current ? (rng.chance(0.35) ? "FINALIZADO" : "EN_CURSO") : "FINALIZADO",
            cupoMaximo: 0,
            inscriptosActivos: 0,
            listsTeachers: true,
            hasDetail: false,
            hasResults: false,
            studentIds: [],
          });
        });
      });
    }
    // Un curso por período se canceló (en el último y el anterior, para ver que no cuenta en los KPI).
    if (qi >= PERIODS.length - 2) courses[Math.floor(courses.length * (qi === PERIODS.length - 1 ? 0.62 : 0.31))].estado = "CANCELADO";

    // --- Inscripciones: cada alumno activo cursa 2-4 materias de su sede, con preferencia por su facultad.
    const live = courses.filter((course) => course.estado !== "CANCELADO");
    for (const site of ACTIVE_SITES) {
      const siteCourses = live.filter((course) => course.site === site);
      if (siteCourses.length === 0) continue;
      const pool = POOLS[site.key];
      const first = Math.floor(pool * 0.05 * qi) + 1;
      const active = Math.round(pool * (0.55 + 0.07 * qi));
      for (let n = first; n < first + active; n += 1) {
        const studentId = studentIdOf(site, n);
        const own = siteCourses.filter((course) => course.subject.careerId === careerFor(studentId));
        const wanted = rng.pick([2, 3, 3, 4]);
        const picked = new Set<string>();
        for (let attempt = 0; attempt < 14 && picked.size < wanted; attempt += 1) {
          const candidates = rng.chance(0.78) && own.length > 0 ? own : siteCourses;
          const course = rng.pick(candidates);
          if (picked.has(course.subject.code)) continue;
          picked.add(course.subject.code);
          course.studentIds.push(studentId);
        }
      }
    }

    // --- Resultados de curso (academic.course-result.published.v1) y cierre de cada curso.
    for (const course of courses) {
      const { subject, site, teacher } = course;
      course.cupoMaximo = Math.max(30, Math.ceil((course.studentIds.length * 1.25) / 5) * 5);

      if (course.estado === "CANCELADO") {
        course.inscriptosActivos = 0;
        continue;
      }

      // Bajas antes del cierre: no reciben resultado.
      const finishers = course.studentIds.filter(() => !rng.chance(site.key === "online" ? 0.06 : 0.035));
      if (course.estado === "EN_CURSO") {
        course.inscriptosActivos = course.studentIds.length;
        continue;
      }

      course.inscriptosActivos = finishers.length;
      course.hasResults = true;

      const rate = clamp(
        subject.base + subject.trend * qi + SITE_RATE_DELTA[site.key] + CAREERS.find((career) => career.id === subject.careerId)!.rateDelta + teacher.bias + rng.gauss() * 1.2,
        15,
        92,
      );
      const resultsAt = current ? at(2026, 10, 5 + rng.int(0, 27), 10 + rng.int(0, 7)) : endMs + (2 + rng.next() * 10) * DAY + (10 + rng.next() * 8) * HOUR;
      const approvedCount = clamp(Math.round(finishers.length * (rate / 100) + rng.gauss() * 0.8), 0, finishers.length);

      rng.shuffle(finishers).forEach((studentId, index) => {
        const approved = index < approvedCount;
        const publishedAt = resultsAt + index * 7 * MIN;
        const grade = rng.weighted(approved ? NOTAS_APROBADO : NOTAS_DESAPROBADO);
        const base = {
          studentId,
          courseId: String(course.id),
          subjectId: String(course.asignaturaId),
          periodId: String(period.id),
          siteId: site.id,
        };
        out.emit(
          `res:${course.id}:${studentId}`,
          "academic",
          "academic.course-result.published.v1",
          publishedAt,
          { ...base, finalGrade: grade, status: approved ? "APROBADO" : "DESAPROBADO", resultDate: argDate(publishedAt) },
          `course/${course.id}`,
        );

        // Corrección de nota: se republica con eventId nuevo y gana el último por (alumno, curso). Casi siempre un
        // desaprobado que pasa a aprobado tras revisar el examen.
        if (rng.chance(0.016)) {
          const toApproved = !approved && rng.chance(0.85);
          const toFailed = approved && rng.chance(0.15);
          if (toApproved || toFailed) {
            out.emit(
              `res-corr:${course.id}:${studentId}`,
              "academic",
              "academic.course-result.published.v1",
              publishedAt + (4 + rng.next() * 14) * DAY,
              { ...base, finalGrade: toApproved ? 4 : 3, status: toApproved ? "APROBADO" : "DESAPROBADO", resultDate: argDate(publishedAt + 5 * DAY) },
              `course/${course.id}`,
            );
          }
        }
      });
    }

    // --- Casos de docentes en el listado: algunos cursos no traen `docentes` y se resuelven con el detalle del curso.
    if (qi >= PERIODS.length - 2) {
      const withResults = courses.filter((course) => course.hasResults);
      const detailPicks = current ? [2, 8, 14, 20] : [4, 11];
      for (const index of detailPicks) {
        if (withResults[index]) {
          withResults[index].listsTeachers = false;
          withResults[index].hasDetail = true;
        }
      }
      // Un curso sin docentes en el listado y sin ficha: el detalle da 404 y el curso no se atribuye a nadie.
      if (!current && withResults[19]) {
        withResults[19].listsTeachers = false;
        withResults[19].hasDetail = false;
      }
    }

    allCourses.push(...courses);
  }

  return allCourses;
}

// ---------------------------------------------------------------------------------------------
// Backoffice: locaciones y efectos laterales
// ---------------------------------------------------------------------------------------------

function buildBackoffice(out: Emitter): void {
  LOCATIONS.forEach((location, index) => {
    out.emit(`loc:${location.id}`, "backoffice", "backoffice.location.upserted.v1", at(2026, 2, 10 + (index % 5), 9, index), {
      locationId: location.id,
      siteId: SITE_BY_KEY[location.siteKey].id,
      name: location.name,
      capacity: location.capacity,
      status: location.status,
      type: location.type,
    }, `location/${location.id}`);
  });
  // Un upsert posterior de la misma locación: manda el último (nombre y capacidad nuevos).
  const magna = LOCATIONS[0];
  out.emit(`loc-update:${magna.id}`, "backoffice", "backoffice.location.upserted.v1", at(2026, 9, 8, 10), {
    locationId: magna.id,
    siteId: SITE_BY_KEY[magna.siteKey].id,
    name: "Aula Magna (renovada)",
    capacity: magna.capacity,
    status: "ACTIVE",
    type: magna.type,
  }, `location/${magna.id}`);

  // Efecto lateral (no se guarda): alta y baja de usuarios. Sólo llegan a source_ingestions.
  TEACHERS.slice(0, 6).forEach((teacher, index) => {
    out.emit(`user-up:${teacher.id}`, "backoffice", "backoffice.user.upserted.v1", at(2026, 8, 3 + index, 11), { userId: teacher.id, email: `${teacher.firstName}.${teacher.lastName}`.toLowerCase().replace(/\s/g, "") + "@uade.edu.ar" });
  });
  out.emit(`user-dis:${TEACHERS[7].id}`, "backoffice", "backoffice.user.disabled.v1", at(2026, 9, 14, 16), { userId: TEACHERS[7].id });
}

// ---------------------------------------------------------------------------------------------
// Finanzas: tienda, comedor
// ---------------------------------------------------------------------------------------------

export interface Span {
  start: number;
  end: number;
  // Fracción del mes transcurrida (1 salvo el mes en curso).
  frac: number;
  index: number;
  year: number;
  month: number;
  ym: string;
  // Inflación mensual acumulada desde el primer mes.
  infl: number;
}

// Estacionalidad del uso del campus: baja en el receso de julio, pico en el cursado.
export const SEASON: Record<number, number> = { 1: 0.22, 2: 0.4, 3: 0.9, 4: 1, 5: 1.05, 6: 1, 7: 0.7, 8: 0.95, 9: 1.05, 10: 1.05, 11: 1, 12: 0.7 };

// Un tramo por mes desde FIRST_DEMO_MONTH hasta el mes de DEMO_NOW; el último termina en DEMO_NOW.
export const SPANS: Span[] = (() => {
  const spans: Span[] = [];
  let [year, month] = FIRST_DEMO_MONTH.split("-").map(Number);
  for (let index = 0; ; index += 1) {
    const start = at(year, month, 1, 0);
    const full = at(year, month + 1, 1, 0);
    if (start >= DEMO_NOW) break;
    const end = Math.min(full, DEMO_NOW);
    spans.push({ start, end, frac: (end - start) / (full - start), index, year, month, ym: `${year}-${String(month).padStart(2, "0")}`, infl: 1.022 ** index });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return spans;
})();

// Un instante al azar dentro del tramo (de lunes a viernes o cualquier día) entre dos horas; null si no entra antes de DEMO_NOW.
function randomMoment(rng: Rng, span: Span, hourMin: number, hourMax: number, weekdaysOnly = true): number | null {
  const days = Math.max(1, Math.floor((span.end - span.start) / DAY));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ms = span.start + Math.floor(rng.next() * days) * DAY + (hourMin + rng.next() * (hourMax - hourMin)) * HOUR;
    const weekday = argWeekday(ms);
    if (weekdaysOnly && (weekday === 0 || weekday === 6)) continue;
    if (ms <= DEMO_NOW && ms < span.end) return ms;
  }
  return null;
}

const round50 = (value: number) => Math.round(value / 50) * 50;

const randomStudent = (rng: Rng, site: DemoSite) => studentIdOf(site, rng.int(1, POOLS[site.key] || 100));

function buildStore(out: Emitter): void {
  const rng = createRng(20261105);
  let counter = 0;

  for (const span of SPANS) {
    const purchases = rng.around(430 * SEASON[span.month] * span.frac);
    for (let i = 0; i < purchases; i += 1) {
      const ms = randomMoment(rng, span, 9, 20);
      if (ms === null) continue;

      const site = rng.weighted([[SITE_BY_KEY.monserrat, 0.35], [SITE_BY_KEY.belgrano, 0.25], [SITE_BY_KEY.recoleta, 0.2], [SITE_BY_KEY.pinamar, 0.12], [SITE_BY_KEY.online, 0.08]] as const);
      const lineCount = rng.weighted([[1, 0.62], [2, 0.28], [3, 0.1]] as const);
      const chosen = new Set<string>();
      const items: Record<string, unknown>[] = [];
      let total = 0;
      for (let attempt = 0; attempt < 8 && items.length < lineCount; attempt += 1) {
        const product = rng.weighted(PRODUCTS.map((candidate) => [candidate, candidate.weight] as const));
        if (chosen.has(product.id)) continue;
        chosen.add(product.id);
        const quantity = rng.weighted([[1, 0.7], [2, 0.2], [3, 0.1]] as const);
        const unitPrice = round50(product.price * span.infl);
        const subtotal = unitPrice * quantity;
        total += subtotal;
        items.push({
          productId: product.id,
          productName: product.renamedFrom && argDate(ms) >= product.renamedFrom.date ? product.renamedFrom.name : product.name,
          category: product.category,
          quantity,
          unitPrice: money(unitPrice),
          subtotal: money(subtotal),
        });
      }

      counter += 1;
      const purchaseId = demoUuid("purchase", counter);
      out.emit(`purchase:${counter}`, "store", "store.purchase.completed.v1", ms, {
        purchaseId,
        userId: randomStudent(rng, site),
        total: money(total),
        currency: "ARS",
        // El siteId es opcional en el evento: el 30% de las compras no lo trae (no cuentan con una sede elegida).
        ...(rng.chance(0.7) ? { siteId: site.id } : {}),
        items,
      }, `purchase/${purchaseId}`);
    }
  }
}

const DINING_BASE: Partial<Record<SiteKey, number>> = { monserrat: 330, belgrano: 240, recoleta: 200, pinamar: 150 };

function buildDining(out: Emitter): void {
  const rng = createRng(20261106);
  let counter = 0;

  const reserve = (site: DemoSite, createdAt: number, amount: number, cancelledAt: number | null, keyPrefix: string): void => {
    counter += 1;
    const reservationId = demoUuid("reservation", counter);
    const userId = randomStudent(rng, site);
    const slotAt = createdAt + (3 + Math.floor(rng.next() * 27)) * HOUR;
    out.emit(`${keyPrefix}:${counter}`, "dining", "dining.reservation.created.v1", createdAt, {
      reservationId,
      userId,
      siteId: site.id,
      slotAt: iso(slotAt),
      amount: money(amount),
      currency: "ARS",
    }, `reservation/${reservationId}`);

    if (cancelledAt !== null) {
      out.emit(`${keyPrefix}-cancel:${counter}`, "dining", "dining.reservation.cancelled.v1", cancelledAt, {
        reservationId,
        userId,
        slotAt: iso(slotAt),
        cancelledAt: iso(cancelledAt),
      }, `reservation/${reservationId}`);
    } else if (rng.chance(0.88)) {
      out.emit(`${keyPrefix}-att:${counter}`, "dining", "dining.attendance.recorded.v1", slotAt + 10 * MIN, {
        reservationId,
        userId,
        attendedAt: iso(slotAt + 10 * MIN),
      }, `reservation/${reservationId}`);
    }
  };

  for (const span of SPANS) {
    for (const site of DINING_SITES) {
      const reservations = rng.around((DINING_BASE[site.key] ?? 0) * SEASON[span.month] * span.frac);
      for (let i = 0; i < reservations; i += 1) {
        const ms = randomMoment(rng, span, 8, 18);
        if (ms === null) continue;
        const cancelled = rng.chance(0.07);
        reserve(site, ms, round50(2500 * span.infl), cancelled ? ms + (1 + rng.next() * 19) * HOUR : null, "res");
      }
    }
  }

  // Cancelación que cruza de mes (reservada el 31/10 a la noche, cancelada el 1/11): se descuenta de octubre igual,
  // porque el cruce con la reserva es por reservationId y sin límite de fecha.
  for (const site of DINING_SITES) {
    reserve(site, at(2026, 10, 31, 22, 15), round50(2500 * 1.022 ** 7), at(2026, 11, 1, 9, 30), "res-edge");
  }
}

// ---------------------------------------------------------------------------------------------
// Eventos académicos (G6)
// ---------------------------------------------------------------------------------------------

interface CategoryProfile {
  title: string[];
  capacity: [number, number];
  price: number;
  durationHours: number;
  registrationRate: number;
  attendanceRate: number;
}

const PROFILES: Record<EventCategory, CategoryProfile> = {
  Charla: { title: ["Charla: Inteligencia artificial en la industria", "Charla: Mercado laboral 2027", "Charla con egresados", "Charla: Finanzas personales", "Charla: Derecho y tecnología"], capacity: [80, 150], price: 0, durationHours: 2, registrationRate: 0.72, attendanceRate: 0.76 },
  Taller: { title: ["Taller de CV y entrevistas", "Taller de Excel avanzado", "Taller de oratoria", "Taller de dibujo urbano", "Taller de escritura académica"], capacity: [25, 40], price: 3500, durationHours: 3, registrationRate: 0.92, attendanceRate: 0.88 },
  Congreso: { title: ["Congreso de Innovación", "Congreso de Ingeniería", "Congreso de Salud Mental", "Congreso de Derecho Digital"], capacity: [250, 350], price: 8000, durationHours: 6, registrationRate: 0.8, attendanceRate: 0.7 },
  Jornada: { title: ["Jornada de bienvenida", "Jornada de puertas abiertas", "Jornada de investigación", "Jornada de extensión universitaria"], capacity: [120, 180], price: 0, durationHours: 3, registrationRate: 0.66, attendanceRate: 0.62 },
  Networking: { title: ["Noche de networking", "Encuentro de emprendedores", "Networking con empresas"], capacity: [60, 90], price: 0, durationHours: 2, registrationRate: 0.78, attendanceRate: 0.8 },
  Seminario: { title: ["Seminario de liderazgo", "Seminario de ciberseguridad", "Seminario de arquitectura sustentable"], capacity: [50, 80], price: 5000, durationHours: 3, registrationRate: 0.7, attendanceRate: 0.82 },
};

const EVENTS_PER_MONTH: Record<string, number> = { "2026-03": 5, "2026-04": 7, "2026-05": 8, "2026-06": 8, "2026-07": 4, "2026-08": 7, "2026-09": 9, "2026-10": 9, "2026-11": 2 };

interface PlannedEvent {
  n: number;
  category: EventCategory | null;
  title: string;
  location: DemoLocation | null;
  locationId: string;
  capacity: number;
  price: number;
  startMs: number;
  endMs: number;
}

function buildEvents(out: Emitter): void {
  const rng = createRng(20261107);
  const hostLocations = LOCATIONS.filter((location) => location.status === "ACTIVE" && SITE_BY_KEY[location.siteKey].status === "ACTIVE");
  const planned: PlannedEvent[] = [];

  const plan = (n: number, category: EventCategory | null, title: string, locationId: string | null, capacity: number, price: number, startMs: number, durationHours: number): void => {
    const location = locationId === null ? null : (LOCATIONS.find((candidate) => candidate.id === locationId) ?? null);
    planned.push({ n, category, title, location, locationId: locationId ?? UNKNOWN_LOCATION_ID, capacity, price, startMs, endMs: startMs + durationHours * HOUR });
  };

  let n = 0;
  for (const span of SPANS) {
    const count = EVENTS_PER_MONTH[span.ym] ?? 0;
    for (let i = 0; i < count; i += 1) {
      n += 1;
      // El último mes (parcial) sólo tiene eventos cortos que ya terminaron.
      const category = span.frac < 1 ? rng.pick<EventCategory>(["Charla", "Taller"]) : rng.pick(EVENT_CATEGORIES);
      const profile = PROFILES[category];
      const wanted = rng.int(profile.capacity[0], profile.capacity[1]);
      const fitting = hostLocations.filter((location) => location.capacity >= wanted);
      const location = rng.pick(fitting.length > 0 ? fitting : hostLocations.filter((candidate) => candidate.capacity >= profile.capacity[0]));
      const day = span.frac < 1 ? 2 + rng.int(0, 2) : 3 + Math.floor((i * 27) / count) + rng.int(0, 1);
      let ms = at(span.year, span.month, Math.min(day, 28), 16 + rng.int(0, 2));
      while (argWeekday(ms) === 0 || argWeekday(ms) === 6) ms += DAY;
      plan(n, category, rng.pick(profile.title), location.id, Math.min(wanted, location.capacity), profile.price, ms, profile.durationHours);
    }
  }

  // Evento sin locación conocida (nunca llegó su location.upserted) y sin categoría: sólo cuenta en "Todas las sedes" y
  // su tipo sale de la clase de precio (Gratuito). Octubre, para que se vea al elegir ese mes.
  n += 1;
  plan(n, null, "Jornada de orientación vocacional", null, 140, 0, at(2026, 10, 14, 17), 3);

  // Eventos futuros: ya creados y con inscripciones, todavía sin asistencia. No cuentan como realizados.
  n += 1;
  plan(n, "Congreso", "Congreso Anual de Innovación 2026", LOCATIONS[0].id, 300, 8000, at(2026, 11, 12, 9), 8);
  n += 1;
  plan(n, "Networking", "Encuentro de egresados", LOCATIONS[3].id, 90, 0, at(2026, 12, 3, 18), 3);

  let userCounter = 1;
  for (const event of planned) {
    const eventId = demoUuid("event", event.n);
    const profile = PROFILES[event.category ?? "Jornada"];
    const category = event.category;
    const createdAt = event.startMs - (14 + rng.next() * 30) * DAY;

    out.emit(`event:${event.n}`, "events", "events.event.created.v1", createdAt, {
      eventId,
      title: event.title,
      locationId: event.locationId,
      startAt: iso(event.startMs),
      endAt: iso(event.endMs),
      capacity: event.capacity,
      price: money(event.price),
      currency: "ARS",
      ...(category ? { category } : {}),
    }, `event/${eventId}`);

    const upcoming = event.endMs > DEMO_NOW;
    // Los eventos futuros llevan la mitad de las inscripciones que tendrán al final.
    const registered = Math.min(event.capacity, Math.round(event.capacity * profile.registrationRate * (0.85 + rng.next() * 0.25) * (upcoming ? 0.5 : 1)));
    const registrants: string[] = [];
    for (let i = 0; i < registered; i += 1) {
      userCounter += 1;
      const userId = demoUuid("student", 50000 + userCounter);
      const registrationId = demoUuid("registration", userCounter);
      const window = Math.min(event.startMs - HOUR, DEMO_NOW) - (createdAt + DAY);
      const ms = createdAt + DAY + rng.next() * Math.max(window, HOUR);
      registrants.push(userId);
      out.emit(`reg:${event.n}:${i}`, "events", "events.registration.completed.v1", ms, {
        eventId,
        registrationId,
        userId,
        amount: money(event.price),
        currency: "ARS",
      }, `event/${eventId}`);
    }

    if (upcoming) continue;

    const attendanceRate = clamp(profile.attendanceRate + rng.gauss() * 0.04, 0.35, 0.97);
    registrants.forEach((userId, i) => {
      const present = rng.chance(attendanceRate);
      // G6 sólo garantiza los presentes; los ausentes explícitos (present: false) llegan en la mitad de los casos.
      if (!present && rng.chance(0.5)) return;
      const checkedAt = event.startMs + rng.next() * 30 * MIN;
      out.emit(`att:${event.n}:${i}`, "events", "events.attendance.recorded.v1", checkedAt, {
        eventId,
        userId,
        present,
        checkedAt: iso(checkedAt),
      }, `event/${eventId}`);
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Eventos que se reciben y se descartan (ack sin guardar): alimentan "Fuentes de datos"
// ---------------------------------------------------------------------------------------------

function buildDiscarded(out: Emitter): void {
  const rng = createRng(20261108);
  for (const span of SPANS) {
    const penalties = Math.round(5 * span.frac);
    for (let i = 0; i < penalties; i += 1) {
      const ms = randomMoment(rng, span, 9, 19);
      if (ms === null) continue;
      out.emit(`penalty:${span.ym}:${i}`, "library", "library.penalty.applied.v1", ms, {
        penaltyId: demoUuid("purchase", 900000 + span.index * 100 + i),
        userId: randomStudent(rng, SITE_BY_KEY.monserrat),
        amount: money(round50(rng.int(500, 3000))),
        currency: "ARS",
      });
    }
    const postings = Math.round(4 * span.frac);
    for (let i = 0; i < postings; i += 1) {
      const ms = randomMoment(rng, span, 8, 21, false);
      if (ms === null) continue;
      out.emit(`wallet:${span.ym}:${i}`, "core", "core.wallet.transaction-posted.v1", ms, {
        transactionId: demoUuid("purchase", 800000 + span.index * 100 + i),
        concept: "TOP_UP",
        amount: money(round50(rng.int(5000, 50000))),
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Armado
// ---------------------------------------------------------------------------------------------

let cached: DemoDataset | null = null;

// Genera (una vez por proceso) los cursos y todos los envelopes del demo, ordenados por occurredAt.
export function buildDemoDataset(): DemoDataset {
  if (cached) return cached;

  const out = new Emitter();
  buildBackoffice(out);
  const courses = buildAcademic(out);
  buildStore(out);
  buildDining(out);
  buildEvents(out);
  buildDiscarded(out);

  out.events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId));
  cached = { courses, events: out.events };
  return cached;
}
