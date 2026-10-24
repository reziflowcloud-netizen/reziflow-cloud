import { Prisma } from '@prisma/client'
import { notificationText } from './notificationI18n.ts'
import { CASE_NOTIFICATION_DATE_FIELDS } from './notificationPolicy.ts'

export type CandidateMode = 'frequent' | 'daily' | 'task' | 'lead' | 'case'
export type NotificationCandidate = { key: string; kind: 'task' | 'lead' | 'case'; id: string; organizationId: string; type: string; occurrence: string; triggerAt: Date }
// The recovery window is bounded to one day, and never crosses a tenant's
// activation boundary. Retries/late deliveries use the same frozen run time.
export const CANDIDATE_RECOVERY_MS = 86400000
const closed = '(архив|архів|archive|archiw|отказ|відмова|odmowa|refusal|rejected|закрыт|закрит|closed|zamkni)'
const day = (date: Prisma.Sql) => Prisma.sql`to_char(${date} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
const instant = (date: Prisma.Sql) => Prisma.sql`to_char(${date} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
const localMidnight = (date: Prisma.Sql, offset: number) => Prisma.sql`((${date} AT TIME ZONE 'UTC')::date + ${offset}::int)::timestamp AT TIME ZONE 'Europe/Warsaw'`
function reminderInstant() {
  // PostgreSQL defaults to the later DST fold; CRM chooses the first occurrence.
  return Prisma.sql`CASE WHEN m.meta->>'reminderAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}' AND pg_input_is_valid(m.meta->>'reminderAt', 'timestamp with time zone') THEN
    CASE WHEN m.meta->>'reminderAt' ~ '(Z|[+-][0-9]{2}:?[0-9]{2})$' THEN (m.meta->>'reminderAt')::timestamptz
    ELSE CASE WHEN (((m.meta->>'reminderAt')::timestamp AT TIME ZONE 'Europe/Warsaw') - interval '1 hour') AT TIME ZONE 'Europe/Warsaw' = (m.meta->>'reminderAt')::timestamp
      THEN ((m.meta->>'reminderAt')::timestamp AT TIME ZONE 'Europe/Warsaw') - interval '1 hour'
      ELSE (m.meta->>'reminderAt')::timestamp AT TIME ZONE 'Europe/Warsaw' END END ELSE NULL END`
}
export function notificationCandidateQuery(mode: CandidateMode, after: string, now: Date, limit = 26, overrides?: { id: string; since: Date }[]) {
  const orgs = overrides ? overrides.length ? Prisma.sql`SELECT v.id, v.since FROM (VALUES ${Prisma.join(overrides.map(o => Prisma.sql`(${o.id}::text, ${o.since}::timestamptz)`))}) v(id, since)` : Prisma.sql`SELECT id, NULL::timestamptz AS since FROM "Organization" WHERE false` : Prisma.sql`SELECT id, "notificationAutomationActivatedAt" AT TIME ZONE 'UTC' AS since FROM "Organization" WHERE "notificationAutomationEnabled" = true AND "notificationAutomationActivatedAt" IS NOT NULL`
  const task = Prisma.sql`SELECT 'task'::text AS kind, t.id, t."organizationId", t."assignedToId", o.since,
    CASE WHEN (t."dueDate" AT TIME ZONE 'UTC')::date < (${now}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date THEN 'task_overdue' ELSE 'task_due' END AS type,
    CASE WHEN (t."dueDate" AT TIME ZONE 'UTC')::date < (${now}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date THEN ${day(Prisma.sql`t."dueDate" AT TIME ZONE 'UTC'`)}
      ELSE coalesce(${day(Prisma.sql`t."dueDate" AT TIME ZONE 'UTC'`)}, '') || ':' || coalesce(${instant(Prisma.sql`r.reminder`)}, 'default') END AS occurrence,
    CASE WHEN (t."dueDate" AT TIME ZONE 'UTC')::date < (${now}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date THEN ${localMidnight(Prisma.sql`t."dueDate" AT TIME ZONE 'UTC'`, 1)}
      ELSE coalesce(r.reminder, ${localMidnight(Prisma.sql`t."dueDate" AT TIME ZONE 'UTC'`, -1)}) END AS trigger
    FROM enabled_orgs o JOIN "Task" t ON t."organizationId" = o.id
    CROSS JOIN LATERAL (SELECT CASE WHEN pg_input_is_valid(t.description, 'jsonb') THEN t.description::jsonb ELSE '{}'::jsonb END AS meta) m
    CROSS JOIN LATERAL (SELECT ${reminderInstant()} AS reminder) r
    WHERE lower(trim(t.status)) NOT IN ('done','completed','cancelled','canceled','inactive')
      AND NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(m.meta) = 'object' THEN m.meta ELSE '{}'::jsonb END) a WHERE a.key IN ('leadReminder','caseImportantDate','fingerprintsAppointment','predictedDecision') AND a.value NOT IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb))
      AND (t.id NOT LIKE 'case-actualization-%' OR EXISTS (SELECT 1 FROM "Case" control WHERE control.id = m.meta->'documentActualization'->>'caseId' AND control."organizationId" = t."organizationId" AND control."decisionReceived" = false AND control."assignedToId" = t."assignedToId" AND (control."employeeId" IS NULL OR EXISTS (SELECT 1 FROM "Employee" owner WHERE owner.id=control."employeeId" AND owner."organizationId"=control."organizationId" AND owner.active=true AND owner."userId"=t."assignedToId"))))
      AND (t."dueDate" IS NOT NULL OR r.reminder IS NOT NULL)
      AND (r.reminder IS NOT NULL OR (t."dueDate" AT TIME ZONE 'UTC')::date <= (${now}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date + 1)`
  const lead = Prisma.sql`SELECT 'lead'::text AS kind, l.id, l."organizationId", l."assignedToId", o.since,
    'lead_contact'::text AS type, ${instant(Prisma.sql`l."nextContactAt" AT TIME ZONE 'UTC'`)} AS occurrence,
    l."nextContactAt" AT TIME ZONE 'UTC' AS trigger FROM enabled_orgs o JOIN "Lead" l ON l."organizationId" = o.id
    WHERE l."nextContactAt" IS NOT NULL AND l."convertedAt" IS NULL AND l."convertedClientId" IS NULL
      AND (l."lastContactAt" IS NULL OR l."lastContactAt" < l."nextContactAt")
      AND lower(trim(l.status)) !~ ${closed} AND lower(trim(l.status)) NOT IN ('не подходит','не підходить','nie pasuje','lost','cancelled','canceled')
      AND lower(trim(l.status)) !~ '(клиент|клієнт|client|klient)'
      AND EXISTS (SELECT 1 FROM "Employee" e WHERE e."organizationId" = l."organizationId" AND e.active = true AND e."userId" = l."assignedToId" AND (l."employeeId" IS NULL OR e.id = l."employeeId"))`
  const builtIns = Prisma.join(CASE_NOTIFICATION_DATE_FIELDS.map(field => Prisma.sql`(${field}::text, c.${Prisma.raw('"'+field+'"')})`))
  const aliases = CASE_NOTIFICATION_DATE_FIELDS.flatMap(field => [field,...Object.values(notificationText).map(copy => copy.dates[field])].map(label => ({ field, label })))
  const aliasSql = Prisma.join(aliases.map(a => Prisma.sql`(${a.field}::text, ${a.label}::text)`))
  const caseDates = Prisma.sql`SELECT 'case'::text AS kind, c.id, c."organizationId", c."assignedToId", o.since,
    'case_date'::text AS type, d.kind || ':' || ${day(Prisma.sql`d.date AT TIME ZONE 'UTC'`)} || ':' || w.period AS occurrence,
    ((d.date AT TIME ZONE 'UTC')::date - w.days)::timestamp AT TIME ZONE 'Europe/Warsaw' AS trigger
    FROM enabled_orgs o JOIN "Case" c ON c."organizationId" = o.id
    CROSS JOIN LATERAL (
      SELECT b.kind, b.date FROM (VALUES ${builtIns}) b(kind,date)
      UNION ALL
      SELECT 'custom:' || x.id::text, x.date FROM "CaseCustomDate" x WHERE x."caseId" = c.id
        AND NOT EXISTS (SELECT 1 FROM (VALUES ${builtIns}) b(kind,date) JOIN (VALUES ${aliasSql}) a(kind,label) ON a.kind = b.kind
          WHERE b.date IS NOT NULL AND b.date::date = x.date::date AND regexp_replace(lower(normalize(a.label,NFKC)), '[^[:alnum:]]','','g') = regexp_replace(lower(normalize(x.label,NFKC)), '[^[:alnum:]]','','g'))
        AND NOT EXISTS (SELECT 1 FROM "CaseCustomDate" prior WHERE prior."caseId" = c.id AND prior.id < x.id AND prior.date::date = x.date::date
          AND x.label <> '' AND regexp_replace(lower(normalize(prior.label,NFKC)), '[^[:alnum:]]','','g') = regexp_replace(lower(normalize(x.label,NFKC)), '[^[:alnum:]]','','g'))
    ) d(kind,date)
    CROSS JOIN (VALUES ('7d'::text,7),('1d'::text,1)) w(period,days)
    WHERE lower(trim(c.status)) !~ ${closed} AND d.date IS NOT NULL
      AND (c."employeeId" IS NULL OR EXISTS (SELECT 1 FROM "Employee" e WHERE e.id = c."employeeId" AND e."organizationId" = c."organizationId" AND e.active = true AND e."userId" = c."assignedToId"))
      AND (d.date AT TIME ZONE 'UTC')::date - w.days = (${now}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date`
  const parts = mode === 'frequent' ? [task,lead] : mode === 'task' ? [task] : mode === 'lead' ? [lead] : [caseDates]
  return Prisma.sql`WITH enabled_orgs AS MATERIALIZED (${orgs}), raw_events AS (${Prisma.join(parts,' UNION ALL ')}),
    candidates AS (
      SELECT r.*, r.kind || ':' || r.id || ':' || r.type || ':' || r.occurrence AS key
      FROM raw_events r WHERE r.trigger >= r.since AND r.trigger <= ${now} AND r.trigger >= ${new Date(now.getTime()-CANDIDATE_RECOVERY_MS)}
        AND EXISTS (SELECT 1 FROM "User" responsible WHERE responsible.id = r."assignedToId" AND responsible."organizationId" = r."organizationId")
        AND EXISTS (SELECT 1 FROM "User" u LEFT JOIN "NotificationPreference" p ON p."organizationId" = u."organizationId" AND p."userId" = u.id
          WHERE u."organizationId" = r."organizationId" AND (u.id = r."assignedToId" OR (u.role IN ('owner','admin') AND u."restrictedAccess" = false AND p.scope = 'team'))
            AND (p.events #> ARRAY[r.type,'inApp'] IS DISTINCT FROM 'false'::jsonb OR (p."pushEnabled" = true AND p.events #> ARRAY[r.type,'push'] IS DISTINCT FROM 'false'::jsonb))
            AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."organizationId" = u."organizationId" AND n."userId" = u.id
              AND n."dedupeKey" = r.type || ':' || r.kind || ':' || r.id || ':' || r.occurrence))
    ) SELECT key, kind, id, "organizationId", type, occurrence, trigger AS "triggerAt"
      FROM candidates WHERE key > ${after} ORDER BY key LIMIT ${limit}`
}
