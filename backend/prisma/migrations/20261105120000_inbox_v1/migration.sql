-- Datos de demo: se descartan. No hay datos reales que migrar.
-- (Al borrar la tabla también caen los índices de expresión sobre payload de la migración anterior.)
DROP TABLE IF EXISTS "inbox_events";

-- CreateTable
CREATE TABLE "inbox_events" (
    "event_id" UUID NOT NULL,
    "spec_version" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "subject" TEXT,
    "correlation_id" UUID,
    "causation_id" UUID,
    "actor" JSONB,
    "data" JSONB NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'OK',
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "source_ingestions" (
    "source" TEXT NOT NULL,
    "last_event_at" TIMESTAMPTZ(3),
    "last_received_at" TIMESTAMPTZ(3) NOT NULL,
    "stored_count" INTEGER NOT NULL DEFAULT 0,
    "ignored_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "source_ingestions_pkey" PRIMARY KEY ("source")
);

-- CreateTable
CREATE TABLE "wallet_balance_snapshots" (
    "month" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "outstanding_balance" DECIMAL(18,2) NOT NULL,
    "wallet_count" INTEGER NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "wallet_balance_snapshots_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE INDEX "inbox_events_event_type_occurred_at_idx" ON "inbox_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "inbox_events_source_received_at_idx" ON "inbox_events"("source", "received_at");


-- Índices de expresión sobre data. Prisma no los modela: se mantienen sólo vía migraciones SQL.
-- Sólo los que usan las queries del diseño (docs/INTEGRACION.md, sección 6).
-- Resultado vigente por (alumno, curso) y filtro por período.
CREATE INDEX "inbox_results_idx" ON "inbox_events"
  (("data"->>'studentId'), ("data"->>'courseId'), "occurred_at" DESC)
  WHERE "event_type" = 'academic.course-result.published.v1';
CREATE INDEX "inbox_results_period_idx" ON "inbox_events"
  (("data"->>'periodId'), ("data"->>'siteId'))
  WHERE "event_type" = 'academic.course-result.published.v1';
-- Eventos: unir creación, inscripciones y asistencias por eventId.
CREATE INDEX "inbox_events_event_id_idx" ON "inbox_events"
  ("event_type", ("data"->>'eventId'))
  WHERE "event_type" IN ('events.event.created.v1', 'events.registration.completed.v1', 'events.attendance.recorded.v1');
-- locationId -> siteId.
CREATE INDEX "inbox_location_idx" ON "inbox_events" (("data"->>'locationId'), "occurred_at" DESC)
  WHERE "event_type" = 'backoffice.location.upserted.v1';
-- Comedor: cruzar cancelaciones y asistencias con la reserva.
CREATE INDEX "inbox_dining_idx" ON "inbox_events" ("event_type", ("data"->>'reservationId'))
  WHERE "event_type" LIKE 'dining.%';
