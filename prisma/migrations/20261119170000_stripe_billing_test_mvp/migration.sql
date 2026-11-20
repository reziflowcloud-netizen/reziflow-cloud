-- Additive only: no existing data or columns are changed.
CREATE TABLE "StripeBillingState" (
    "organizationId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "checkoutKey" TEXT NOT NULL,
    "checkoutSessionId" TEXT,
    "checkoutExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StripeBillingState_pkey" PRIMARY KEY ("organizationId"),
    CONSTRAINT "StripeBillingState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StripeBillingState_customerKey_key" ON "StripeBillingState"("customerKey");
CREATE UNIQUE INDEX "StripeBillingState_checkoutKey_key" ON "StripeBillingState"("checkoutKey");
CREATE UNIQUE INDEX "StripeBillingState_checkoutSessionId_key" ON "StripeBillingState"("checkoutSessionId");
CREATE TABLE "StripeBillingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stripeCreated" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeBillingEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StripeBillingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StripeBillingEvent_organizationId_processedAt_idx" ON "StripeBillingEvent"("organizationId", "processedAt");
