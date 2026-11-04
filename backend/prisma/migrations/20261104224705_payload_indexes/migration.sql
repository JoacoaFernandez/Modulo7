-- Índices de expresión sobre inbox_events para los cruces por payload de los tableros.
-- Prisma no los modela en schema.prisma; se mantienen sólo vía migraciones SQL.

-- Cruces curso.abierto / curso.cerrado por curso + cuatrimestre (facultad, nombre de materia, cierres).
CREATE INDEX "inbox_events_curso_cuatri_idx"
  ON "inbox_events" ("source_module", "event_type", (payload->>'cursoId'), (payload->>'cuatrimestre'));

-- Filtro por cuatrimestre (resultados, inscripciones, cursos) dentro de un tipo de evento.
CREATE INDEX "inbox_events_cuatri_idx"
  ON "inbox_events" ("source_module", "event_type", (payload->>'cuatrimestre'));

-- Última modificación / cancelación de un (alumno, curso): resultado.modificado, inscripcion.cancelada.
CREATE INDEX "inbox_events_alumno_curso_idx"
  ON "inbox_events" ("source_module", "event_type", (payload->>'alumnoId'), (payload->>'cursoId'), "occurred_at" DESC);

-- Nombre del docente (docente.alta) por docenteId.
CREATE INDEX "inbox_events_docente_idx"
  ON "inbox_events" ("source_module", "event_type", (payload->>'docenteId'));
