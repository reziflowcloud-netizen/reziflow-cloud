CREATE TABLE "CustomSection" (
  "id" SERIAL NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomField" (
  "id" SERIAL NOT NULL,
  "sectionId" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'text',
  "placeholder" TEXT,
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldValue" (
  "id" SERIAL NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fieldId" INTEGER NOT NULL,
  "recordType" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "value" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomSection_organizationId_scope_idx" ON "CustomSection"("organizationId", "scope");
CREATE INDEX "CustomField_sectionId_idx" ON "CustomField"("sectionId");
CREATE INDEX "CustomFieldValue_organizationId_recordType_recordId_idx" ON "CustomFieldValue"("organizationId", "recordType", "recordId");
CREATE UNIQUE INDEX "CustomFieldValue_fieldId_recordType_recordId_key" ON "CustomFieldValue"("fieldId", "recordType", "recordId");

ALTER TABLE "CustomSection" ADD CONSTRAINT "CustomSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CustomSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
