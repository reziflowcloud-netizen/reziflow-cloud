-- SaaS foundation: organizations and per-company ownership.

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'manual',
    "trialEndsAt" TIMESTAMP(3),
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "CaseStatus" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "TaskPriority" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "CaseOption" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

INSERT INTO "Organization" ("id", "name", "slug", "status", "plan", "updatedAt")
VALUES ('org_default', 'ReziFlow Cloud', 'default', 'active', 'manual', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "User" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Client" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Case" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Task" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "CaseStatus" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "TaskPriority" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Service" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "CaseOption" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;
UPDATE "Employee" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;

DO $$
BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Case" ADD CONSTRAINT "Case_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseStatus" ADD CONSTRAINT "CaseStatus_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TaskPriority" ADD CONSTRAINT "TaskPriority_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CaseOption" ADD CONSTRAINT "CaseOption_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "Case_caseNumber_key";
DROP INDEX IF EXISTS "CaseStatus_name_key";
DROP INDEX IF EXISTS "TaskPriority_name_key";
DROP INDEX IF EXISTS "Service_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Case_organizationId_caseNumber_key" ON "Case"("organizationId", "caseNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CaseStatus_organizationId_name_key" ON "CaseStatus"("organizationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "TaskPriority_organizationId_name_key" ON "TaskPriority"("organizationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Service_organizationId_name_key" ON "Service"("organizationId", "name");
