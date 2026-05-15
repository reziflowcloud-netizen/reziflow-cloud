ALTER TABLE "CaseDocument"
  ADD COLUMN IF NOT EXISTS "dropboxStorageId" TEXT,
  ADD COLUMN IF NOT EXISTS "dropboxPath" TEXT,
  ADD COLUMN IF NOT EXISTS "dropboxSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dropboxSyncStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "dropboxSyncError" TEXT;

UPDATE "CaseDocument"
SET
  "dropboxStorageId" = COALESCE("dropboxStorageId", "storageId"),
  "dropboxPath" = COALESCE("dropboxPath", "storagePath"),
  "dropboxSyncStatus" = COALESCE("dropboxSyncStatus", 'synced'),
  "dropboxSyncedAt" = COALESCE("dropboxSyncedAt", "createdAt")
WHERE "storageProvider" = 'dropbox';
