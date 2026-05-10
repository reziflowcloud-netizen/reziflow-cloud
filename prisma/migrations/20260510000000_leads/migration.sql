CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "assignedToId" INTEGER,
    "convertedClientId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Новый',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "messengerId" TEXT,
    "city" TEXT,
    "country" TEXT,
    "language" TEXT,
    "serviceInterest" TEXT,
    "budget" TEXT,
    "urgency" TEXT,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextContactAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Lead_organizationId_status_idx" ON "Lead"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Lead_organizationId_source_idx" ON "Lead"("organizationId", "source");
CREATE INDEX IF NOT EXISTS "Lead_organizationId_assignedToId_idx" ON "Lead"("organizationId", "assignedToId");

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
