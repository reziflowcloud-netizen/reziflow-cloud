-- Fix PostgreSQL sequences for all tables using SERIAL/autoincrement
-- This resets each sequence to be 1 higher than the current max id
-- Fixes: "Unique constraint failed on the fields: ('id')" errors

SELECT setval(
  pg_get_serial_sequence('"Service"', 'id'),
  COALESCE((SELECT MAX(id) FROM "Service"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"CaseStatus"', 'id'),
  COALESCE((SELECT MAX(id) FROM "CaseStatus"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"TaskPriority"', 'id'),
  COALESCE((SELECT MAX(id) FROM "TaskPriority"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"Employee"', 'id'),
  COALESCE((SELECT MAX(id) FROM "Employee"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"CaseOption"', 'id'),
  COALESCE((SELECT MAX(id) FROM "CaseOption"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"CaseCustomDate"', 'id'),
  COALESCE((SELECT MAX(id) FROM "CaseCustomDate"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"DocUpdate"', 'id'),
  COALESCE((SELECT MAX(id) FROM "DocUpdate"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"CaseDocument"', 'id'),
  COALESCE((SELECT MAX(id) FROM "CaseDocument"), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('"TravelHistory"', 'id'),
  COALESCE((SELECT MAX(id) FROM "TravelHistory"), 0) + 1,
  false
);
