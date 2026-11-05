// Queries del tablero académico sobre inbox_events (gestion-academica, portal-estudiante, portal-docente y backoffice).
import { Prisma, PrismaClient } from "@prisma/client";
import { facultyFilter, siteFilter } from "./query-helpers";

export interface ApprovalRow {
  materia: string;
  cuatrimestre: string;
  total: number;
  approved: number;
  // Nombre de la materia según curso.abierto; null si ningún curso lo informó.
  nombre: string | null;
}

export interface TeacherApprovalRow {
  docenteId: string;
  cuatrimestre: string;
  total: number;
  approved: number;
  // Nombre según docente.alta de Backoffice; null si no se recibió el alta.
  nombre: string | null;
  // Materia en la que más resultados publicó en ese cuatrimestre.
  materia: string;
}

// Cierre anticipado (baja) de un curso: su curso.cerrado ocurrió antes del fin del cuatrimestre. El fin sale del
// último cuatrimestre.definido de ese cuatrimestre (se cuenta todo el día `fin`); sin definición, rige la fecha de hoy,
// así cualquier cierre ya ocurrido excluye. Un cierre posterior al fin es el cierre de rutina y el curso sigue contando.
function earlyClosure(sedeMatch: boolean): Prisma.Sql {
  return Prisma.sql`
      AND NOT EXISTS (
        SELECT 1 FROM inbox_events c
        WHERE c.source = 'gestion-academica'
          AND c.event_type = 'curso.cerrado'
          AND c.data->>'cursoId' = e.data->>'cursoId'
          AND c.data->>'cuatrimestre' = e.data->>'cuatrimestre'
          ${sedeMatch ? Prisma.sql`AND c.data->>'sedeId' = e.data->>'sedeId'` : Prisma.empty}
          AND c.occurred_at < COALESCE(
            (SELECT (q.data->>'fin')::date + 1
             FROM inbox_events q
             WHERE q.source = 'gestion-academica'
               AND q.event_type = 'cuatrimestre.definido'
               AND q.data->>'cuatrimestre' = e.data->>'cuatrimestre'
             ORDER BY q.occurred_at DESC LIMIT 1),
            now() AT TIME ZONE 'UTC'
          )
      )`;
}

// Materias distintas con algún curso abierto en el cuatrimestre y sin cierre anticipado.
export async function queryActiveSubjectsCount(
  prisma: PrismaClient,
  quarter: string,
  sedeId: string | null,
  facultad: string | null,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(DISTINCT e.data->>'materia')::int AS total
    FROM inbox_events e
    WHERE e.source = 'gestion-academica'
      AND e.event_type = 'curso.abierto'
      AND e.data->>'cuatrimestre' = ${quarter}
      ${siteFilter(sedeId, Prisma.sql`e.data->>'sedeId'`)}
      ${facultad === null ? Prisma.empty : Prisma.sql`AND e.data->>'facultad' = ${facultad}`}
      ${earlyClosure(false)}`;

  return rows[0]?.total ?? 0;
}

// Comisiones: pares distintos (sede, curso) abiertos en el cuatrimestre y sin cierre anticipado. El cierre
// aplica por curso + cuatrimestre + sede, así "Todas las sedes" suma las sedes aunque se repita el cursoId.
export async function queryActiveCommissionsCount(
  prisma: PrismaClient,
  quarter: string,
  sedeId: string | null,
  facultad: string | null,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(DISTINCT (e.data->>'sedeId', e.data->>'cursoId'))::int AS total
    FROM inbox_events e
    WHERE e.source = 'gestion-academica'
      AND e.event_type = 'curso.abierto'
      AND e.data->>'cuatrimestre' = ${quarter}
      ${siteFilter(sedeId, Prisma.sql`e.data->>'sedeId'`)}
      ${facultad === null ? Prisma.empty : Prisma.sql`AND e.data->>'facultad' = ${facultad}`}
      ${earlyClosure(true)}`;

  return rows[0]?.total ?? 0;
}

export interface FacultyApprovalRow {
  facultad: string;
  cuatrimestre: string;
  total: number;
  approved: number;
}

// Estudiantes con cursada activa: alumnos distintos con al menos una inscripción confirmada en el
// cuatrimestre que no se canceló después (una reinscripción posterior a la baja vuelve a contar).
export async function queryActiveStudentsCount(
  prisma: PrismaClient,
  quarter: string,
  sedeId: string | null,
  facultad: string | null,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(DISTINCT i.data->>'alumnoId')::int AS total
    FROM inbox_events i
    WHERE i.source = 'portal-estudiante'
      AND i.event_type = 'inscripcion.confirmada'
      AND i.data->>'cuatrimestre' = ${quarter}
      ${siteFilter(sedeId, Prisma.sql`i.data->>'sedeId'`)}
      ${facultyFilter(facultad, Prisma.sql`i.data->>'cursoId'`, Prisma.sql`i.data->>'cuatrimestre'`)}
      AND NOT EXISTS (
        SELECT 1 FROM inbox_events c
        WHERE c.source = 'portal-estudiante'
          AND c.event_type = 'inscripcion.cancelada'
          AND c.data->>'alumnoId' = i.data->>'alumnoId'
          AND c.data->>'cursoId' = i.data->>'cursoId'
          AND c.data->>'cuatrimestre' = i.data->>'cuatrimestre'
          AND c.occurred_at >= i.occurred_at
      )`;

  return rows[0]?.total ?? 0;
}

// Docentes del cuatrimestre: ids distintos con resultados publicados (Gestión Académica) o cursos creados
// (Portal Docente) en la sede. docente.alta no sirve acá: no trae sede ni cuatrimestre.
export async function queryTeachersCount(
  prisma: PrismaClient,
  quarter: string,
  sedeId: string | null,
  facultad: string | null,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM (
      SELECT data->>'docenteId' AS docente_id
      FROM inbox_events
      WHERE source = 'gestion-academica' AND event_type = 'resultado.publicado'
        AND data->>'cuatrimestre' = ${quarter} ${siteFilter(sedeId)}
        ${facultyFilter(facultad, Prisma.sql`data->>'cursoId'`, Prisma.sql`data->>'cuatrimestre'`)}
      UNION
      SELECT data->>'docenteId'
      FROM inbox_events
      WHERE source = 'portal-docente' AND event_type = 'curso.creado'
        AND data->>'cuatrimestre' = ${quarter} ${siteFilter(sedeId)}
        ${facultyFilter(facultad, Prisma.sql`data->>'cursoId'`, Prisma.sql`data->>'cuatrimestre'`)}
    ) teachers
    WHERE docente_id IS NOT NULL`;

  return rows[0]?.total ?? 0;
}

// Resultado vigente de cada (alumno, curso): el último publicado, corregido por la última
// modificación si existe. Así un reenvío o una corrección no cuentan dos veces.
function currentResults(quarters: string[], sedeId: string | null, facultad: string | null): Prisma.Sql {
  return Prisma.sql`
    WITH published AS (
      SELECT DISTINCT ON (data->>'alumnoId', data->>'cursoId')
        data->>'alumnoId' AS alumno_id,
        data->>'cursoId' AS curso_id,
        data->>'materia' AS materia,
        data->>'docenteId' AS docente_id,
        data->>'cuatrimestre' AS cuatrimestre,
        (data->>'aprobado')::boolean AS aprobado
      FROM inbox_events
      WHERE source = 'gestion-academica'
        AND event_type = 'resultado.publicado'
        AND data->>'cuatrimestre' IN (${Prisma.join(quarters)})
        ${siteFilter(sedeId)}
        ${facultyFilter(facultad, Prisma.sql`data->>'cursoId'`, Prisma.sql`data->>'cuatrimestre'`)}
      ORDER BY data->>'alumnoId', data->>'cursoId', occurred_at DESC
    ),
    results AS (
      SELECT p.curso_id, p.materia, p.docente_id, p.cuatrimestre,
        COALESCE(
          (SELECT (m.data->>'aprobado')::boolean
           FROM inbox_events m
           WHERE m.source = 'gestion-academica'
             AND m.event_type = 'resultado.modificado'
             AND m.data->>'alumnoId' = p.alumno_id
             AND m.data->>'cursoId' = p.curso_id
           ORDER BY m.occurred_at DESC LIMIT 1),
          p.aprobado
        ) AS aprobado
      FROM published p
    )`;
}

// Tasa de aprobación por materia y cuatrimestre.
export async function querySubjectApprovals(
  prisma: PrismaClient,
  quarters: string[],
  sedeId: string | null,
  facultad: string | null,
): Promise<ApprovalRow[]> {
  return prisma.$queryRaw<ApprovalRow[]>`
    ${currentResults(quarters, sedeId, facultad)}
    SELECT r.materia, r.cuatrimestre,
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE r.aprobado))::int AS approved,
      (SELECT a.data->>'nombreMateria'
       FROM inbox_events a
       WHERE a.source = 'gestion-academica'
         AND a.event_type = 'curso.abierto'
         AND a.data->>'materia' = r.materia
         AND a.data->>'nombreMateria' IS NOT NULL
       ORDER BY a.occurred_at DESC LIMIT 1) AS nombre
    FROM results r
    GROUP BY r.materia, r.cuatrimestre`;
}

// Tasa de aprobación por docente y cuatrimestre.
export async function queryTeacherApprovals(
  prisma: PrismaClient,
  quarters: string[],
  sedeId: string | null,
  facultad: string | null,
): Promise<TeacherApprovalRow[]> {
  const rows = await prisma.$queryRaw<
    { docente_id: string; cuatrimestre: string; total: number; approved: number; nombre: string | null; materia: string }[]
  >`
    ${currentResults(quarters, sedeId, facultad)}
    SELECT r.docente_id, r.cuatrimestre,
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE r.aprobado))::int AS approved,
      (SELECT d.data->>'nombre'
       FROM inbox_events d
       WHERE d.source = 'backoffice'
         AND d.event_type = 'docente.alta'
         AND d.data->>'docenteId' = r.docente_id
       ORDER BY d.occurred_at DESC LIMIT 1) AS nombre,
      MODE() WITHIN GROUP (ORDER BY r.materia) AS materia
    FROM results r
    GROUP BY r.docente_id, r.cuatrimestre`;

  return rows.map((row) => ({
    docenteId: row.docente_id,
    cuatrimestre: row.cuatrimestre,
    total: row.total,
    approved: row.approved,
    nombre: row.nombre,
    materia: row.materia,
  }));
}

// Tasa de aprobación por facultad y cuatrimestre. La facultad sale de curso.abierto, cruzado por
// cursoId y cuatrimestre; los resultados de cursos que no informaron facultad no se atribuyen a ninguna.
export async function queryFacultyApprovals(
  prisma: PrismaClient,
  quarters: string[],
  sedeId: string | null,
  facultad: string | null,
): Promise<FacultyApprovalRow[]> {
  return prisma.$queryRaw<FacultyApprovalRow[]>`
    ${currentResults(quarters, sedeId, facultad)}
    SELECT f.facultad, r.cuatrimestre,
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE r.aprobado))::int AS approved
    FROM results r
    JOIN LATERAL (
      SELECT a.data->>'facultad' AS facultad
      FROM inbox_events a
      WHERE a.source = 'gestion-academica'
        AND a.event_type = 'curso.abierto'
        AND a.data->>'cursoId' = r.curso_id
        AND a.data->>'cuatrimestre' = r.cuatrimestre
        AND a.data->>'facultad' IS NOT NULL
      ORDER BY a.occurred_at DESC LIMIT 1
    ) f ON true
    GROUP BY f.facultad, r.cuatrimestre`;
}
