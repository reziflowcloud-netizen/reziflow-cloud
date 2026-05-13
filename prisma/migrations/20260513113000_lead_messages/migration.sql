-- CreateTable
CREATE TABLE "LeadMessage" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" INTEGER,
    "channel" TEXT NOT NULL DEFAULT 'manual',
    "direction" TEXT NOT NULL DEFAULT 'incoming',
    "senderType" TEXT NOT NULL DEFAULT 'lead',
    "senderName" TEXT,
    "externalMessageId" TEXT,
    "text" TEXT NOT NULL,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadMessage_organizationId_externalMessageId_key" ON "LeadMessage"("organizationId", "externalMessageId");

-- CreateIndex
CREATE INDEX "LeadMessage_organizationId_sentAt_idx" ON "LeadMessage"("organizationId", "sentAt");

-- CreateIndex
CREATE INDEX "LeadMessage_leadId_sentAt_idx" ON "LeadMessage"("leadId", "sentAt");

-- CreateIndex
CREATE INDEX "LeadMessage_organizationId_channel_idx" ON "LeadMessage"("organizationId", "channel");

-- AddForeignKey
ALTER TABLE "LeadMessage" ADD CONSTRAINT "LeadMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMessage" ADD CONSTRAINT "LeadMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMessage" ADD CONSTRAINT "LeadMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
