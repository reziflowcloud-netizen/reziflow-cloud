-- Expand only. CURRENT_TIMESTAMP is a stable constant for existing organizations;
-- no messages are scanned or activated. New organizations get their creation epoch.
ALTER TABLE "Organization" ADD COLUMN "metaMessageActivatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE SEQUENCE "MetaLiveReceiptSequence" AS INTEGER;
ALTER TABLE "LeadMessage" ADD COLUMN "liveReceipt" INTEGER;
CREATE UNIQUE INDEX "LeadMessage_liveReceipt_key" ON "LeadMessage"("liveReceipt");
CREATE INDEX "LeadMessage_organizationId_liveReceipt_idx" ON "LeadMessage"("organizationId", "liveReceipt");
CREATE INDEX "LeadMessage_organizationId_leadId_liveReceipt_idx" ON "LeadMessage"("organizationId", "leadId", "liveReceipt");
ALTER TABLE "NotificationPreference" ADD COLUMN "metaMessageSound" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "MetaMessageRead" (
 "organizationId" TEXT NOT NULL, "userId" INTEGER NOT NULL, "leadId" TEXT NOT NULL, "throughReceipt" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "MetaMessageRead_pkey" PRIMARY KEY ("organizationId", "userId", "leadId"),
 CONSTRAINT "MetaMessageRead_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "MetaMessageRead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
