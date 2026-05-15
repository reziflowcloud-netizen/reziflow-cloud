CREATE TABLE "LeadPhone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "leadId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "telegram" BOOLEAN NOT NULL DEFAULT false,
    "viber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadPhone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPhone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "clientId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "telegram" BOOLEAN NOT NULL DEFAULT false,
    "viber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPhone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadPhone_organizationId_idx" ON "LeadPhone"("organizationId");
CREATE INDEX "LeadPhone_leadId_idx" ON "LeadPhone"("leadId");
CREATE INDEX "ClientPhone_organizationId_idx" ON "ClientPhone"("organizationId");
CREATE INDEX "ClientPhone_clientId_idx" ON "ClientPhone"("clientId");

ALTER TABLE "LeadPhone" ADD CONSTRAINT "LeadPhone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadPhone" ADD CONSTRAINT "LeadPhone_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPhone" ADD CONSTRAINT "ClientPhone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPhone" ADD CONSTRAINT "ClientPhone_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
