CREATE TABLE "LeadContactHistory" (
  "id" SERIAL NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "authorId" INTEGER,
  "contactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT NOT NULL,
  "nextContactAt" TIMESTAMP(3),
  "nextContactNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeadContactHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadContactHistory_organizationId_leadId_idx" ON "LeadContactHistory"("organizationId", "leadId");
CREATE INDEX "LeadContactHistory_leadId_contactAt_idx" ON "LeadContactHistory"("leadId", "contactAt");

ALTER TABLE "LeadContactHistory" ADD CONSTRAINT "LeadContactHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadContactHistory" ADD CONSTRAINT "LeadContactHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadContactHistory" ADD CONSTRAINT "LeadContactHistory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
