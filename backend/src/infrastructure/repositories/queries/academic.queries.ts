// Query del tablero académico sobre inbox_events: resultados finales de curso (academic.course-result.published.v1).
// Todo lo demás del tablero (cursos, asignaturas sin datos en el evento, nombres) viene de los gateways (docs/INTEGRACION.md, 6.1).
import { Prisma, PrismaClient } from "@prisma/client";
import { COURSE_RESULT_APPROVED_STATUSES, COURSE_RESULT_COUNTED_STATUSES } from "../../config/dashboard.config";
import { siteFilter } from "./query-helpers";

// Resultados vigentes agrupados por período, curso, materia y docentes; la facultad y el nombre del docente se resuelven en Node.
export interface CourseResultRow {
  periodId: string;
  subjectId: string;
  // Del evento; null si G9 no los mandó (se completan con el catálogo).
  subjectCode: string | null;
  subjectName: string | null;
  courseId: string;
  // Docentes del evento (todos los roles); null si el evento no trae `teachers` (se usan los de G9).
  teacherIds: string[] | null;
  total: number;
  approved: number;
}

// Estado vigente de cada (alumno, curso): el último según occurred_at (una corrección se republica con eventId nuevo).
// El estado se filtra DESPUÉS de elegir el último: si el último es REGULAR o BAJA, el alumno sale del cálculo. Con siteId
// (UUID de Backoffice) sólo cuentan los de esa sede; un resultado sin sede (null) cuenta sólo sin filtro de sede.
export async function queryCourseResults(prisma: PrismaClient, periodIds: string[], siteId: string | null): Promise<CourseResultRow[]> {
  if (periodIds.length === 0) return [];

  const rows = await prisma.$queryRaw<
    { period_id: string; subject_id: string; subject_code: string | null; subject_name: string | null; course_id: string; teachers: unknown; total: number; approved: number }[]
  >`
    WITH last_result AS (
      SELECT DISTINCT ON (data->>'studentRef', data->>'courseId')
        data->>'periodId' AS period_id, data->>'subjectId' AS subject_id,
        data->>'subjectCode' AS subject_code, data->>'subjectName' AS subject_name,
        data->>'courseId' AS course_id, data->>'siteId' AS site_id,
        CASE WHEN jsonb_typeof(data->'teachers') = 'array' THEN data->'teachers' END AS teachers,
        data->>'status' AS status
      FROM inbox_events
      WHERE event_type = 'academic.course-result.published.v1'
        AND data->>'periodId' IN (${Prisma.join(periodIds)})
      ORDER BY data->>'studentRef', data->>'courseId', occurred_at DESC, received_at DESC
    )
    SELECT period_id, subject_id, subject_code, subject_name, course_id, teachers,
           COUNT(*)::int AS total,
           (COUNT(*) FILTER (WHERE status IN (${Prisma.join(COURSE_RESULT_APPROVED_STATUSES)})))::int AS approved
    FROM last_result
    WHERE status IN (${Prisma.join(COURSE_RESULT_COUNTED_STATUSES)})
      ${siteFilter(siteId, Prisma.sql`site_id`)}
    GROUP BY period_id, subject_id, subject_code, subject_name, course_id, teachers`;

  return rows.map((row) => ({
    periodId: row.period_id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    courseId: row.course_id,
    teacherIds: parseTeacherIds(row.teachers),
    total: row.total,
    approved: row.approved,
  }));
}

// Ids distintos de `teachers[].teacherId`; null si el evento no trae la lista (o viene vacía).
function parseTeacherIds(teachers: unknown): string[] | null {
  if (!Array.isArray(teachers)) return null;
  const ids = teachers.flatMap((teacher) => (typeof (teacher as { teacherId?: unknown })?.teacherId === "string" ? [(teacher as { teacherId: string }).teacherId] : []));
  // Una lista vacía equivale a no traer la lista: se completa con los docentes de G9.
  return ids.length > 0 ? [...new Set(ids)] : null;
}
