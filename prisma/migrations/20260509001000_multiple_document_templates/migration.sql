DROP INDEX IF EXISTS "DocumentTemplate_organizationId_type_key";

CREATE INDEX IF NOT EXISTS "DocumentTemplate_organizationId_type_idx" ON "DocumentTemplate"("organizationId", "type");
