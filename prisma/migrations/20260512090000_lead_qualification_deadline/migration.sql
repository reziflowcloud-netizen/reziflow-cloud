ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "voivodeship" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_organizationId_deadlineAt_idx" ON "Lead"("organizationId", "deadlineAt");
