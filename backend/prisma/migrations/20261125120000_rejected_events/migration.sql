-- CreateTable
CREATE TABLE "rejected_events" (
    "id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "event_id" UUID,
    "raw" TEXT NOT NULL,

    CONSTRAINT "rejected_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rejected_events_received_at_idx" ON "rejected_events"("received_at");
