-- Expand only. Existing/history messages remain ineligible; no backfill.
ALTER TABLE "LeadMessage" ADD COLUMN "liveIncoming" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "LeadMessage_organizationId_liveIncoming_id_idx" ON "LeadMessage"("organizationId", "liveIncoming", "id");
CREATE INDEX "LeadMessage_organizationId_leadId_liveIncoming_id_idx" ON "LeadMessage"("organizationId", "leadId", "liveIncoming", "id");
ALTER TABLE "NotificationPreference" ADD COLUMN "metaMessageSound" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "MetaMessageRead" (
 "organizationId" TEXT NOT NULL, "userId" INTEGER NOT NULL, "leadId" TEXT NOT NULL, "throughId" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "MetaMessageRead_pkey" PRIMARY KEY ("organizationId", "userId", "leadId"),
 CONSTRAINT "MetaMessageRead_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "MetaMessageRead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
