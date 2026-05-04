-- Allow cases to exist before an official case number is assigned.
ALTER TABLE "Case" ALTER COLUMN "caseNumber" DROP NOT NULL;
