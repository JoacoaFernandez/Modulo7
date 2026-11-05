// Arma el tablero académico desde los eventos de inbox_events; sin eventos, KPIs en cero y listas vacías.
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
import { periodWindow } from "../../../domain/services/period-catalog.service";
import { FACULTY_COLORS, SERIES_LENGTH } from "../../config/dashboard.config";
import {
  queryActiveCommissionsCount,
  queryActiveStudentsCount,
  queryActiveSubjectsCount,
  queryFacultyApprovals,
  querySubjectApprovals,
  queryTeacherApprovals,
  queryTeachersCount,
} from "../queries/academic.queries";
import { queryFacultyNames } from "../queries/catalog.queries";
import { count, findSite, growth, indexOfPeriod, percentage } from "./format";
import { SourceMeta } from "./source-meta.builder";

export interface AcademicContext {
  sites: Site[];
  quarters: Period[];
  meta: SourceMeta;
}

// Variación de un conteo en unidades; neutra si no hay período anterior o no tenía actividad.
function countDelta(current: number, previous: number | null): Delta {
  return previous ? createDelta(current - previous, { integer: true }) : createNeutralDelta({ integer: true });
}

// Variación de una tasa en pp; neutra si falta el dato de alguno de los dos períodos.
function rateDelta(current: number | undefined, previous: number | undefined): Delta {
  return current === undefined || previous === undefined
    ? createNeutralDelta({ suffix: " pp" })
    : createDelta(current - previous, { suffix: " pp" });
}

function average(values: number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((total, value) => total + value, 0) / values.length;
}

export async function buildAcademicStats(
  prisma: PrismaClient,
  filters: AcademicFilters,
  context: AcademicContext,
): Promise<AcademicStats> {
  const site = findSite(context.sites, filters.siteId);
  const sedeId = site.isAggregate ? null : site.id;
  const { quarters } = context;
  const facultad = filters.facultyId;

  const current = indexOfPeriod(quarters, filters.quarter, "cuatrimestre");
  // Sin cuatrimestre anterior en el catálogo no hay contra qué comparar: todos los deltas quedan neutros.
  const previousId = current > 0 ? quarters[current - 1].id : null;
  // Hasta 3 cuatrimestres terminando en el elegido; con menos historia, la lista es más corta (sin repetidos).
  const compared = periodWindow(quarters, current, 3).map((quarter) => quarter.id);
  const trendQuarters = periodWindow(quarters, current, SERIES_LENGTH).map((quarter) => quarter.id);
  const quarter = filters.quarter;

  const inPrevious = <T>(query: (id: string) => Promise<T>): Promise<T | null> =>
    previousId ? query(previousId) : Promise.resolve(null);

  const [
    subjectsNow,
    subjectsBefore,
    commissionsNow,
    commissionsBefore,
    studentsNow,
    studentsBefore,
    teachersTotal,
    subjectRows,
    teacherRows,
    facultyRows,
    facultyNames,
  ] = await Promise.all([
    queryActiveSubjectsCount(prisma, quarter, sedeId, facultad),
    inPrevious((id) => queryActiveSubjectsCount(prisma, id, sedeId, facultad)),
    queryActiveCommissionsCount(prisma, quarter, sedeId, facultad),
    inPrevious((id) => queryActiveCommissionsCount(prisma, id, sedeId, facultad)),
    queryActiveStudentsCount(prisma, quarter, sedeId, facultad),
    inPrevious((id) => queryActiveStudentsCount(prisma, id, sedeId, facultad)),
    queryTeachersCount(prisma, quarter, sedeId, facultad),
    querySubjectApprovals(prisma, compared, sedeId, facultad),
    queryTeacherApprovals(prisma, compared, sedeId, facultad),
    queryFacultyApprovals(prisma, trendQuarters, sedeId, facultad),
    queryFacultyNames(prisma),
  ]);

  // Tasa por materia y cuatrimestre.
  const subjectNames = new Map<string, string>();
  const subjectRates = new Map<string, Map<string, number>>();
  for (const row of subjectRows) {
    if (row.nombre) subjectNames.set(row.materia, row.nombre);
    const byQuarter = subjectRates.get(row.materia) ?? new Map<string, number>();
    byQuarter.set(row.cuatrimestre, percentage(row.approved, row.total));
    subjectRates.set(row.materia, byQuarter);
  }

  // Materias con resultados en el cuatrimestre elegido; un cuatrimestre sin resultados de esa materia queda en 0.
  const subjectApprovalRates: SubjectApprovalRate[] = [];
  for (const [code, byQuarter] of subjectRates) {
    const rate = byQuarter.get(quarter);
    if (rate === undefined) continue;

    subjectApprovalRates.push({
      code,
      name: subjectNames.get(code) ?? code,
      approvalRate: rate,
      series: compared.map((id) => ({ quarter: id, approvalRate: byQuarter.get(id) ?? 0 })),
      delta: rateDelta(rate, previousId ? byQuarter.get(previousId) : undefined),
    });
  }
  subjectApprovalRates.sort((a, b) => a.approvalRate - b.approvalRate || a.code.localeCompare(b.code));

  // Tasa general: promedio simple de las tasas de las materias que informaron resultados en cada cuatrimestre.
  const averageAt = (id: string) =>
    average([...subjectRates.values()].flatMap((byQuarter) => byQuarter.get(id) ?? []));
  const overall = averageAt(quarter);

  const kpis: KpiCard[] = [
    {
      id: "active-subjects",
      label: "Materias en curso",
      value: subjectsNow,
      formattedValue: count(subjectsNow),
      unit: "materias",
      delta: countDelta(subjectsNow, subjectsBefore),
    },
    {
      id: "overall-approval-rate",
      label: "Tasa de aprobación general",
      value: overall ?? 0,
      formattedValue: `${(overall ?? 0).toFixed(1)}%`,
      unit: "",
      delta: rateDelta(overall, previousId ? averageAt(previousId) : undefined),
    },
    {
      id: "active-commissions",
      label: "Comisiones activas",
      value: commissionsNow,
      formattedValue: count(commissionsNow),
      unit: "comisiones",
      delta: countDelta(commissionsNow, commissionsBefore),
    },
    {
      id: "active-students",
      label: "Estudiantes con cursada activa",
      value: studentsNow,
      formattedValue: count(studentsNow),
      unit: "",
      // A diferencia de los otros conteos, la variación de estudiantes se muestra en %.
      delta: studentsBefore
        ? createDelta(growth(studentsNow, studentsBefore), { suffix: "%" })
        : createNeutralDelta({ suffix: "%" }),
    },
  ];

  // Tendencia por facultad: una serie por facultad con resultados en la ventana de cuatrimestres.
  const facultyRates = new Map<string, Map<string, number>>();
  for (const row of facultyRows) {
    const byQuarter = facultyRates.get(row.facultad) ?? new Map<string, number>();
    byQuarter.set(row.cuatrimestre, percentage(row.approved, row.total));
    facultyRates.set(row.facultad, byQuarter);
  }

  const facultyTrends: FacultyTrendSeries[] = [...facultyRates]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([facultyName, byQuarter]) => {
      const latest = byQuarter.get(quarter);

      return {
        facultyName,
        color: FACULTY_COLORS[facultyNames.indexOf(facultyName) % FACULTY_COLORS.length],
        points: trendQuarters.map((id) => ({ quarter: id, approvalRate: byQuarter.get(id) ?? 0 })),
        latestApprovalRate: latest ?? 0,
        delta: rateDelta(latest, previousId ? byQuarter.get(previousId) : undefined),
      };
    });

  // Docentes del cuatrimestre elegido, con su variación contra el anterior (neutra si no tuvo resultados).
  const previousTeacherRates = new Map(
    teacherRows
      .filter((row) => row.cuatrimestre === previousId)
      .map((row) => [row.docenteId, percentage(row.approved, row.total)]),
  );
  const teacherApprovalRates: TeacherApprovalRate[] = teacherRows
    .filter((row) => row.cuatrimestre === quarter)
    .map((row) => {
      const rate = percentage(row.approved, row.total);

      return {
        teacherName: row.nombre ?? row.docenteId,
        subjectName: subjectNames.get(row.materia) ?? row.materia,
        approvalRate: rate,
        delta: rateDelta(rate, previousTeacherRates.get(row.docenteId)),
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
    totalTeachersCount: teachersTotal,
    ...context.meta,
  };
}
