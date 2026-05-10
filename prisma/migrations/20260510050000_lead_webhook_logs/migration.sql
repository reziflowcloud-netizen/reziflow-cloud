-- CreateTable
CREATE TABLE "LeadWebhookLog" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT,
    "payload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadWebhookLog_organizationId_createdAt_idx" ON "LeadWebhookLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadWebhookLog_organizationId_status_idx" ON "LeadWebhookLog"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LeadWebhookLog_leadId_idx" ON "LeadWebhookLog"("leadId");

-- AddForeignKey
ALTER TABLE "LeadWebhookLog" ADD CONSTRAINT "LeadWebhookLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadWebhookLog" ADD CONSTRAINT "LeadWebhookLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
