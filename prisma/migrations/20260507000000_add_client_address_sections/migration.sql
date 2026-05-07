ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "originCountryAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "previousResidenceAddress" TEXT;
