-- Add new fields to Case table
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "trustee" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "employeeId" INTEGER;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "workContractType" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "workContractNumber" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "workContractDate" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "workContractSigned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Employee
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable CaseCustomDate
CREATE TABLE IF NOT EXISTS "CaseCustomDate" (
    "id" SERIAL NOT NULL,
    "caseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CaseCustomDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable DocUpdate
CREATE TABLE IF NOT EXISTS "DocUpdate" (
    "id" SERIAL NOT NULL,
    "caseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable CaseDocument
CREATE TABLE IF NOT EXISTS "CaseDocument" (
    "id" SERIAL NOT NULL,
    "caseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'image',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (без IF NOT EXISTS — PostgreSQL не поддерживает)
DO $$ BEGIN
    ALTER TABLE "Case" ADD CONSTRAINT "Case_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CaseCustomDate" ADD CONSTRAINT "CaseCustomDate_caseId_fkey"
        FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DocUpdate" ADD CONSTRAINT "DocUpdate_caseId_fkey"
        FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_caseId_fkey"
        FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
