// Pisa con métricas reales (inbox_events) las del tablero académico que se derivan de eventos.
import { PrismaClient } from "@prisma/client";
import {
  AcademicStats,
  SubjectApprovalRate,
  TeacherApprovalRate,
} from "../../../domain/entities/academic-stats.entity";
import { createDelta } from "../../../domain/entities/delta.value-object";
import {
  queryActiveCommissionsCount,
  queryActiveSubjectsCount,
  querySubjectApprovals,
  queryTeacherApprovals,
} from "../queries/academic.queries";
import { MockApprovalHistory } from "./period-bases";
import { count, replaceKpi, round1 } from "./overlay-format";

const rate = (approved: number, total: number) => round1((approved * 100) / total);

export async function overlayAcademicStats(
  prisma: PrismaClient,
  base: AcademicStats,
  sedeId: string | null,
  // Historial del mock para los cuatrimestres comparados (vacío si ninguno es nuevo) y cuáles conoce el mock.
  history: MockApprovalHistory,
  mockQuarters: Set<string>,
): Promise<AcademicStats> {
  const quarters = [...new Set(base.comparedQuarters)];
  const [subjectsCount, commissionsCount, subjectRows, teacherRows] = await Promise.all([
    queryActiveSubjectsCount(prisma, base.quarter, sedeId),
    queryActiveCommissionsCount(prisma, base.quarter, sedeId),
    querySubjectApprovals(prisma, quarters, sedeId),
    queryTeacherApprovals(prisma, quarters, sedeId),
  ]);

  let { kpis, subjectApprovalRates, teacherApprovalRates } = base;

  // Materias en curso: con curso abierto y sin cerrar. El delta del mock es una heurística, se deja.
  if (subjectsCount > 0) {
    kpis = replaceKpi(kpis, "active-subjects", { value: subjectsCount, formattedValue: count(subjectsCount) });
  }

  // Comisiones activas: cursos (por sede) abiertos y sin cerrar. Mismo criterio y delta que las materias.
  if (commissionsCount > 0) {
    kpis = replaceKpi(kpis, "active-commissions", { value: commissionsCount, formattedValue: count(commissionsCount) });
  }

  // Tasa de aprobación por materia: las materias que informan resultados en el cuatrimestre elegido.
  const subjectNames = new Map<string, string>();
  const bySubject = new Map<string, Map<string, number>>();
  for (const row of subjectRows) {
    if (row.nombre) subjectNames.set(row.materia, row.nombre);
    const quartersOfSubject = bySubject.get(row.materia) ?? new Map<string, number>();
    quartersOfSubject.set(row.cuatrimestre, rate(row.approved, row.total));
    bySubject.set(row.materia, quartersOfSubject);
  }

  const subjects: SubjectApprovalRate[] = [];
  const seriesRates: number[][] = [];
  for (const [code, byQuarter] of bySubject) {
    const current = byQuarter.get(base.quarter);
    if (current === undefined) continue;

    // Cada punto: el valor real, o el del mock si el cuatrimestre es del mock y la materia figura ahí. Un
    // cuatrimestre del mock sin ninguno toma el valor del siguiente; uno nuevo sin resultados queda en 0.
    const rates = base.comparedQuarters.map((quarter) => byQuarter.get(quarter) ?? history.get(quarter)?.get(code));
    for (let index = rates.length - 2; index >= 0; index -= 1) {
      rates[index] ??= mockQuarters.has(base.comparedQuarters[index]) ? rates[index + 1] : 0;
    }
    const series = rates as number[];

    seriesRates.push(series);
    subjects.push({
      code,
      name: subjectNames.get(code) ?? code,
      approvalRate: current,
      series: base.comparedQuarters.map((quarter, index) => ({ quarter, approvalRate: series[index] })),
      delta: createDelta(current - series[series.length - 2], { suffix: " pp" }),
    });
  }

  if (subjects.length > 0) {
    subjectApprovalRates = subjects.sort((a, b) => a.approvalRate - b.approvalRate);

    // Tasa general: promedio simple de las materias, igual que el calculator.
    const average = (index: number) => seriesRates.reduce((total, s) => total + s[index], 0) / seriesRates.length;
    const overall = average(2);
    kpis = replaceKpi(kpis, "overall-approval-rate", {
      value: overall,
      formattedValue: `${overall.toFixed(1)}%`,
      delta: createDelta(overall - average(1), { suffix: " pp" }),
    });
  }

  // Tasa de aprobación por docente del cuatrimestre elegido, con su variación contra el anterior.
  const previousRates = new Map(
    teacherRows
      .filter((row) => row.cuatrimestre === base.previousQuarter && base.previousQuarter !== base.quarter)
      .map((row) => [row.docenteId, rate(row.approved, row.total)]),
  );
  const teachers: TeacherApprovalRate[] = teacherRows
    .filter((row) => row.cuatrimestre === base.quarter)
    .map((row) => {
      const current = rate(row.approved, row.total);
      const previous = previousRates.get(row.docenteId);

      return {
        teacherName: row.nombre ?? row.docenteId,
        subjectName: subjectNames.get(row.materia) ?? row.materia,
        approvalRate: current,
        delta: createDelta(previous === undefined ? 0 : current - previous, { suffix: " pp" }),
      };
    });

  if (teachers.length > 0) {
    teacherApprovalRates = teachers.sort((a, b) => b.approvalRate - a.approvalRate);
  }

  return { ...base, kpis, subjectApprovalRates, teacherApprovalRates };
}
