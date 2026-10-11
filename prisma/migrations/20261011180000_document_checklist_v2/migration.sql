-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "checklistInitializedAt" TIMESTAMP(3),
ADD COLUMN     "checklistServiceId" INTEGER,
ADD COLUMN     "checklistVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "documentsReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "documentsReadyOccurrence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "documentTemplateInitializedAt" TIMESTAMP(3),
ADD COLUMN     "documentTemplateVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CaseDocument" ADD COLUMN     "checklistItemId" TEXT;

-- CreateTable
CREATE TABLE "ServiceDocumentRequirement" (
    "id" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "forMos" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseChecklistItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "forMos" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NEEDED',
    "receivedAt" TIMESTAMP(3),
    "mosSubmittedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "outsideTemplate" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CaseChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDocumentRequirement_serviceId_nameKey_key" ON "ServiceDocumentRequirement"("serviceId", "nameKey");

-- CreateIndex
CREATE INDEX "CaseChecklistItem_caseId_active_sortOrder_idx" ON "CaseChecklistItem"("caseId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CaseChecklistItem_caseId_nameKey_key" ON "CaseChecklistItem"("caseId", "nameKey");

-- CreateIndex
CREATE INDEX "CaseDocument_checklistItemId_idx" ON "CaseDocument"("checklistItemId");

-- AddForeignKey
ALTER TABLE "ServiceDocumentRequirement" ADD CONSTRAINT "ServiceDocumentRequirement_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseChecklistItem" ADD CONSTRAINT "CaseChecklistItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseChecklistItem" ADD CONSTRAINT "CaseChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ServiceDocumentRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "CaseChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
