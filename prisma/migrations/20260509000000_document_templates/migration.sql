CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplate_organizationId_type_key" ON "DocumentTemplate"("organizationId", "type");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_organizationId_idx" ON "DocumentTemplate"("organizationId");

ALTER TABLE "DocumentTemplate"
  ADD CONSTRAINT "DocumentTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
