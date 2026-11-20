-- Additive operation journal and tenant-scoped fencing. No existing row rewrite.
CREATE TABLE "StripeBillingOperation" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "dedupeKey" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "phase" TEXT NOT NULL,
 "idempotencyKey" TEXT NOT NULL,
 "paramsJson" TEXT NOT NULL,
 "requestFingerprint" TEXT NOT NULL,
 "organizationFingerprint" TEXT NOT NULL,
 "providerId" TEXT,
 "invoiceId" TEXT,
 "paymentIntentId" TEXT,
 "chargeId" TEXT,
 "resultJson" TEXT,
 "errorCode" TEXT,
 "firstAttemptAt" TIMESTAMP(3),
 "postStartedAt" TIMESTAMP(3),
 "idempotencyExpiresAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StripeBillingOperation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "StripeBillingOperation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StripeBillingOperation_dedupeKey_key" ON "StripeBillingOperation"("dedupeKey");
CREATE UNIQUE INDEX "StripeBillingOperation_idempotencyKey_key" ON "StripeBillingOperation"("idempotencyKey");
CREATE UNIQUE INDEX "StripeBillingOperation_id_organizationId_key" ON "StripeBillingOperation"("id", "organizationId");
CREATE INDEX "StripeBillingOperation_organizationId_kind_createdAt_idx" ON "StripeBillingOperation"("organizationId", "kind", "createdAt");
CREATE INDEX "StripeBillingOperation_invoiceId_idx" ON "StripeBillingOperation"("invoiceId");
CREATE INDEX "StripeBillingOperation_paymentIntentId_idx" ON "StripeBillingOperation"("paymentIntentId");
CREATE INDEX "StripeBillingOperation_chargeId_idx" ON "StripeBillingOperation"("chargeId");
CREATE TABLE "StripeBillingCoordinator" (
 "organizationId" TEXT NOT NULL,
 "generation" INTEGER NOT NULL DEFAULT 0,
 "operationId" TEXT,
 "leaseToken" TEXT,
 "leaseUntil" TIMESTAMP(3),
 "paidThrough" TIMESTAMP(3),
 "financialHoldSubscriptionId" TEXT,
 "reviewReason" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StripeBillingCoordinator_pkey" PRIMARY KEY ("organizationId"),
 CONSTRAINT "StripeBillingCoordinator_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "StripeBillingCoordinator_operationId_organizationId_fkey" FOREIGN KEY ("operationId", "organizationId") REFERENCES "StripeBillingOperation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
