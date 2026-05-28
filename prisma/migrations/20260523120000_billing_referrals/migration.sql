-- Billing/trial fields and referral partner tracking.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingStatus" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingProvider" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingCustomerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingSubscriptionId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingPriceId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "currentPeriodEndsAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "graceEndsAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_billingCustomerId_key" ON "Organization"("billingCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_billingSubscriptionId_key" ON "Organization"("billingSubscriptionId");
CREATE INDEX IF NOT EXISTS "Organization_billingStatus_idx" ON "Organization"("billingStatus");
CREATE INDEX IF NOT EXISTS "Organization_billingProvider_idx" ON "Organization"("billingProvider");

CREATE TABLE IF NOT EXISTS "ReferralPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contactEmail" TEXT,
    "commissionType" TEXT NOT NULL DEFAULT 'percentage',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "commissionMonths" INTEGER NOT NULL DEFAULT 12,
    "portalToken" TEXT,
    "payoutDetails" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartner_code_key" ON "ReferralPartner"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartner_portalToken_key" ON "ReferralPartner"("portalToken");
CREATE INDEX IF NOT EXISTS "ReferralPartner_status_idx" ON "ReferralPartner"("status");

CREATE TABLE IF NOT EXISTS "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "landingPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAttribution_organizationId_key" ON "ReferralAttribution"("organizationId");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_partnerId_idx" ON "ReferralAttribution"("partnerId");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_referralCode_idx" ON "ReferralAttribution"("referralCode");

DO $$
BEGIN
  ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "status" TEXT NOT NULL DEFAULT 'paid',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReferralPayout_partnerId_paidAt_idx" ON "ReferralPayout"("partnerId", "paidAt");

DO $$
BEGIN
  ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralCommission" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payoutId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReferralCommission_partnerId_status_idx" ON "ReferralCommission"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "ReferralCommission_organizationId_idx" ON "ReferralCommission"("organizationId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_sourceType_sourceId_idx" ON "ReferralCommission"("sourceType", "sourceId");

DO $$
BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "ReferralPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
