-- Add new workflow status fields for MVP visual state extension.
ALTER TABLE "WorkItem"
ADD COLUMN "on_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;

-- Add indexes to support filtering/querying by status.
CREATE INDEX "WorkItem_on_hold_idx" ON "WorkItem"("on_hold");
CREATE INDEX "WorkItem_cancelled_idx" ON "WorkItem"("cancelled");
