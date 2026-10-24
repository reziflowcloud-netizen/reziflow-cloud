-- TRUSTED OPERATOR ONLY. Aggregate inventory; does not activate or mutate Cases.
-- psql "$TRUSTED_OPERATOR_CONNECTION" -X --set=ON_ERROR_STOP=1 --file=this-file
-- Do not paste credentials/results containing customer data. Output is counts only.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
WITH dates AS (
  SELECT c.id, c."organizationId", c."decisionReceived", c."assignedToId", c."employeeId",
    (SELECT MAX(CASE WHEN d.date::time='00:00:00' THEN d.date::date
      ELSE (d.date AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Warsaw')::date END)
     FROM "DocUpdate" d WHERE d."caseId"=c.id AND isfinite(d.date)
       AND d.description !~* '^\s*__[A-Z0-9_]+__:') AS genuine_date,
    CASE WHEN isfinite(c."predictedDecisionDate") THEN
      CASE WHEN c."predictedDecisionDate"::time='00:00:00' THEN c."predictedDecisionDate"::date
        ELSE (c."predictedDecisionDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Warsaw')::date END END AS predicted_date,
    EXISTS(SELECT 1 FROM "Task" t WHERE t."organizationId"=c."organizationId"
      AND t.id LIKE 'case-actualization-%' AND pg_input_is_valid(t.description,'jsonb')
      AND (CASE WHEN pg_input_is_valid(t.description,'jsonb') THEN t.description::jsonb ELSE '{}'::jsonb END)->'documentActualization'->>'caseId'=c.id) AS managed_cycle
  FROM "Case" c
), inventory AS (
 SELECT *, COALESCE(genuine_date,predicted_date)+90 AS next_date,
   EXISTS(SELECT 1 FROM "User" u WHERE u.id=dates."assignedToId" AND u."organizationId"=dates."organizationId"
    AND (dates."employeeId" IS NULL OR EXISTS(SELECT 1 FROM "Employee" e WHERE e.id=dates."employeeId" AND e."organizationId"=dates."organizationId" AND e.active=true AND e."userId"=u.id))) AS valid_owner
 FROM dates
)
SELECT COUNT(*) AS cases_total,
 COUNT(*) FILTER(WHERE "decisionReceived") AS stopped,
 COUNT(*) FILTER(WHERE genuine_date IS NOT NULL) AS with_genuine_date,
 COUNT(*) FILTER(WHERE genuine_date IS NULL AND predicted_date IS NOT NULL) AS predicted_fallback,
 COUNT(*) FILTER(WHERE next_date IS NULL) AS no_date,
 COUNT(*) FILTER(WHERE managed_cycle) AS existing_cycle_ledger,
 COUNT(*) FILTER(WHERE NOT managed_cycle AND NOT "decisionReceived" AND next_date IS NOT NULL) AS not_activated_with_date,
 COUNT(*) FILTER(WHERE NOT "decisionReceived" AND next_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw')::date) AS current_overdue,
 COUNT(*) FILTER(WHERE NOT "decisionReceived" AND next_date IS NOT NULL AND NOT valid_owner) AS without_valid_owner
FROM inventory;
ROLLBACK;
