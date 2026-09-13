CREATE TABLE "ConferenceEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "anonymousSessionId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "language" TEXT,
    "ctaLocation" TEXT,
    "demoOrigin" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConferenceEvent_dedupeKey_key" ON "ConferenceEvent"("dedupeKey");
CREATE INDEX "ConferenceEvent_eventName_createdAt_idx" ON "ConferenceEvent"("eventName", "createdAt");
CREATE INDEX "ConferenceEvent_anonymousSessionId_createdAt_idx" ON "ConferenceEvent"("anonymousSessionId", "createdAt");
CREATE INDEX "ConferenceEvent_utmContent_createdAt_idx" ON "ConferenceEvent"("utmContent", "createdAt");
CREATE INDEX "ConferenceEvent_language_createdAt_idx" ON "ConferenceEvent"("language", "createdAt");
