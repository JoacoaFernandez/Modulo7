// Queries del tablero académico sobre inbox_events (gestion-academica, portal-estudiante, portal-docente y backoffice).
import { Prisma, PrismaClient } from "@prisma/client";
import { siteFilter } from "./query-helpers";

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
        WHERE c.source_module = 'gestion-academica'
          AND c.event_type = 'curso.cerrado'
          AND c.payload->>'cursoId' = e.payload->>'cursoId'
          AND c.payload->>'cuatrimestre' = e.payload->>'cuatrimestre'
          ${sedeMatch ? Prisma.sql`AND c.payload->>'sedeId' = e.payload->>'sedeId'` : Prisma.empty}
          AND c.occurred_at < COALESCE(
            (SELECT (q.payload->>'fin')::date + 1
             FROM inbox_events q
             WHERE q.source_module = 'gestion-academica'
               AND q.event_type = 'cuatrimestre.definido'
               AND q.payload->>'cuatrimestre' = e.payload->>'cuatrimestre'
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
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(DISTINCT e.payload->>'materia')::int AS total
    FROM inbox_events e
    WHERE e.source_module = 'gestion-academica'
      AND e.event_type = 'curso.abierto'
      AND e.payload->>'cuatrimestre' = ${quarter}
      ${siteFilter(sedeId, Prisma.sql`e.payload->>'sedeId'`)}
      ${earlyClosure(false)}`;

  return rows[0]?.total ?? 0;
}

// Comisiones: pares distintos (sede, curso) abiertos en el cuatrimestre y sin cierre anticipado. El cierre
// aplica por curso + cuatrimestre + sede, así "Todas las sedes" suma las sedes aunque se repita el cursoId.
export async function queryActiveCommissionsCount(
  prisma: PrismaClient,
  quarter: string,
  sedeId: string | null,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(DISTINCT (e.payload->>'sedeId', e.payload->>'cursoId'))::int AS total
    FROM inbox_events e
    WHERE e.source_module = 'gestion-academica'
      AND e.event_type = 'curso.abierto'
      AND e.payload->>'cuatrimestre' = ${quarter}
      ${siteFilter(sedeId, Prisma.sql`e.payload->>'sedeId'`)}
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
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(DISTINCT i.payload->>'alumnoId')::int AS total
    FROM inbox_events i
    WHERE i.source_module = 'portal-estudiante'
      AND i.event_type = 'inscripcion.confirmada'
      AND i.payload->>'cuatrimestre' = ${quarter}
      ${siteFilter(sedeId, Prisma.sql`i.payload->>'sedeId'`)}
      AND NOT EXISTS (
        SELECT 1 FROM inbox_events c
        WHERE c.source_module = 'portal-estudiante'
          AND c.event_type = 'inscripcion.cancelada'
          AND c.payload->>'alumnoId' = i.payload->>'alumnoId'
          AND c.payload->>'cursoId' = i.payload->>'cursoId'
          AND c.payload->>'cuatrimestre' = i.payload->>'cuatrimestre'
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
): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM (
      SELECT payload->>'docenteId' AS docente_id
      FROM inbox_events
      WHERE source_module = 'gestion-academica' AND event_type = 'resultado.publicado'
        AND payload->>'cuatrimestre' = ${quarter} ${siteFilter(sedeId)}
      UNION
      SELECT payload->>'docenteId'
      FROM inbox_events
      WHERE source_module = 'portal-docente' AND event_type = 'curso.creado'
        AND payload->>'cuatrimestre' = ${quarter} ${siteFilter(sedeId)}
    ) teachers
    WHERE docente_id IS NOT NULL`;

  return rows[0]?.total ?? 0;
}

// Resultado vigente de cada (alumno, curso): el último publicado, corregido por la última
// modificación si existe. Así un reenvío o una corrección no cuentan dos veces.
function currentResults(quarters: string[], sedeId: string | null): Prisma.Sql {
  return Prisma.sql`
    WITH published AS (
      SELECT DISTINCT ON (payload->>'alumnoId', payload->>'cursoId')
        payload->>'alumnoId' AS alumno_id,
        payload->>'cursoId' AS curso_id,
        payload->>'materia' AS materia,
        payload->>'docenteId' AS docente_id,
        payload->>'cuatrimestre' AS cuatrimestre,
        (payload->>'aprobado')::boolean AS aprobado
      FROM inbox_events
      WHERE source_module = 'gestion-academica'
        AND event_type = 'resultado.publicado'
        AND payload->>'cuatrimestre' IN (${Prisma.join(quarters)})
        ${siteFilter(sedeId)}
      ORDER BY payload->>'alumnoId', payload->>'cursoId', occurred_at DESC
    ),
    results AS (
      SELECT p.curso_id, p.materia, p.docente_id, p.cuatrimestre,
        COALESCE(
          (SELECT (m.payload->>'aprobado')::boolean
           FROM inbox_events m
           WHERE m.source_module = 'gestion-academica'
             AND m.event_type = 'resultado.modificado'
             AND m.payload->>'alumnoId' = p.alumno_id
             AND m.payload->>'cursoId' = p.curso_id
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
): Promise<ApprovalRow[]> {
  return prisma.$queryRaw<ApprovalRow[]>`
    ${currentResults(quarters, sedeId)}
    SELECT r.materia, r.cuatrimestre,
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE r.aprobado))::int AS approved,
      (SELECT a.payload->>'nombreMateria'
       FROM inbox_events a
       WHERE a.source_module = 'gestion-academica'
         AND a.event_type = 'curso.abierto'
         AND a.payload->>'materia' = r.materia
         AND a.payload->>'nombreMateria' IS NOT NULL
       ORDER BY a.occurred_at DESC LIMIT 1) AS nombre
    FROM results r
    GROUP BY r.materia, r.cuatrimestre`;
}

// Tasa de aprobación por docente y cuatrimestre.
export async function queryTeacherApprovals(
  prisma: PrismaClient,
  quarters: string[],
  sedeId: string | null,
): Promise<TeacherApprovalRow[]> {
  const rows = await prisma.$queryRaw<
    { docente_id: string; cuatrimestre: string; total: number; approved: number; nombre: string | null; materia: string }[]
  >`
    ${currentResults(quarters, sedeId)}
    SELECT r.docente_id, r.cuatrimestre,
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE r.aprobado))::int AS approved,
      (SELECT d.payload->>'nombre'
       FROM inbox_events d
       WHERE d.source_module = 'backoffice'
         AND d.event_type = 'docente.alta'
         AND d.payload->>'docenteId' = r.docente_id
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
): Promise<FacultyApprovalRow[]> {
  return prisma.$queryRaw<FacultyApprovalRow[]>`
    ${currentResults(quarters, sedeId)}
    SELECT f.facultad, r.cuatrimestre,
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE r.aprobado))::int AS approved
    FROM results r
    JOIN LATERAL (
      SELECT a.payload->>'facultad' AS facultad
      FROM inbox_events a
      WHERE a.source_module = 'gestion-academica'
        AND a.event_type = 'curso.abierto'
        AND a.payload->>'cursoId' = r.curso_id
        AND a.payload->>'cuatrimestre' = r.cuatrimestre
        AND a.payload->>'facultad' IS NOT NULL
      ORDER BY a.occurred_at DESC LIMIT 1
    ) f ON true
    GROUP BY f.facultad, r.cuatrimestre`;
}

// Todas las facultades que informó algún curso, para asignarles un color estable entre filtros.
export async function queryFacultyNames(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ facultad: string }[]>`
    SELECT DISTINCT payload->>'facultad' AS facultad
    FROM inbox_events
    WHERE source_module = 'gestion-academica' AND event_type = 'curso.abierto'
      AND payload->>'facultad' IS NOT NULL`;

  return rows.map((row) => row.facultad).sort((a, b) => a.localeCompare(b, "es"));
}
