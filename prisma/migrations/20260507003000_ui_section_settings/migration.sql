CREATE TABLE "UiSectionSetting" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UiSectionSetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UiSectionSetting_organizationId_idx" ON "UiSectionSetting"("organizationId");

CREATE UNIQUE INDEX "UiSectionSetting_organizationId_scope_sectionKey_key" ON "UiSectionSetting"("organizationId", "scope", "sectionKey");

ALTER TABLE "UiSectionSetting" ADD CONSTRAINT "UiSectionSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
