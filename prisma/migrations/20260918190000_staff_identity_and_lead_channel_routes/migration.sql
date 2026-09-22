-- Explicit, nullable User <-> Employee identity. The composite foreign key
-- makes a cross-organization link impossible at the database layer.
CREATE UNIQUE INDEX IF NOT EXISTS "User_id_organizationId_key"
  ON "User"("id", "organizationId");

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "userId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key"
  ON "Employee"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_organizationId_key"
  ON "Employee"("userId", "organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_id_organizationId_key"
  ON "Employee"("id", "organizationId");

CREATE INDEX IF NOT EXISTS "Employee_organizationId_userId_idx"
  ON "Employee"("organizationId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Employee_userId_organizationId_fkey'
  ) THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT "Employee_userId_organizationId_fkey"
      FOREIGN KEY ("userId", "organizationId")
      REFERENCES "User"("id", "organizationId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Controlled backfill: only normalized names with exactly one User and one
-- Employee inside the same organization are linked. Ambiguous/missing rows
-- deliberately remain NULL (fail closed).
WITH user_candidates AS (
  SELECT
    "organizationId",
    lower(regexp_replace(trim(coalesce(nullif("name", ''), "email")), '\s+', ' ', 'g')) AS normalized_name,
    min("id") AS user_id,
    count(*) AS user_count
  FROM "User"
  WHERE "organizationId" IS NOT NULL
  GROUP BY "organizationId", lower(regexp_replace(trim(coalesce(nullif("name", ''), "email")), '\s+', ' ', 'g'))
), employee_candidates AS (
  SELECT
    "organizationId",
    lower(regexp_replace(trim("name"), '\s+', ' ', 'g')) AS normalized_name,
    min("id") AS employee_id,
    count(*) AS employee_count
  FROM "Employee"
  WHERE "organizationId" IS NOT NULL
  GROUP BY "organizationId", lower(regexp_replace(trim("name"), '\s+', ' ', 'g'))
), unambiguous_matches AS (
  SELECT e.employee_id, u.user_id
  FROM employee_candidates e
  JOIN user_candidates u
    ON u."organizationId" = e."organizationId"
   AND u.normalized_name = e.normalized_name
  WHERE e.employee_count = 1
    AND u.user_count = 1
    AND e.normalized_name <> ''
)
UPDATE "Employee" e
SET "userId" = m.user_id
FROM unambiguous_matches m
WHERE e."id" = m.employee_id
  AND e."userId" IS NULL;

CREATE TABLE IF NOT EXISTS "LeadChannelRoute" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadChannelRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadChannelRoute_organizationId_sourceKey_key"
  ON "LeadChannelRoute"("organizationId", "sourceKey");

CREATE INDEX IF NOT EXISTS "LeadChannelRoute_organizationId_employeeId_idx"
  ON "LeadChannelRoute"("organizationId", "employeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadChannelRoute_organizationId_fkey'
  ) THEN
    ALTER TABLE "LeadChannelRoute"
      ADD CONSTRAINT "LeadChannelRoute_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadChannelRoute_employeeId_fkey'
  ) THEN
    ALTER TABLE "LeadChannelRoute"
      ADD CONSTRAINT "LeadChannelRoute_employeeId_fkey"
      FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
