ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "restrictedAccess" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "assignedToId" INTEGER;

CREATE INDEX IF NOT EXISTS "Client_organizationId_assignedToId_idx"
  ON "Client"("organizationId", "assignedToId");

CREATE INDEX IF NOT EXISTS "Case_organizationId_assignedToId_idx"
  ON "Case"("organizationId", "assignedToId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Client_assignedToId_fkey'
  ) THEN
    ALTER TABLE "Client"
      ADD CONSTRAINT "Client_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
