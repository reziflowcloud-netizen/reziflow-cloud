-- Staff Routing V2: normalized route members and a persistent per-channel cursor.
-- Existing V1 routes are preserved as the first member of their channel route.

ALTER TABLE "LeadChannelRoute"
  ADD COLUMN "nextPosition" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "LeadChannelRoute_id_organizationId_key"
  ON "LeadChannelRoute"("id", "organizationId");

CREATE TABLE "LeadChannelRouteMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadChannelRouteMember_pkey" PRIMARY KEY ("id")
);

INSERT INTO "LeadChannelRouteMember" (
  "id",
  "organizationId",
  "routeId",
  "employeeId",
  "position"
)
SELECT
  'v2_' || md5("id" || ':' || "employeeId"::text),
  "organizationId",
  "id",
  "employeeId",
  0
FROM "LeadChannelRoute";

CREATE UNIQUE INDEX "LeadChannelRouteMember_routeId_employeeId_key"
  ON "LeadChannelRouteMember"("routeId", "employeeId");

CREATE UNIQUE INDEX "LeadChannelRouteMember_routeId_position_key"
  ON "LeadChannelRouteMember"("routeId", "position");

CREATE INDEX "LeadChannelRouteMember_organizationId_employeeId_idx"
  ON "LeadChannelRouteMember"("organizationId", "employeeId");

ALTER TABLE "LeadChannelRouteMember"
  ADD CONSTRAINT "LeadChannelRouteMember_routeId_organizationId_fkey"
  FOREIGN KEY ("routeId", "organizationId")
  REFERENCES "LeadChannelRoute"("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadChannelRouteMember"
  ADD CONSTRAINT "LeadChannelRouteMember_employeeId_organizationId_fkey"
  FOREIGN KEY ("employeeId", "organizationId")
  REFERENCES "Employee"("id", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- V1 remains live between expand and application deploy. Its route inserts must
-- immediately become usable by V2 even when V1 creates routes after this backfill.
CREATE FUNCTION "staff_routing_v2_seed_legacy_member"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "LeadChannelRouteMember" (
    "id", "organizationId", "routeId", "employeeId", "position"
  ) VALUES (
    'v2_' || md5(NEW."id" || ':' || NEW."employeeId"::text),
    NEW."organizationId", NEW."id", NEW."employeeId", 0
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "LeadChannelRoute_seed_legacy_member"
AFTER INSERT ON "LeadChannelRoute"
FOR EACH ROW EXECUTE FUNCTION "staff_routing_v2_seed_legacy_member"();
