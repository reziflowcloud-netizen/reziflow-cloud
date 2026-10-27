-- Additive, disabled-by-default Lead Ads pilot. Existing Meta integrations are untouched.
CREATE TABLE "MetaLeadAdsBinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'off',
    "activatedAt" TIMESTAMP(3),
    "pilotLeadIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaLeadAdsBinding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MetaLeadAdsBinding_mode_check" CHECK ("mode" IN ('off', 'pilot', 'live', 'shadow'))
);

CREATE TABLE "MetaLeadAdsDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "eventFingerprint" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "acceptedMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaLeadAdsDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MetaLeadAdsDelivery_status_check" CHECK ("status" IN ('pending', 'processing', 'complete', 'blocked', 'shadow')),
    CONSTRAINT "MetaLeadAdsDelivery_attempts_check" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "MetaLeadAdsBinding_appId_pageId_formId_key" ON "MetaLeadAdsBinding"("appId", "pageId", "formId");
CREATE UNIQUE INDEX "MetaLeadAdsBinding_id_organizationId_key" ON "MetaLeadAdsBinding"("id", "organizationId");
CREATE INDEX "MetaLeadAdsBinding_organizationId_enabled_idx" ON "MetaLeadAdsBinding"("organizationId", "enabled");
CREATE UNIQUE INDEX "MetaLeadAdsDelivery_appId_eventFingerprint_key" ON "MetaLeadAdsDelivery"("appId", "eventFingerprint");
CREATE INDEX "MetaLeadAdsDelivery_status_nextAttemptAt_idx" ON "MetaLeadAdsDelivery"("status", "nextAttemptAt");
CREATE INDEX "MetaLeadAdsDelivery_organizationId_status_idx" ON "MetaLeadAdsDelivery"("organizationId", "status");

ALTER TABLE "MetaLeadAdsBinding" ADD CONSTRAINT "MetaLeadAdsBinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaLeadAdsDelivery" ADD CONSTRAINT "MetaLeadAdsDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaLeadAdsDelivery" ADD CONSTRAINT "MetaLeadAdsDelivery_bindingId_organizationId_fkey" FOREIGN KEY ("bindingId", "organizationId") REFERENCES "MetaLeadAdsBinding"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
