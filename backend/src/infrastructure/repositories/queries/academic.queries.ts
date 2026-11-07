// Query del tablero académico sobre inbox_events: resultados finales de curso (academic.course-result.published.v1).
// Todo lo demás del tablero (cursos, docentes, asignaturas) viene de los gateways (docs/INTEGRACION.md, 6.1).
import { Prisma, PrismaClient } from "@prisma/client";
import { siteFilter } from "./query-helpers";

// Resultados vigentes agrupados por período, asignatura y curso; la materia, la facultad y el docente se resuelven en Node.
export interface CourseResultRow {
  periodId: string;
  subjectId: string;
  courseId: string;
  total: number;
  approved: number;
}

// Resultado vigente de cada (alumno, curso): el último según occurred_at (una corrección de nota se republica con
// eventId nuevo). Con siteId (UUID de Backoffice) sólo cuentan los resultados de esa sede.
export async function queryCourseResults(prisma: PrismaClient, periodIds: string[], siteId: string | null): Promise<CourseResultRow[]> {
  if (periodIds.length === 0) return [];

  const rows = await prisma.$queryRaw<{ period_id: string; subject_id: string; course_id: string; total: number; approved: number }[]>`
    WITH last_result AS (
      SELECT DISTINCT ON (data->>'studentId', data->>'courseId')
        data->>'periodId' AS period_id, data->>'subjectId' AS subject_id,
        data->>'courseId' AS course_id,
        (data->>'status') = 'APROBADO' AS approved
      FROM inbox_events
      WHERE event_type = 'academic.course-result.published.v1'
        AND data->>'periodId' IN (${Prisma.join(periodIds)})
        ${siteFilter(siteId)}
      ORDER BY data->>'studentId', data->>'courseId', occurred_at DESC, received_at DESC
    )
    SELECT period_id, subject_id, course_id,
           COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE approved))::int AS approved
    FROM last_result GROUP BY period_id, subject_id, course_id`;

  return rows.map((row) => ({
    periodId: row.period_id,
    subjectId: row.subject_id,
    courseId: row.course_id,
    total: row.total,
    approved: row.approved,
  }));
}
