-- Migration: add TaskPriority table
CREATE TABLE IF NOT EXISTS "TaskPriority" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskPriority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskPriority_name_key" ON "TaskPriority"("name");

-- Insert default priorities
INSERT INTO "TaskPriority" ("name", "color", "order") VALUES
  ('Нормально', '#3b82f6', 0),
  ('Горить', '#f59e0b', 1),
  ('Срочно', '#ef4444', 2),
  ('Можно подождать', '#6b7280', 3)
ON CONFLICT ("name") DO NOTHING;
