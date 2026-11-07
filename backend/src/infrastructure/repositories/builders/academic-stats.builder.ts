// Arma el tablero académico (docs/INTEGRACION.md, 6.1): resultados de curso del inbox + cursos, catálogo y
// docentes de los gateways. Si un gateway falla, el bloque afectado sale vacío y se anota un warning.
import { PrismaClient } from "@prisma/client";
import {
  AcademicStats,
  FacultyTrendSeries,
  SubjectApprovalRate,
  TeacherApprovalRate,
} from "../../../domain/entities/academic-stats.entity";
import { createDelta, createNeutralDelta, Delta } from "../../../domain/entities/delta.value-object";
import { AcademicFilters } from "../../../domain/entities/filters.entity";
import { KpiCard } from "../../../domain/entities/kpi.value-object";
import { Period } from "../../../domain/entities/period.entity";
import { Site } from "../../../domain/entities/site.entity";
import { AcademicCatalog, AcademicCatalogService } from "../../../application/services/academic-catalog.service";
import { AcademicCourse, AcademicGateway, AcademicPeriod, AcademicSite } from "../../../domain/gateways/academic.gateway";
import { BackofficeGateway } from "../../../domain/gateways/backoffice.gateway";
import { periodWindow, quarterIdOf } from "../../../domain/services/period-catalog.service";
import { FACULTY_COLORS, SERIES_LENGTH } from "../../config/dashboard.config";
import { CourseResultRow, queryCourseResults } from "../queries/academic.queries";
import { mapLimit } from "./concurrency";
import { count, findSite, growth, percentage } from "./format";
import { SourceMeta } from "./source-meta.builder";
import { describeFailure, WarningCollector } from "./warning-collector";

export interface AcademicGateways {
  academic: AcademicGateway;
  backoffice: BackofficeGateway;
  catalog: AcademicCatalogService;
}

export interface AcademicContext {
  sites: Site[];
  quarters: Period[];
  // Períodos de G9 ya leídos al armar los catálogos (vacío si G9 falló; el aviso ya está en `warnings`).
  periods: AcademicPeriod[];
  gateways: AcademicGateways;
  warnings: WarningCollector;
  meta: SourceMeta;
}

// Estados de curso que cuentan como "en curso" (docs/INTEGRACION.md, 6.1).
const ACTIVE_STATES = new Set(["EN_CURSO", "FINALIZADO"]);
// Llamadas simultáneas al pedir el detalle de cursos (cuida el rate limit de G9).
const DETAIL_CONCURRENCY = 6;
const EMPTY_CATALOG: AcademicCatalog = { subjects: new Map(), faculties: [] };

interface Tally {
  total: number;
  approved: number;
}

// Un resultado agrupado ya cruzado con el catálogo.
interface ResultLine extends CourseResultRow {
  quarter: string;
  code: string;
  name: string;
  faculty: string | null;
}

const add = (tally: Tally | undefined, row: Tally): Tally => ({
  total: (tally?.total ?? 0) + row.total,
  approved: (tally?.approved ?? 0) + row.approved,
});
const rateOf = (tally: Tally | undefined): number | undefined => (tally && tally.total > 0 ? percentage(tally.approved, tally.total) : undefined);

// Variación de un conteo en unidades; neutra si no hay período anterior o no tenía actividad.
function countDelta(current: number | null, previous: number | null | undefined): Delta {
  return current !== null && previous ? createDelta(current - previous, { integer: true }) : createNeutralDelta({ integer: true });
}

// Variación de una tasa en pp; neutra si falta el dato de alguno de los dos períodos.
function rateDelta(current: number | undefined, previous: number | undefined): Delta {
  return current === undefined || previous === undefined
    ? createNeutralDelta({ suffix: " pp" })
    : createDelta(current - previous, { suffix: " pp" });
}

// Tarjeta de conteo: null = la fuente no respondió (value 0 y "—").
function countKpi(id: string, label: string, unit: string, now: number | null, delta: Delta, note?: string): KpiCard {
  return { id, label, value: now ?? 0, formattedValue: now === null ? "—" : count(now), unit, delta, ...(note ? { note } : {}) };
}

export async function buildAcademicStats(prisma: PrismaClient, filters: AcademicFilters, context: AcademicContext): Promise<AcademicStats> {
  const { academic, backoffice, catalog: catalogService } = context.gateways;
  const warnings = context.warnings;
  const site = findSite(context.sites, filters.siteId);
  const siteId = site.isAggregate ? null : site.id;
  const facultad = filters.facultyId;
  const quarter = filters.quarter;
  const { quarters } = context;

  // Sin el cuatrimestre en el catálogo (G9 no respondió) no hay anterior ni ventana: sólo el elegido.
  const current = quarters.findIndex((candidate) => candidate.id === quarter);
  const previousId = current > 0 ? quarters[current - 1].id : null;
  const compared = current >= 0 ? periodWindow(quarters, current, 3).map((candidate) => candidate.id) : [quarter];
  const trendQuarters = current >= 0 ? periodWindow(quarters, current, SERIES_LENGTH).map((candidate) => candidate.id) : [quarter];

  const periodByQuarter = new Map(context.periods.map((period) => [quarterIdOf(period), period]));
  const quarterByPeriodId = new Map(context.periods.map((period) => [String(period.id), quarterIdOf(period)]));

  const [catalogRead, sitesRead] = await Promise.all([
    warnings.guard("academic", "el catálogo de asignaturas", () => catalogService.get(), EMPTY_CATALOG),
    siteId === null
      ? Promise.resolve({ value: [] as AcademicSite[], ok: true })
      : warnings.guard("academic", "las sedes de Gestión Académica", () => academic.listSites(), [] as AcademicSite[]),
  ]);
  const subjects = catalogRead.value.subjects;
  const backofficeSiteOf = new Map(sitesRead.value.map((academicSite) => [academicSite.id, academicSite.backofficeSiteId]));

  const resultsPeriodIds = trendQuarters.flatMap((id) => (periodByQuarter.has(id) ? [String(periodByQuarter.get(id)!.id)] : []));
  const loadCourses = async (id: string | null): Promise<AcademicCourse[] | null> => {
    const period = id === null ? undefined : periodByQuarter.get(id);
    if (!period) return null;
    return (await warnings.guard("academic", `los cursos del período ${id}`, () => academic.listCourses(period.id), null)).value;
  };

  const [coursesNow, coursesBefore, resultRows] = await Promise.all([
    loadCourses(quarter),
    loadCourses(previousId),
    queryCourseResults(prisma, resultsPeriodIds, siteId),
  ]);

  // --- KPIs de cursos (G9): materias, comisiones y estudiantes sobre los cursos EN_CURSO / FINALIZADO.
  const subjectOf = (course: AcademicCourse) => subjects.get(String(course.asignaturaId));
  const matches = (course: AcademicCourse): boolean =>
    ACTIVE_STATES.has(course.estado) &&
    (siteId === null || backofficeSiteOf.get(course.sedeId) === siteId) &&
    (facultad === null || subjectOf(course)?.facultad === facultad);
  // Con una sede elegida hace falta el mapeo de sedes de G9: sin él, el conteo no es confiable.
  const usable = (courses: AcademicCourse[] | null): AcademicCourse[] | null => (sitesRead.ok ? courses?.filter(matches) ?? null : null);
  const nowCourses = usable(coursesNow);
  const beforeCourses = usable(coursesBefore);
  const subjectCount = (courses: AcademicCourse[] | null) =>
    courses === null ? null : new Set(courses.map((course) => subjectOf(course)?.codigo ?? String(course.asignaturaId))).size;
  const sumStudents = (courses: AcademicCourse[] | null) =>
    courses === null ? null : courses.reduce((total, course) => total + course.inscriptosActivos, 0);

  const subjectsNow = subjectCount(nowCourses);
  const commissionsNow = nowCourses?.length ?? null;
  const studentsNow = sumStudents(nowCourses);
  const studentsBefore = sumStudents(beforeCourses);

  // --- Resultados (evento): cruce con el catálogo para materia y facultad; el filtro de facultad se aplica acá.
  const lines: ResultLine[] = resultRows.flatMap((row) => {
    const info = subjects.get(row.subjectId);
    const faculty = info?.facultad ?? null;
    const resultQuarter = quarterByPeriodId.get(row.periodId);
    if (!resultQuarter || (facultad !== null && faculty !== facultad)) return [];

    return [{ ...row, quarter: resultQuarter, code: info?.codigo ?? row.subjectId, name: info?.nombre ?? `Asignatura ${row.subjectId}`, faculty }];
  });

  const overallAt = (id: string | null): number | undefined =>
    id === null ? undefined : rateOf(lines.filter((line) => line.quarter === id).reduce<Tally | undefined>((tally, line) => add(tally, line), undefined));
  const overall = overallAt(quarter);

  const kpis: KpiCard[] = [
    countKpi("active-subjects", "Materias en curso", "materias", subjectsNow, countDelta(subjectsNow, subjectCount(beforeCourses))),
    {
      id: "overall-approval-rate",
      label: "Tasa de aprobación general",
      value: overall ?? 0,
      formattedValue: overall === undefined ? "—" : `${overall.toFixed(1)}%`,
      unit: "",
      delta: rateDelta(overall, overallAt(previousId)),
      ...(overall === undefined
        ? {
            note: periodByQuarter.has(quarter)
              ? "Sin resultados de curso publicados en el período (evento academic.course-result.published.v1)."
              : "No se pudo resolver el cuatrimestre en Gestión Académica.",
          }
        : {}),
    },
    countKpi("active-commissions", "Comisiones activas", "comisiones", commissionsNow, countDelta(commissionsNow, beforeCourses?.length)),
    countKpi(
      "active-students",
      "Estudiantes con cursada activa",
      "",
      studentsNow,
      // A diferencia de los otros conteos, la variación de estudiantes se muestra en %.
      studentsNow !== null && studentsBefore ? createDelta(growth(studentsNow, studentsBefore), { suffix: "%" }) : createNeutralDelta({ suffix: "%" }),
      "Cuenta inscripciones activas, no alumnos distintos",
    ),
  ];

  // --- Aprobación por materia: tasa por (materia, cuatrimestre) sobre los 3 cuatrimestres comparados.
  const bySubject = new Map<string, { name: string; byQuarter: Map<string, Tally> }>();
  for (const line of lines.filter((candidate) => compared.includes(candidate.quarter))) {
    const entry = bySubject.get(line.code) ?? { name: line.name, byQuarter: new Map<string, Tally>() };
    entry.byQuarter.set(line.quarter, add(entry.byQuarter.get(line.quarter), line));
    bySubject.set(line.code, entry);
  }
  const subjectApprovalRates: SubjectApprovalRate[] = [];
  for (const [code, { name, byQuarter }] of bySubject) {
    const rate = rateOf(byQuarter.get(quarter));
    if (rate === undefined) continue;

    subjectApprovalRates.push({
      code,
      name,
      approvalRate: rate,
      series: compared.map((id) => ({ quarter: id, approvalRate: rateOf(byQuarter.get(id)) ?? 0 })),
      delta: rateDelta(rate, previousId ? rateOf(byQuarter.get(previousId)) : undefined),
    });
  }
  subjectApprovalRates.sort((a, b) => a.approvalRate - b.approvalRate || a.code.localeCompare(b.code));

  // --- Tendencia por facultad: sólo asignaturas atribuibles a una carrera del catálogo.
  const byFaculty = new Map<string, Map<string, Tally>>();
  for (const line of lines) {
    if (line.faculty === null) continue;
    const byQuarter = byFaculty.get(line.faculty) ?? new Map<string, Tally>();
    byQuarter.set(line.quarter, add(byQuarter.get(line.quarter), line));
    byFaculty.set(line.faculty, byQuarter);
  }
  const facultyTrends: FacultyTrendSeries[] = [...byFaculty]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([facultyName, byQuarter]) => {
      const latest = rateOf(byQuarter.get(quarter));

      return {
        facultyName,
        color: FACULTY_COLORS[Math.max(0, catalogRead.value.faculties.indexOf(facultyName)) % FACULTY_COLORS.length],
        points: trendQuarters.map((id) => ({ quarter: id, approvalRate: rateOf(byQuarter.get(id)) ?? 0 })),
        latestApprovalRate: latest ?? 0,
        delta: rateDelta(latest, previousId ? rateOf(byQuarter.get(previousId)) : undefined),
      };
    });

  // --- Aprobación por docente: curso → docentes (TITULAR, o todos si no hay titular) de G9.
  const teacherLines = lines.filter((line) => line.quarter === quarter || line.quarter === previousId);
  const teachersByCourse = await resolveTeachers(academic, warnings, [...(coursesNow ?? []), ...(coursesBefore ?? [])], teacherLines);

  interface TeacherAgg {
    byQuarter: Map<string, Tally>;
    subjects: Map<string, { name: string; total: number }>;
  }
  const teachers = new Map<string, TeacherAgg>();
  for (const line of teacherLines) {
    for (const teacherId of teachersByCourse.get(line.courseId) ?? []) {
      const agg = teachers.get(teacherId) ?? { byQuarter: new Map<string, Tally>(), subjects: new Map() };
      agg.byQuarter.set(line.quarter, add(agg.byQuarter.get(line.quarter), line));
      if (line.quarter === quarter) {
        const subject = agg.subjects.get(line.code) ?? { name: line.name, total: 0 };
        agg.subjects.set(line.code, { name: line.name, total: subject.total + line.total });
      }
      teachers.set(teacherId, agg);
    }
  }
  const teachersNow = [...teachers].filter(([, agg]) => agg.byQuarter.has(quarter));

  const names = await readTeacherNames(backoffice, warnings, teachersNow.map(([id]) => id));
  const teacherApprovalRates: TeacherApprovalRate[] = teachersNow
    .map(([id, agg]) => {
      const rate = rateOf(agg.byQuarter.get(quarter)) ?? 0;
      // La materia del docente es en la que más resultados publicó (desempate por nombre).
      const subject = [...agg.subjects.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"))[0];

      return {
        teacherName: names.get(id) ?? `Docente ${id.slice(0, 8)}`,
        subjectName: subject?.name ?? "—",
        approvalRate: rate,
        delta: rateDelta(rate, previousId ? rateOf(agg.byQuarter.get(previousId)) : undefined),
      };
    })
    .sort((a, b) => b.approvalRate - a.approvalRate || a.teacherName.localeCompare(b.teacherName, "es"));

  return {
    siteName: site.name,
    facultyName: facultad,
    quarter,
    previousQuarter: previousId ?? quarter,
    comparedQuarters: compared,
    kpis,
    subjectApprovalRates,
    facultyTrends,
    teacherApprovalRates,
    totalTeachersCount: teachersNow.length,
    ...(warnings.warnings ? { warnings: warnings.warnings } : {}),
    ...context.meta,
  };
}

// courseId → docenteIds. Usa `docentes` de /cursos; si G9 no lo trae, pide el detalle del curso (sólo los que
// tienen resultados). Un detalle que falla deja ese curso sin atribuir y anota un aviso.
async function resolveTeachers(
  academic: AcademicGateway,
  warnings: WarningCollector,
  courses: AcademicCourse[],
  lines: ResultLine[],
): Promise<Map<string, string[]>> {
  const byId = new Map(courses.map((course) => [String(course.id), course]));
  const pick = (docentes: { docenteId: string; rol: string }[]): string[] => {
    const titulares = docentes.filter((docente) => docente.rol === "TITULAR");
    return (titulares.length > 0 ? titulares : docentes).map((docente) => docente.docenteId);
  };

  // Sólo se atribuyen los cursos que G9 listó: sin la lista del período (cayó) no hay docentes que mostrar.
  const result = new Map<string, string[]>();
  const missing: string[] = [];
  for (const courseId of new Set(lines.map((line) => line.courseId))) {
    const course = byId.get(courseId);
    if (course?.docentes) result.set(courseId, pick(course.docentes));
    else if (course) missing.push(courseId);
  }

  let failure: string | null = null;
  await mapLimit(missing, DETAIL_CONCURRENCY, async (courseId) => {
    try {
      result.set(courseId, pick((await academic.getCourse(courseId)).docentes));
    } catch (error) {
      // Un curso sin ficha (404) simplemente no se atribuye; otros errores se avisan.
      const notFound = (error as { status?: number }).status === 404;
      if (!notFound) failure ??= describeFailure(error);
    }
  });
  if (failure) warnings.add("academic", `No se pudo leer el detalle de algunos cursos (docentes): ${failure}`);

  return result;
}

// Nombre a mostrar de cada docente (Backoffice); si falla queda "Docente <id corto>" y se anota un aviso.
async function readTeacherNames(backoffice: BackofficeGateway, warnings: WarningCollector, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let failure: string | null = null;

  await mapLimit(ids, DETAIL_CONCURRENCY, async (id) => {
    try {
      const name = await backoffice.getUserDisplayName(id);
      if (name) names.set(id, name);
    } catch (error) {
      failure ??= describeFailure(error);
    }
  });
  if (failure) warnings.add("backoffice", `No se pudo leer el nombre de algunos docentes: ${failure}`);

  return names;
}
