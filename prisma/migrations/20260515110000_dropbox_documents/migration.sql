ALTER TABLE "CaseDocument"
  ALTER COLUMN "url" DROP NOT NULL,
  ALTER COLUMN "publicId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'cloudinary',
  ADD COLUMN IF NOT EXISTS "storageId" TEXT,
  ADD COLUMN IF NOT EXISTS "storagePath" TEXT,
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "size" INTEGER;

UPDATE "CaseDocument"
SET "storageProvider" = 'cloudinary'
WHERE "storageProvider" IS NULL;
