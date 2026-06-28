ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "employeeId" INTEGER;

CREATE INDEX IF NOT EXISTS "Lead_organizationId_employeeId_idx"
  ON "Lead"("organizationId", "employeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lead_employeeId_fkey'
  ) THEN
    ALTER TABLE "Lead"
      ADD CONSTRAINT "Lead_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
