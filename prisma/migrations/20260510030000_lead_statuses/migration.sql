CREATE TABLE "LeadStatus" (
  "id" SERIAL NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#2563eb',
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeadStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadStatus_organizationId_name_key" ON "LeadStatus"("organizationId", "name");
CREATE INDEX "LeadStatus_organizationId_order_idx" ON "LeadStatus"("organizationId", "order");

ALTER TABLE "LeadStatus" ADD CONSTRAINT "LeadStatus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
