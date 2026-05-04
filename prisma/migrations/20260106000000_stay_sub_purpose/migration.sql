-- Add staySubPurpose field to Case table
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "staySubPurpose" TEXT;
