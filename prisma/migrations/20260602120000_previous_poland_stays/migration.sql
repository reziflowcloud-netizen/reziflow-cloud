CREATE TABLE IF NOT EXISTS "PreviousPolandStay" (
  "id" SERIAL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3),
  "exitDate" TIMESTAMP(3),
  "basis" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreviousPolandStay_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PreviousPolandStay_clientId_order_idx" ON "PreviousPolandStay"("clientId", "order");

INSERT INTO "PreviousPolandStay" ("clientId", "entryDate", "exitDate", "basis", "order")
SELECT "id", "previousPolandEntryDate", "previousPolandExitDate", "previousPolandBasis", 0
FROM "Client"
WHERE ("previousPolandEntryDate" IS NOT NULL OR "previousPolandExitDate" IS NOT NULL OR NULLIF("previousPolandBasis", '') IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM "PreviousPolandStay"
    WHERE "PreviousPolandStay"."clientId" = "Client"."id"
  );
