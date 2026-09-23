-- Additive password-reset infrastructure. Safe for the previous application:
-- existing User rows receive version 0 and existing code ignores the new tables.
ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key"
  ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx"
  ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx"
  ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasswordResetRateLimit" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasswordResetRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetRateLimit_keyHash_windowStart_key"
  ON "PasswordResetRateLimit"("keyHash", "windowStart");
CREATE INDEX "PasswordResetRateLimit_windowStart_idx"
  ON "PasswordResetRateLimit"("windowStart");
