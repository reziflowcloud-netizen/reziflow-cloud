# Staff Routing V2: expand-first rollout

Production migration `20260922140000_staff_routing_v2` is an **expand** step only. It adds
`nextPosition` and `LeadChannelRouteMember`, copies each existing V1 `employeeId` into
member position 0, and seeds position 0 for new V1 route inserts during the
compatibility window. It retains the V1 `employeeId`, foreign key and index.
The V2 application mirrors the first member into `employeeId` for old-app reads;
round-robin and identity-impact logic read members, not the legacy mirror.

## Preconditions for any future production migration

1. Independently back up Production's application data with `pg_dump
   --schema=public --format=custom --no-owner --no-acl` to a private location
   outside the repository, and verify a restore into a separate clean local DB.
2. Compare restored and source counts for Organizations, Users, Employees,
   Leads, Clients, Cases, Tasks, CaseDocument metadata, Payments,
   LeadChannelRoute, and `_prisma_migrations`.
3. Confirm that the trusted `DIRECT_URL` targets the intended Production host
   (`aws-0-eu-west-1.pooler.supabase.com` for the current project).
   Do not print the URL, password or backup contents.
4. Confirm that the **only** pending migration is
   `20260922140000_staff_routing_v2`. Stop if the pending set differs.
5. In the controlled maintenance window, set `DB_MIGRATE_TARGET=production`,
   `DB_MIGRATE_CONFIRM=production`, and `DB_MIGRATE_EXPECTED_HOST` to the
   independently verified Production host. With trusted `DIRECT_URL` already
   loaded securely, run `npm run db:migrate:deploy`. Do not run it from Preview.

No migration or application deployment is authorized by this note.

The full-cluster custom-format dump contains Supabase-managed schemas. A full
restore into plain local PostgreSQL 18 stops at the unavailable
`supabase_vault` extension. LegalHub's current `main` code has no SQL/Prisma
reference to non-`public` Supabase schemas or `supabase_vault`; Production's
`public` objects have no cross-schema FKs or managed-schema defaults/views/
functions/triggers. This is a platform-object restore limitation, not an
application-data dependency.

A **separate `public`-only custom-format application backup** was restored
without errors into a clean disposable local DB. Recovery verification matched
all 39 tables, 107 indexes, 58 foreign keys, 20 sequences, 139 defaults, and
all 45 applied migration-history names. All 11 requested table counts and the
three linked/assigned aggregate checks matched Production; Prisma diff against
current `main` was zero. The current application returned HTTP 200 for Dashboard,
Leads, Cases, Clients, Tasks, Calendar, and their read-only list APIs against
the restored DB, using a local read-only role and no external integrations.
Thus the application-data recovery backup is verified; the full Supabase
platform restore is not part of this feature's recovery requirement.

## Compatibility and rollback

After expand, the V1 application can continue to read and create single-employee
routes. After deploying V2, the previous stable application version remains an
availability rollback point **without a DB rollback**: it reads the first member
through the legacy mirror. While rolled back, multi-member round-robin semantics
are unavailable. Freeze routing Settings writes during rollback: V1 Save rewrites
routes as single-member rules and would discard V2 multi-member configuration.
Preserve a verified snapshot of routing configuration before any rollback.
Prefer a forward fix for V2 functionality; do not make DB rollback the default.

## Later contract (not part of this rollout)

Only after several stable Production days and an audit confirming that no
deployed code reads or writes `LeadChannelRoute.employeeId`, schedule a separate
approved contract migration to remove the compatibility trigger, the old V1
foreign key/index, and `employeeId`. Remove its temporary Prisma field and V2
compatibility mirror at that time. Do not create or deploy the contract migration
alongside expand.
