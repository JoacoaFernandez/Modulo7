-- Los resultados de cursada guardan `studentRef` (hash del alumno) en lugar de `studentId`: índice del resultado vigente
-- por (alumno, curso). El de `studentId` (inbox_results_idx) queda para los datos viejos.
CREATE INDEX "inbox_results_ref_idx" ON "inbox_events"
  (("data"->>'studentRef'), ("data"->>'courseId'), "occurred_at" DESC)
  WHERE "event_type" = 'academic.course-result.published.v1';
