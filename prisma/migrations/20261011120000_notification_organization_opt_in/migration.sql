-- Existing and new tenants remain OFF; no pilot/customer backfill.
ALTER TABLE "Organization"
  ADD COLUMN "notificationAutomationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notificationAutomationActivatedAt" TIMESTAMP(3);
CREATE INDEX "Task_organizationId_dueDate_idx" ON "Task"("organizationId", "dueDate");
