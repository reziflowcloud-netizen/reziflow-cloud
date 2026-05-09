ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" JSONB;

CREATE TABLE IF NOT EXISTS "ClientFamilyLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "relativeClientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientFamilyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientFamilyLink_clientId_relativeClientId_key" ON "ClientFamilyLink"("clientId", "relativeClientId");
CREATE INDEX IF NOT EXISTS "ClientFamilyLink_organizationId_idx" ON "ClientFamilyLink"("organizationId");
CREATE INDEX IF NOT EXISTS "ClientFamilyLink_clientId_idx" ON "ClientFamilyLink"("clientId");
CREATE INDEX IF NOT EXISTS "ClientFamilyLink_relativeClientId_idx" ON "ClientFamilyLink"("relativeClientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClientFamilyLink_organizationId_fkey'
  ) THEN
    ALTER TABLE "ClientFamilyLink"
      ADD CONSTRAINT "ClientFamilyLink_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClientFamilyLink_clientId_fkey'
  ) THEN
    ALTER TABLE "ClientFamilyLink"
      ADD CONSTRAINT "ClientFamilyLink_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClientFamilyLink_relativeClientId_fkey'
  ) THEN
    ALTER TABLE "ClientFamilyLink"
      ADD CONSTRAINT "ClientFamilyLink_relativeClientId_fkey"
      FOREIGN KEY ("relativeClientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
