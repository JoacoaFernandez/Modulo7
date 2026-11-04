// Queries del tablero académico sobre inbox_events (gestion-academica y backoffice).
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

// Materias distintas con algún curso abierto y sin cerrar en el cuatrimestre.
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
      AND NOT EXISTS (
        SELECT 1 FROM inbox_events c
        WHERE c.source_module = 'gestion-academica'
          AND c.event_type = 'curso.cerrado'
          AND c.payload->>'cursoId' = e.payload->>'cursoId'
          AND c.payload->>'cuatrimestre' = e.payload->>'cuatrimestre'
      )`;

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
      SELECT p.materia, p.docente_id, p.cuatrimestre,
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
