-- Add new fields to Client table
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "previousFirstName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "previousLastName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "maidenName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "birthPlace" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "citizenship" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "education" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "statusUKR" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "motherName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "branch" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "legalTitle" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "rentalEndDate" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lastEntryDate" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "firstResidenceCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "residenceCardExpiry" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "finesInPoland" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "finesDescription" TEXT;

-- CreateTable TravelHistory
CREATE TABLE IF NOT EXISTS "TravelHistory" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TravelHistory_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "TravelHistory" ADD CONSTRAINT "TravelHistory_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also add to schema.prisma (добавить в модель Client):
-- previousFirstName  String?
-- previousLastName   String?
-- maidenName         String?
-- birthDate          DateTime?
-- birthPlace         String?
-- citizenship        String?
-- nationality        String?
-- maritalStatus      String?
-- education          String?
-- statusUKR          Boolean @default(false)
-- fatherName         String?
-- motherName         String?
-- branch             String?
-- legalTitle         String?
-- rentalEndDate      DateTime?
-- lastEntryDate      DateTime?
-- firstResidenceCard Boolean @default(false)
-- residenceCardExpiry DateTime?
-- finesInPoland      Boolean @default(false)
-- finesDescription   String?
-- travelHistory      TravelHistory[]

-- New model (добавить в конец schema.prisma):
-- model TravelHistory {
--   id        Int       @id @default(autoincrement())
--   clientId  String
--   entryDate DateTime?
--   exitDate  DateTime?
--   country   String
--   createdAt DateTime  @default(now())
--   client    Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
-- }
