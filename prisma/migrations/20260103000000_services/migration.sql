-- Migration: add Service table and serviceId to Case
-- Safe idempotent migration

CREATE TABLE IF NOT EXISTS "Service" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Service_name_key" ON "Service"("name");

ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "serviceId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Case_serviceId_fkey'
  ) THEN
    ALTER TABLE "Case" ADD CONSTRAINT "Case_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Service" ("name", "description", "color") VALUES
  ('Побыт часовы (Временное пребывание)', 'Оформление временного пребывания', '#3b82f6'),
  ('Побыт сталы (Постоянное пребывание)', 'Оформление постоянного пребывания', '#10b981'),
  ('Зезволене на працу (Разрешение на работу)', 'Оформление разрешения на работу', '#f59e0b'),
  ('Обывательство (Гражданство)', 'Оформление гражданства', '#8b5cf6'),
  ('Карта побыту (Карта пребывания)', 'Оформление карты пребывания', '#ec4899')
ON CONFLICT ("name") DO NOTHING;
