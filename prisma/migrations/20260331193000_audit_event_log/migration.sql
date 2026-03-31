-- Add durable structured audit-event storage.
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" VARCHAR(120) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "actor_user_id" TEXT,
  "organization_id" TEXT,
  "target_type" VARCHAR(64),
  "target_id" TEXT,
  "metadata" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_occurred_at_idx" ON "AuditEvent"("occurred_at");
CREATE INDEX "AuditEvent_organization_id_occurred_at_idx" ON "AuditEvent"("organization_id", "occurred_at");
CREATE INDEX "AuditEvent_action_occurred_at_idx" ON "AuditEvent"("action", "occurred_at");