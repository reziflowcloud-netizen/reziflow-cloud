ALTER TABLE "LeadStatus" ADD COLUMN "requireReason" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadStatus" ADD COLUMN "reasons" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Lead" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN "statusReasonComment" TEXT;

CREATE INDEX "Lead_organizationId_statusReason_idx" ON "Lead"("organizationId", "statusReason");
