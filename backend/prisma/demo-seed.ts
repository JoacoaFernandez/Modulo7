// Dataset de demo: ~60 mil eventos realistas para mostrar los tableros. Determinístico (PRNG con semilla fija) y
// re-ejecutable: los eventId `demo-*` son estables y se insertan con skipDuplicates. `--clear` borra solo los `demo-*`.
//   npm run db:demo          genera e inserta
//   npm run db:demo:clear    borra los eventos demo-* (no toca el seed mínimo ni los eventos reales)
import { PrismaClient, Prisma } from "@prisma/client";
import { SourceModule } from "../src/domain/entities/event-source.entity";
import { validateEventPayload } from "../src/domain/services/event-payload-validator.service";

try {
  process.loadEnvFile();
} catch {
  // Sin .env se usa DATABASE_URL del entorno.
}

// ---------------------------------------------------------------------------------------------
// Azar determinístico y tiempo
// ---------------------------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261104);
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const chance = (probability: number) => rand() < probability;
// Cantidad entera alrededor de una media (ruido proporcional a la raíz).
const around = (mean: number) => Math.max(0, Math.round(mean + gauss() * Math.sqrt(Math.max(mean, 0)) * 0.6));

function weighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rand() * total;
  for (const [item, weight] of items) {
    cursor -= weight;
    if (cursor < 0) return item;
  }
  return items[items.length - 1][0];
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Argentina es UTC-3 todo el año. "Hoy" es 2026-11-04 al mediodía: nada ocurre después.
const NOW = Date.UTC(2026, 10, 4, 15, 0);
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  Date.UTC(year, month - 1, day, hour + 3, minute);
const argDate = (ms: number) => new Date(ms - 3 * HOUR).toISOString().slice(0, 10);
const argYm = (ms: number) => argDate(ms).slice(0, 7);
const argWeekday = (ms: number) => new Date(ms - 3 * HOUR).getUTCDay();
const dateMs = (text: string) => {
  const [y, m, d] = text.split("-").map(Number);
  return at(y, m, d, 0);
};

// ---------------------------------------------------------------------------------------------
// Acumulador de eventos
// ---------------------------------------------------------------------------------------------

interface DemoEvent {
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

const events: DemoEvent[] = [];
const usedIds = new Set<string>();

// Devuelve false (sin emitir) si el instante cae en el futuro.
function emit(id: string, sourceModule: SourceModule, eventType: string, ms: number, payload: Record<string, unknown>): boolean {
  if (ms > NOW) return false;
  const eventId = `demo-${id}`;
  if (usedIds.has(eventId)) throw new Error(`eventId repetido: ${eventId}`);
  usedIds.add(eventId);
  events.push({ eventId, sourceModule, eventType, occurredAt: new Date(ms), payload });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------------------------

interface Sede {
  id: string;
  name: string;
  code: string;
  short: string;
  weight: number;
  pool: number;
  rateDelta: number;
}

const SEDES: Sede[] = [
  { id: "sede-centro", name: "Sede Centro", code: "C", short: "CEN", weight: 1, pool: 800, rateDelta: 0 },
  { id: "sede-belgrano", name: "Sede Belgrano", code: "B", short: "BEL", weight: 0.75, pool: 500, rateDelta: -1.5 },
  { id: "sede-pilar", name: "Sede Pilar", code: "P", short: "PIL", weight: 0.55, pool: 340, rateDelta: 1.5 },
  { id: "campus-online", name: "Campus Online", code: "O", short: "ONL", weight: 0.5, pool: 260, rateDelta: -3.5 },
];
// Escala de la población estudiantil: define cuántos eventos académicos se generan. Con más alumnos la consulta de
// tasa por facultad (cruza cada resultado con su curso.abierto) supera el segundo y medio.
const STUDENT_SCALE = 0.5;
const IN_PERSON = SEDES.filter((sede) => sede.id !== "campus-online");

const FACULTIES = [
  { name: "Ingeniería y Tecnología", share: 0.27, rateDelta: -3 },
  { name: "Ciencias Económicas", share: 0.25, rateDelta: 0 },
  { name: "Derecho y Ciencias Sociales", share: 0.2, rateDelta: 1 },
  { name: "Arquitectura y Diseño", share: 0.12, rateDelta: 2 },
  { name: "Ciencias de la Salud y Psicología", share: 0.16, rateDelta: 2.5 },
];

interface Subject {
  code: string;
  name: string;
  faculty: number;
  // Sedes donde se dicta: C centro, B belgrano, P pilar, O campus online.
  sedes: string;
  popular?: boolean;
  // Primer cuatrimestre (índice 0 = 2024-1C) en que se dicta.
  since?: number;
  // Tasa base de aprobación (%) en 2024-1C y variación por cuatrimestre en pp.
  base: number;
  trend: number;
}

const SUBJECTS: Subject[] = [
  // Ingeniería y Tecnología
  { code: "MAT-101", name: "Análisis Matemático I", faculty: 0, sedes: "CBP", popular: true, base: 46, trend: 4 },
  { code: "MAT-102", name: "Álgebra y Geometría Analítica", faculty: 0, sedes: "CBP", popular: true, base: 55, trend: 1 },
  { code: "FIS-110", name: "Física I", faculty: 0, sedes: "CBP", base: 70, trend: -4 },
  { code: "INF-120", name: "Algoritmos y Estructuras de Datos", faculty: 0, sedes: "CBPO", popular: true, base: 67, trend: 0.5 },
  { code: "INF-210", name: "Bases de Datos", faculty: 0, sedes: "CB", base: 74, trend: 1 },
  { code: "INF-220", name: "Sistemas Operativos", faculty: 0, sedes: "CB", base: 66, trend: -1 },
  { code: "INF-230", name: "Inteligencia Artificial", faculty: 0, sedes: "CBO", since: 4, base: 79, trend: 1 },
  { code: "IND-201", name: "Probabilidad y Estadística", faculty: 0, sedes: "CBP", base: 54, trend: 2 },
  // Ciencias Económicas
  { code: "ECO-101", name: "Contabilidad Básica", faculty: 1, sedes: "CBPO", popular: true, base: 72, trend: -1 },
  { code: "ECO-110", name: "Microeconomía", faculty: 1, sedes: "CBP", base: 50, trend: 3 },
  { code: "ECO-120", name: "Macroeconomía", faculty: 1, sedes: "CBP", base: 57, trend: 0 },
  { code: "ECO-201", name: "Estadística para Negocios", faculty: 1, sedes: "CBO", base: 42, trend: 2.5 },
  { code: "ADM-101", name: "Administración General", faculty: 1, sedes: "CBPO", popular: true, base: 85, trend: -0.5 },
  { code: "ECO-210", name: "Costos y Gestión", faculty: 1, sedes: "CB", base: 82, trend: -3.5 },
  { code: "MKT-201", name: "Marketing Digital", faculty: 1, sedes: "CBO", since: 2, base: 86, trend: 0.5 },
  // Derecho y Ciencias Sociales
  { code: "DER-101", name: "Introducción al Derecho", faculty: 2, sedes: "CBPO", popular: true, base: 76, trend: 1 },
  { code: "DER-110", name: "Derecho Constitucional", faculty: 2, sedes: "CBP", base: 64, trend: 0 },
  { code: "DER-120", name: "Derecho Civil: Parte General", faculty: 2, sedes: "CBP", base: 44, trend: 2.5 },
  { code: "DER-210", name: "Derecho Penal", faculty: 2, sedes: "CB", base: 66, trend: -2 },
  { code: "DER-220", name: "Derecho Laboral", faculty: 2, sedes: "CBO", base: 71, trend: 1 },
  { code: "SOC-101", name: "Sociología", faculty: 2, sedes: "CBPO", base: 83, trend: 0 },
  // Arquitectura y Diseño
  { code: "ARQ-101", name: "Taller de Diseño I", faculty: 3, sedes: "CB", popular: true, base: 81, trend: 0 },
  { code: "ARQ-110", name: "Historia de la Arquitectura", faculty: 3, sedes: "CBP", base: 87, trend: -0.5 },
  { code: "ARQ-120", name: "Matemática Aplicada", faculty: 3, sedes: "CB", base: 41, trend: 3 },
  { code: "ARQ-210", name: "Estructuras I", faculty: 3, sedes: "CB", base: 58, trend: -1.5 },
  { code: "DIS-101", name: "Dibujo y Expresión Gráfica", faculty: 3, sedes: "CBP", base: 89, trend: 0 },
  // Ciencias de la Salud y Psicología
  { code: "PSI-101", name: "Psicología General", faculty: 4, sedes: "CBPO", popular: true, base: 74, trend: 1 },
  { code: "PSI-110", name: "Psicología Evolutiva", faculty: 4, sedes: "CBP", base: 69, trend: 0 },
  { code: "PSI-210", name: "Estadística Aplicada a la Psicología", faculty: 4, sedes: "CBP", base: 50, trend: 2 },
  { code: "HUM-101", name: "Comunicación y Lenguaje", faculty: 4, sedes: "CBPO", base: 86, trend: 0 },
  { code: "HUM-110", name: "Epistemología", faculty: 4, sedes: "CBO", base: 65, trend: -1.5 },
  { code: "SAL-101", name: "Anatomía Humana", faculty: 4, sedes: "CB", since: 3, base: 46, trend: 1 },
];

interface Teacher {
  id: string;
  name: string;
  faculty: number;
  // Sesgo propio en pp sobre la tasa de la materia.
  bias: number;
}

const TEACHER_NAMES: string[][] = [
  ["Laura Gómez", "Martín Pérez", "Ricardo Fernández", "Silvana Acosta", "Gustavo Benítez", "Mariana Ledesma", "Federico Ibarra", "Carolina Duarte"],
  ["Alejandra Sosa", "Pablo Quiroga", "Verónica Molina", "Diego Herrera", "Natalia Cabrera", "Sergio Paz", "Lucía Ferreyra"],
  ["Marcelo Rojas", "Florencia Aguirre", "Hernán Domínguez", "Julieta Navarro", "Esteban Vega", "Paula Giménez"],
  ["Andrés Medina", "Cecilia Ortiz", "Rodrigo Suárez", "Valeria Campos", "Leandro Ruiz"],
  ["Gabriela Romero", "Nicolás Álvarez", "Mónica Peralta", "Santiago Ríos", "Daniela Castro", "Tomás Villalba"],
];

const TEACHERS: Teacher[] = [];
TEACHER_NAMES.forEach((names, faculty) =>
  names.forEach((name) =>
    TEACHERS.push({
      id: `doc-d${String(TEACHERS.length + 1).padStart(2, "0")}`,
      name,
      faculty,
      bias: clamp(gauss() * 3, -6, 6),
    }),
  ),
);

interface Quarter {
  id: string;
  start: string;
  end: string;
  index: number;
}

const QUARTERS: Quarter[] = [
  { id: "2024-1C", start: "2024-03-11", end: "2024-07-26", index: 0 },
  { id: "2024-2C", start: "2024-08-05", end: "2024-12-13", index: 1 },
  { id: "2025-1C", start: "2025-03-10", end: "2025-07-25", index: 2 },
  { id: "2025-2C", start: "2025-08-04", end: "2025-12-12", index: 3 },
  { id: "2026-1C", start: "2026-03-09", end: "2026-07-24", index: 4 },
  { id: "2026-2C", start: "2026-08-03", end: "2026-12-18", index: 5 },
];
const CURRENT_QUARTER = 5;

// ---------------------------------------------------------------------------------------------
// Backoffice: sedes y docentes
// ---------------------------------------------------------------------------------------------

function generateBackofficeCatalog(): void {
  SEDES.forEach((sede, index) =>
    emit(`sede-${sede.short}`, "backoffice", "sede.definida", at(2024, 1, 8, 9, index), { sedeId: sede.id, nombre: sede.name }),
  );
  TEACHERS.forEach((teacher, index) =>
    emit(`docente-${teacher.id}`, "backoffice", "docente.alta", at(2024, 1, 10 + (index % 20), 9 + (index % 6), index), {
      docenteId: teacher.id,
      nombre: teacher.name,
      facultad: FACULTIES[teacher.faculty].name,
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Académico
// ---------------------------------------------------------------------------------------------

interface Course {
  id: string;
  subject: Subject;
  sede: Sede;
  comision: string;
  teacher: Teacher;
  rate: number;
  students: string[];
  // Curso de promoción directa: publica resultados antes del cierre del cuatrimestre en curso.
  promo: boolean;
}

const alumnoFaculty = new Map<string, number>();
const alumnoIdOf = (sedeIndex: number, n: number) => `al-${(sedeIndex + 1) * 10000 + n}`;

function facultyOfAlumno(alumnoId: string): number {
  let faculty = alumnoFaculty.get(alumnoId);
  if (faculty === undefined) {
    faculty = weighted(FACULTIES.map((f, i) => [i, f.share] as const));
    alumnoFaculty.set(alumnoId, faculty);
  }
  return faculty;
}

function buildCourses(quarter: Quarter): Course[] {
  const courses: Course[] = [];
  const qi = quarter.index;
  const yy = quarter.id.slice(2, 4);
  const facultySubjects = FACULTIES.map((_, f) => SUBJECTS.filter((s) => s.faculty === f));

  for (const subject of SUBJECTS) {
    if ((subject.since ?? 0) > qi) continue;
    const subjectIndex = facultySubjects[subject.faculty].indexOf(subject);
    const facultyTeachers = TEACHERS.filter((t) => t.faculty === subject.faculty);

    SEDES.forEach((sede, sedeIndex) => {
      if (!subject.sedes.includes(sede.code)) return;
      // Pilar y el campus online amplían su oferta con los años.
      if (sede.code === "P" && qi < 2 && subjectIndex >= 3) return;
      if (sede.code === "O" && qi < 1 && subject.popular !== true) return;

      const commissions = subject.popular && (sede.code === "C" || (sede.code === "B" && qi >= 3)) ? ["A", "B"] : ["A"];
      commissions.forEach((comision, commIndex) => {
        const teacher = facultyTeachers[(subjectIndex * 2 + sedeIndex + commIndex + Math.floor(qi / 2)) % facultyTeachers.length];
        const rate = clamp(
          subject.base + subject.trend * qi + sede.rateDelta + FACULTIES[subject.faculty].rateDelta + teacher.bias + gauss() * 1.2,
          15,
          92,
        );
        courses.push({
          id: `cur-${yy}${quarter.id.slice(5)}-${subject.code}-${sede.short}-${comision}`,
          subject,
          sede,
          comision,
          teacher,
          rate,
          students: [],
          promo: qi === CURRENT_QUARTER && chance(0.35),
        });
      });
    });
  }
  return courses;
}

const NOTAS_APROBADO: readonly (readonly [number, number])[] = [[4, 0.16], [5, 0.13], [6, 0.17], [7, 0.2], [8, 0.17], [9, 0.1], [10, 0.07]];
const NOTAS_DESAPROBADO: readonly (readonly [number, number])[] = [[1, 0.2], [2, 0.35], [3, 0.45]];

function generateAcademic(): void {
  for (const quarter of QUARTERS) {
    const qi = quarter.index;
    const startMs = dateMs(quarter.start);
    const endMs = dateMs(quarter.end);

    emit(`cuatri-${quarter.id}`, "gestion-academica", "cuatrimestre.definido", startMs - 25 * DAY + 10 * HOUR, {
      cuatrimestre: quarter.id,
      inicio: quarter.start,
      fin: quarter.end,
    });

    const courses = buildCourses(quarter);
    const coursesBySede = new Map<string, Course[]>(SEDES.map((s) => [s.id, courses.filter((c) => c.sede.id === s.id)]));

    // Inscripciones: cada alumno activo cursa 2-4 materias de su sede, con preferencia por su facultad.
    SEDES.forEach((sede, sedeIndex) => {
      const sedeCourses = coursesBySede.get(sede.id) ?? [];
      const pool = sede.pool * STUDENT_SCALE;
      const first = Math.floor(pool * 0.06 * qi) + 1;
      const activeCount = Math.round(pool * (0.5 + 0.05 * qi));
      for (let n = first; n < first + activeCount; n += 1) {
        const alumnoId = alumnoIdOf(sedeIndex, n);
        const faculty = facultyOfAlumno(alumnoId);
        const own = sedeCourses.filter((c) => c.subject.faculty === faculty);
        const wanted = pick([2, 3, 3, 4]);
        const picked = new Set<string>();
        for (let attempt = 0; attempt < 14 && picked.size < wanted; attempt += 1) {
          const pool = chance(0.78) && own.length > 0 ? own : sedeCourses;
          const course = pick(pool);
          if (picked.has(course.subject.code)) continue;
          picked.add(course.subject.code);
          course.students.push(alumnoId);
        }
      }
    });

    for (const course of courses) {
      const { subject, sede, teacher } = course;
      const openedAt = startMs - (10 + rand() * 10) * DAY + 9 * HOUR;
      const cupo = Math.max(30, Math.ceil((course.students.length * 1.25) / 5) * 5);

      emit(`curso-abierto-${course.id}`, "gestion-academica", "curso.abierto", openedAt, {
        cursoId: course.id,
        materia: subject.code,
        nombreMateria: subject.name,
        facultad: FACULTIES[subject.faculty].name,
        comision: course.comision,
        sedeId: sede.id,
        cuatrimestre: quarter.id,
        cupo,
      });
      emit(`curso-creado-${course.id}`, "portal-docente", "curso.creado", startMs - (22 + rand() * 8) * DAY + 11 * HOUR, {
        cursoId: course.id,
        docenteId: teacher.id,
        materia: subject.code,
        comision: course.comision,
        sedeId: sede.id,
        cuatrimestre: quarter.id,
      });

      // Inscripciones y bajas: la baja siempre es posterior a la confirmación.
      const finishers: string[] = [];
      for (const alumnoId of course.students) {
        const confirmedAt = startMs + (-14 + 24 * rand() ** 1.4) * DAY + (8 + rand() * 14) * HOUR;
        emit(`insc-${course.id}-${alumnoId}`, "portal-estudiante", "inscripcion.confirmada", confirmedAt, {
          alumnoId,
          cursoId: course.id,
          materia: subject.code,
          sedeId: sede.id,
          cuatrimestre: quarter.id,
        });
        if (chance(sede.code === "O" ? 0.06 : 0.035)) {
          emit(`cancel-${course.id}-${alumnoId}`, "portal-estudiante", "inscripcion.cancelada", Math.max(confirmedAt, startMs) + (3 + rand() * 27) * DAY, {
            alumnoId,
            cursoId: course.id,
            sedeId: sede.id,
            cuatrimestre: quarter.id,
            motivo: pick(["Superposición horaria", "Motivos laborales", "Cambio de carrera", "Motivos personales"]),
          });
        } else {
          finishers.push(alumnoId);
        }
      }

      // Resultados: los cuatrimestres cerrados publican todo; el actual, solo los cursos de promoción directa.
      const publishes = qi < CURRENT_QUARTER || course.promo;
      if (!publishes) continue;

      const resultsAt =
        qi < CURRENT_QUARTER ? endMs + (2 + rand() * 10) * DAY + (10 + rand() * 8) * HOUR : at(2026, 10, 5 + randInt(0, 14), 10 + randInt(0, 7));
      const approvedCount = clamp(Math.round(finishers.length * (course.rate / 100) + gauss() * 0.8), 0, finishers.length);
      const order = shuffle(finishers);

      order.forEach((alumnoId, index) => {
        const approved = index < approvedCount;
        const publishedAt = resultsAt + index * 7 * MIN;
        const nota = weighted(approved ? NOTAS_APROBADO : NOTAS_DESAPROBADO);
        emit(`res-${course.id}-${alumnoId}`, "gestion-academica", "resultado.publicado", publishedAt, {
          alumnoId,
          cursoId: course.id,
          materia: subject.code,
          comision: course.comision,
          docenteId: teacher.id,
          sedeId: sede.id,
          cuatrimestre: quarter.id,
          notaFinal: nota,
          estado: approved ? "APROBADO" : "DESAPROBADO",
          aprobado: approved,
          fechaResultado: argDate(publishedAt),
        });
        // El portal docente solo registra las actas de los últimos dos cuatrimestres cerrados.
        if (qi === 3 || qi === 4) {
          emit(`acta-${course.id}-${alumnoId}`, "portal-docente", "acta.cerrada", publishedAt - 2 * HOUR, {
            cursoId: course.id,
            alumnoId,
            nota,
            aprobado: approved,
          });
        }
        // Correcciones: casi siempre un desaprobado que pasa a aprobado tras revisar el examen.
        if (chance(0.016)) {
          const flipToApproved = !approved && chance(0.85);
          const flipToFailed = approved && chance(0.15);
          if (flipToApproved || flipToFailed) {
            emit(`resmod-${course.id}-${alumnoId}`, "gestion-academica", "resultado.modificado", publishedAt + (4 + rand() * 14) * DAY, {
              alumnoId,
              cursoId: course.id,
              notaFinal: flipToApproved ? 4 : 3,
              estado: flipToApproved ? "APROBADO" : "DESAPROBADO",
              aprobado: flipToApproved,
              motivo: pick(["Revisión de examen", "Error de carga de nota", "Recuperatorio"]),
            });
          }
        }
      });

      // Cierre del curso unas semanas después de publicar las notas (los cursos en curso siguen abiertos).
      if (qi < CURRENT_QUARTER) {
        emit(`curso-cerrado-${course.id}`, "gestion-academica", "curso.cerrado", resultsAt + (8 + rand() * 12) * DAY, {
          cursoId: course.id,
          sedeId: sede.id,
          cuatrimestre: quarter.id,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Financiero
// ---------------------------------------------------------------------------------------------

// Dic 2025 a Nov 2026; el mes en curso termina hoy.
const FINANCE_MONTHS: { year: number; month: number }[] = Array.from({ length: 12 }, (_, i) => {
  const index = 11 + i;
  return { year: 2025 + Math.floor(index / 12), month: (index % 12) + 1 };
});

interface Span {
  start: number;
  end: number;
  // Fracción del mes transcurrida (1 salvo el mes en curso).
  frac: number;
  index: number;
  year: number;
  month: number;
  ym: string;
  // Inflación acumulada desde Dic 2025.
  infl: number;
}

const SPANS: Span[] = FINANCE_MONTHS.map(({ year, month }, index) => {
  const start = at(year, month, 1, 0);
  const full = at(year, month + 1, 1, 0);
  const end = Math.min(full, NOW);
  return { start, end, frac: (end - start) / (full - start), index, year, month, ym: `${year}-${String(month).padStart(2, "0")}`, infl: 1.022 ** index };
});

// Estacionalidad del uso del campus: poco en verano, pico en el cursado.
const SEASON: Record<number, number> = { 1: 0.22, 2: 0.4, 3: 0.9, 4: 1, 5: 1.05, 6: 1, 7: 0.7, 8: 0.95, 9: 1.05, 10: 1.05, 11: 1, 12: 0.7 };

// Un instante al azar dentro del tramo, de lunes a viernes (o cualquier día) y entre dos horas; null si no entra antes de NOW.
function randomMoment(span: Span, hourMin: number, hourMax: number, weekdaysOnly = true): number | null {
  const days = Math.max(1, Math.floor((span.end - span.start) / DAY));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ms = span.start + Math.floor(rand() * days) * DAY + (hourMin + rand() * (hourMax - hourMin)) * HOUR;
    const weekday = argWeekday(ms);
    if (weekdaysOnly && (weekday === 0 || weekday === 6)) continue;
    if (ms <= NOW && ms < span.end + DAY) return ms;
  }
  return null;
}

const round50 = (value: number) => Math.round(value / 50) * 50;
const round1000 = (value: number) => Math.round(value / 1000) * 1000;

function generateCoreMovements(): void {
  for (const span of SPANS) {
    for (const sede of SEDES) {
      const loads = around(52 * sede.weight * SEASON[span.month] * span.frac);
      let income = 0;
      for (let i = 0; i < loads; i += 1) {
        const ms = randomMoment(span, 8, 21, false);
        if (ms === null) continue;
        const amount = round1000(Math.exp(gauss() * 0.5) * 180_000 * span.infl);
        income += amount;
        emit(`saldo-carga-${span.ym}-${sede.short}-${i}`, "core", "saldo.movimiento", ms, {
          cuentaId: `cta-${sede.short.toLowerCase()}-${randInt(1000, 9999)}`,
          tipo: "carga",
          monto: amount,
          origen: pick(["tienda", "comedor", "comedor", "evento"]),
          sedeId: sede.id,
          fecha: argDate(ms),
        });
      }

      // Los egresos (cobros, restituciones, acreditaciones y multas) rondan el 80-95% de lo cargado.
      const outflows = Math.max(1, Math.round(loads * 2.2));
      const target = income * (0.8 + rand() * 0.15);
      const rawAmounts = Array.from({ length: outflows }, () => Math.exp(gauss() * 0.6));
      const rawTotal = rawAmounts.reduce((sum, value) => sum + value, 0);
      for (let i = 0; i < outflows; i += 1) {
        const ms = randomMoment(span, 8, 21, false);
        if (ms === null) continue;
        const tipo = weighted([["cobro", 0.66], ["restitucion", 0.17], ["acreditacion", 0.12], ["multa", 0.05]] as const);
        const origen =
          tipo === "multa"
            ? "biblioteca"
            : tipo === "restitucion"
              ? "comedor"
              : weighted([["comedor", 0.5], ["tienda", 0.35], ["evento", 0.15]] as const);
        emit(`saldo-egreso-${span.ym}-${sede.short}-${i}`, "core", "saldo.movimiento", ms, {
          cuentaId: `cta-${sede.short.toLowerCase()}-${randInt(1000, 9999)}`,
          tipo,
          monto: Math.max(500, round50((rawAmounts[i] / rawTotal) * target)),
          origen,
          sedeId: sede.id,
          fecha: argDate(ms),
        });
      }
    }
  }
}

const SUELDOS_DOCENTES_CENTRO = 41_500_000;

function generateBackofficeExpenses(): void {
  const gastos: { categoria: string; base: number; probability: number; weightPower: number }[] = [
    { categoria: "Mantenimiento edilicio", base: 1_200_000, probability: 1, weightPower: 1 },
    { categoria: "Servicios (luz, gas, agua)", base: 3_500_000, probability: 1, weightPower: 1 },
    { categoria: "Obras y refacciones", base: 5_500_000, probability: 0.4, weightPower: 1 },
    { categoria: "Licencias de software", base: 2_200_000, probability: 1, weightPower: 0.5 },
    { categoria: "Sistemas y plataformas", base: 1_500_000, probability: 0.9, weightPower: 0.5 },
    { categoria: "Becas y bonificaciones", base: 6_000_000, probability: 1, weightPower: 1 },
    { categoria: "Infraestructura de red", base: 1_100_000, probability: 0.8, weightPower: 0.8 },
    { categoria: "Limpieza y seguridad", base: 2_800_000, probability: 1, weightPower: 1 },
    { categoria: "Marketing y difusión", base: 900_000, probability: 0.7, weightPower: 0.7 },
    { categoria: "Insumos de oficina", base: 400_000, probability: 0.8, weightPower: 1 },
  ];

  for (const span of SPANS) {
    for (const sede of SEDES) {
      // Sueldos del período, liquidados a principios del mes; junio y diciembre llevan aguinaldo.
      const aguinaldo = span.month === 6 || span.month === 12 ? 1.5 : 1;
      const online = sede.code === "O";
      const docentes = round1000(SUELDOS_DOCENTES_CENTRO * sede.weight * 0.9 * span.infl * aguinaldo * (1 + gauss() * 0.01));
      const administrativos = round1000(docentes * (online ? 0.15 : 0.34) * (1 + gauss() * 0.02));
      emit(`sueldos-${span.ym}-${sede.short}`, "backoffice", "sueldos.liquidados", at(span.year, span.month, 2, 18, 0), {
        periodo: span.ym,
        sedeId: sede.id,
        monto: docentes + administrativos,
        desglose: { docentes, administrativos },
      });

      for (const gasto of gastos) {
        if (!chance(gasto.probability) || (online && /edilicio|Obras|Limpieza|Servicios|Insumos/.test(gasto.categoria))) continue;
        const ms = randomMoment(span, 9, 17);
        if (ms === null) continue;
        const amount = round1000(gasto.base * sede.weight ** gasto.weightPower * span.infl * Math.exp(gauss() * 0.25));
        emit(`gasto-${span.ym}-${sede.short}-${gasto.categoria.slice(0, 6)}`, "backoffice", "gasto.registrado", ms, {
          categoria: gasto.categoria,
          monto: amount,
          sedeId: sede.id,
          fecha: argDate(ms),
        });
      }
    }
  }
}

const PRODUCTS = [
  { name: "Cuaderno universitario", cat: "papelería", price: 3800, weight: 22, maxUnits: 4 },
  { name: "Lapicera UADE", cat: "papelería", price: 1200, weight: 20, maxUnits: 5 },
  { name: "Resaltadores x4", cat: "papelería", price: 2900, weight: 9, maxUnits: 2 },
  { name: "Carpeta A4", cat: "papelería", price: 6500, weight: 7, maxUnits: 2 },
  { name: "Calculadora científica", cat: "tecnología", price: 38000, weight: 3, maxUnits: 1 },
  { name: "Pendrive 64GB", cat: "tecnología", price: 14500, weight: 4, maxUnits: 1 },
  { name: "Auriculares", cat: "tecnología", price: 24000, weight: 2, maxUnits: 1 },
  { name: "Buzo UADE", cat: "indumentaria", price: 45000, weight: 7, maxUnits: 2 },
  { name: "Remera UADE", cat: "indumentaria", price: 18500, weight: 8, maxUnits: 2 },
  { name: "Gorra UADE", cat: "indumentaria", price: 12000, weight: 3, maxUnits: 1 },
  { name: "Mochila UADE", cat: "accesorios", price: 52000, weight: 2.5, maxUnits: 1 },
  { name: "Botella térmica", cat: "accesorios", price: 21000, weight: 6, maxUnits: 1 },
  { name: "Taza UADE", cat: "accesorios", price: 8500, weight: 4, maxUnits: 2 },
];

// Estacionalidad por categoría: útiles al empezar cada cuatrimestre, abrigo en invierno, gorras en verano.
function productWeight(product: (typeof PRODUCTS)[number], month: number): number {
  let factor = 1;
  if (product.cat === "papelería" && (month === 3 || month === 8)) factor = 1.8;
  if (product.name === "Buzo UADE" && month >= 4 && month <= 7) factor = 2.2;
  if (product.name === "Gorra UADE" && (month === 11 || month === 12 || month === 1)) factor = 2.5;
  return product.weight * factor;
}

interface PurchaseItem {
  producto: string;
  categoria: string;
  unidades: number;
  monto: number;
}

function generateStore(): void {
  for (const span of SPANS) {
    for (const sede of SEDES) {
      const purchases = around(95 * sede.weight * SEASON[span.month] * span.frac);
      for (let i = 0; i < purchases; i += 1) {
        const ms = randomMoment(span, 9, 20);
        if (ms === null) continue;

        const chosen = new Set<string>();
        const items: PurchaseItem[] = [];
        const lines = weighted([[1, 0.55], [2, 0.3], [3, 0.15]] as const);
        for (let l = 0; l < lines; l += 1) {
          const product = weighted(PRODUCTS.map((p) => [p, productWeight(p, span.month)] as const));
          if (chosen.has(product.name)) continue;
          chosen.add(product.name);
          const units = randInt(1, product.maxUnits);
          items.push({ producto: product.name, categoria: product.cat, unidades: units, monto: units * round50(product.price * span.infl) });
        }
        const compraId = `co-${span.ym}-${sede.short}-${i}`;
        emit(`compra-${compraId}`, "tienda", "compra.realizada", ms, {
          compraId,
          sedeId: sede.id,
          fecha: argDate(ms),
          total: items.reduce((sum, item) => sum + item.monto, 0),
          items,
        });

        // Devoluciones ocasionales: una unidad de un ítem, dentro de los 10 días siguientes.
        if (chance(0.025)) {
          const item = pick(items);
          const returnedAt = ms + (1 + rand() * 9) * DAY;
          emit(`devolucion-${compraId}`, "tienda", "compra.devuelta", returnedAt, {
            compraId,
            sedeId: sede.id,
            fecha: argDate(returnedAt),
            items: [{ producto: item.producto, categoria: item.categoria, unidades: 1, monto: item.monto / item.unidades }],
          });
        }
      }
    }
  }
}

function generateDining(): void {
  const turnos = ["12:00", "12:45", "13:30"];
  for (const span of SPANS) {
    const price = round50(7200 * span.infl);
    const days = Math.ceil((span.end - span.start) / DAY);
    for (let d = 0; d < days; d += 1) {
      const dayStart = span.start + d * DAY;
      const weekday = argWeekday(dayStart + 12 * HOUR);
      if (weekday === 0 || weekday === 6) continue;
      const dowFactor = weekday === 1 || weekday === 5 ? 0.85 : 1.05;

      for (const sede of IN_PERSON) {
        const reservations = around(9 * sede.weight * SEASON[span.month] * dowFactor);
        for (let i = 0; i < reservations; i += 1) {
          const turno = pick(turnos);
          const [turnoH, turnoM] = turno.split(":").map(Number);
          const turnoAt = dayStart + (turnoH + turnoM / 60) * HOUR;
          // Se reserva a la mañana del mismo día o a la tarde-noche anterior.
          const confirmedAt = chance(0.35) ? dayStart - DAY + (17 + rand() * 5) * HOUR : dayStart + (7.5 + rand() * 3.5) * HOUR;
          const reservaId = `rs-${argDate(dayStart)}-${sede.short}-${i}`;
          if (
            !emit(`reserva-${reservaId}`, "comedor", "reserva.confirmada", confirmedAt, {
              reservaId,
              monto: price,
              sedeId: sede.id,
              turno,
              fecha: argDate(dayStart),
            })
          ) {
            continue;
          }
          const outcome = rand();
          if (outcome < 0.87) {
            emit(`asistida-${reservaId}`, "comedor", "reserva.asistida", turnoAt + (5 + rand() * 40) * MIN, {
              reservaId,
              montoRestituido: round50(price * 0.15),
              sedeId: sede.id,
            });
          } else if (outcome < 0.93) {
            emit(`cancelada-${reservaId}`, "comedor", "reserva.cancelada", Math.min(confirmedAt + (30 + rand() * 150) * MIN, turnoAt - 15 * MIN), {
              reservaId,
              montoDevuelto: price,
              sedeId: sede.id,
            });
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Eventos académicos y biblioteca
// ---------------------------------------------------------------------------------------------

const EVENT_TYPES = [
  { tipo: "charla", cupo: 80, show: 0.72, hour: 18.5, costos: [0], weight: 0.32, online: true, weekend: false },
  { tipo: "jornada", cupo: 120, show: 0.8, hour: 10, costos: [0, 0, 3000], weight: 0.2, online: true, weekend: false },
  { tipo: "workshop", cupo: 25, show: 0.9, hour: 17, costos: [9000, 12000], weight: 0.22, online: true, weekend: false },
  { tipo: "deportivo", cupo: 40, show: 0.66, hour: 19, costos: [0, 1500], weight: 0.14, online: false, weekend: true },
  { tipo: "feria", cupo: 150, show: 0.58, hour: 11, costos: [0], weight: 0.12, online: false, weekend: true },
];
const LOCACIONES: Record<string, string[]> = {
  charla: ["Auditorio", "Aula Magna"],
  jornada: ["Hall central", "Auditorio"],
  workshop: ["Laboratorio", "Aula 204", "Sala de talleres"],
  deportivo: ["Gimnasio", "Polideportivo"],
  feria: ["Hall central", "Patio"],
};

function generateEvents(): void {
  const eventSedes = [
    { sede: SEDES[0], base: 3.4 },
    { sede: SEDES[1], base: 2.3 },
    { sede: SEDES[2], base: 1.5 },
    { sede: SEDES[3], base: 1.8 },
  ];
  for (const span of SPANS) {
    const isCurrent = span.frac < 1;
    for (const { sede, base } of eventSedes) {
      let scheduled = around(base * SEASON[span.month] * span.frac * (span.month === 1 ? 0.6 : 1));
      // En el mes en curso, al menos un evento en las sedes principales para que el tablero no quede vacío.
      if (isCurrent && sede.code !== "P" && sede.code !== "O") scheduled = Math.max(scheduled, 1);

      for (let k = 0; k < scheduled; k += 1) {
        const type = weighted(EVENT_TYPES.filter((t) => sede.code !== "O" || t.online).map((t) => [t, t.weight] as const));
        const eventoId = `ev-${span.ym}-${sede.short}-${k}`;

        if (chance(0.06)) {
          const ms = randomMoment(span, 9, 18);
          if (ms !== null) {
            emit(`evcancel-${eventoId}`, "eventos", "evento.cancelado", ms, {
              eventoId,
              sedeId: sede.id,
              motivo: pick(["Falta de inscriptos", "Disertante no disponible", "Condiciones climáticas"]),
            });
          }
          continue;
        }

        const ms = randomMoment(span, type.hour, type.hour + 0.01, !type.weekend);
        if (ms === null) continue;
        const cupo = Math.round((type.cupo * (0.85 + rand() * 0.4)) / 5) * 5;
        const costo = pick(type.costos);
        emit(`evreal-${eventoId}`, "eventos", "evento.realizado", ms, {
          eventoId,
          tipoEvento: type.tipo,
          locacion: sede.code === "O" ? "Zoom" : pick(LOCACIONES[type.tipo]),
          cupo,
          sedeId: sede.id,
          fecha: argDate(ms),
          costo,
        });

        const registrants = new Set<string>();
        const target = Math.min(cupo, Math.round(cupo * (0.55 + rand() * 0.45)));
        while (registrants.size < target) registrants.add(`per-${randInt(1, 5000)}`);

        const attending: string[] = [];
        let n = 0;
        for (const personaId of registrants) {
          n += 1;
          const confirmedAt = ms - (1 + rand() * 12) * DAY;
          emit(`evinsc-${eventoId}-${n}`, "eventos", "inscripcion.confirmada", confirmedAt, { eventoId, personaId, monto: costo });
          if (chance(0.04)) {
            emit(`evinsccancel-${eventoId}-${n}`, "eventos", "inscripcion.cancelada", confirmedAt + (0.5 + rand() * 4) * DAY, {
              eventoId,
              personaId,
              montoDevuelto: costo,
            });
          } else {
            attending.push(personaId);
          }
        }

        // Asistencia con presentismo propio de cada tipo, estratificada para que no oscile demasiado.
        const show = clamp(type.show + gauss() * 0.05, 0.3, 0.97);
        const presentCount = Math.round(attending.length * show);
        shuffle(attending).forEach((personaId, index) => {
          emit(`evasis-${eventoId}-${personaId}`, "eventos", "asistencia.registrada", ms + (10 + rand() * 50) * MIN, {
            eventoId,
            personaId,
            presente: index < presentCount,
          });
        });
      }
    }
  }
}

function generateLibrary(): void {
  for (const span of SPANS) {
    SEDES.forEach((sede, sedeIndex) => {
      const loans = around(14 * sede.weight * SEASON[span.month] * span.frac);
      for (let i = 0; i < loans; i += 1) {
        const ms = randomMoment(span, 9, 19);
        if (ms === null) continue;
        const prestamoId = `pr-${span.ym}-${sede.short}-${i}`;
        const dueAt = ms + 14 * DAY;
        emit(`prestamo-${prestamoId}`, "biblioteca", "prestamo.realizado", ms, {
          prestamoId,
          alumnoId: alumnoIdOf(sedeIndex, randInt(1, Math.round(sede.pool * STUDENT_SCALE))),
          materialId: `978-950-${randInt(1000, 9999)}-${randInt(100, 999)}-${randInt(0, 9)}`,
          sedeId: sede.id,
          fechaVencimiento: argDate(dueAt),
        });
        if (chance(0.88)) {
          const late = chance(0.15);
          const returnedAt = late ? dueAt + (1 + rand() * 12) * DAY : ms + (2 + rand() * 11) * DAY;
          emit(`devuelto-${prestamoId}`, "biblioteca", "prestamo.devuelto", returnedAt, { prestamoId, sedeId: sede.id, conDemora: late });
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Validación e inserción
// ---------------------------------------------------------------------------------------------

function assertAllValid(): void {
  for (const event of events) {
    const problems = validateEventPayload(event.sourceModule, event.eventType, event.payload);
    if (!problems || problems.missing.length || problems.invalid.length) {
      throw new Error(`Evento demo inválido (${event.eventId}): ${JSON.stringify(problems)}`);
    }
    if (event.occurredAt.getTime() > NOW) throw new Error(`Evento demo en el futuro: ${event.eventId}`);
  }
}

const BATCH_SIZE = 5000;

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    if (process.argv.includes("--clear")) {
      const { count } = await prisma.inboxEvent.deleteMany({ where: { eventId: { startsWith: "demo-" } } });
      console.log(`Demo borrado: ${count} eventos demo-*.`);
      return;
    }

    generateBackofficeCatalog();
    generateAcademic();
    generateCoreMovements();
    generateBackofficeExpenses();
    generateStore();
    generateDining();
    generateEvents();
    generateLibrary();
    assertAllValid();

    const byModule = new Map<string, number>();
    for (const event of events) byModule.set(event.sourceModule, (byModule.get(event.sourceModule) ?? 0) + 1);

    // Se insertan en orden cronológico, como llegarían de verdad: cada tipo queda agrupado por época en la tabla.
    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.eventId.localeCompare(b.eventId));

    let inserted = 0;
    for (let offset = 0; offset < events.length; offset += BATCH_SIZE) {
      const batch = events.slice(offset, offset + BATCH_SIZE).map((event) => ({
        eventId: event.eventId,
        sourceModule: event.sourceModule,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        // La historia demo se "recibió" cuando ocurrió.
        receivedAt: event.occurredAt,
        payload: event.payload as Prisma.InputJsonObject,
      }));
      const result = await prisma.inboxEvent.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
    }

    console.log(`Demo listo: ${events.length} eventos generados, ${inserted} insertados nuevos.`);
    for (const [module, total] of [...byModule].sort((a, b) => b[1] - a[1])) console.log(`  ${module.padEnd(18)} ${total}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
