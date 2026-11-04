-- CreateTable
CREATE TABLE "inbox_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_events_event_id_key" ON "inbox_events"("event_id");

-- CreateIndex
CREATE INDEX "inbox_events_event_type_idx" ON "inbox_events"("event_type");

-- CreateIndex
CREATE INDEX "inbox_events_occurred_at_idx" ON "inbox_events"("occurred_at");

-- CreateIndex
CREATE INDEX "inbox_events_source_module_event_type_idx" ON "inbox_events"("source_module", "event_type");
