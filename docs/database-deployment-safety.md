# Database deployment safety

`npm run build` and Vercel's normal build must only generate the Prisma client
and compile the app. They must never migrate, push schema, or seed a database.
There is no automatic migration or seed in `package.json` build/postinstall.
Keep Vercel's Build Command on the project `npm run build` pattern; do not
override it with a command containing `migrate`, `db push`, or `seed`.
Vercel project inspection on 22 September 2026 showed the Next.js preset and
Build Command `npm run build` or `next build`; no `vercel.json` overrides it.

The Preview deployment `dpl_6d7JuYmWJhBZoELXfqLSPQXLAg8N` used Production
database credentials. Preserve its forensic logs/evidence, but do not use it
for QA. Do not delete/disable it without explicit approval. Do not reuse
Production `DATABASE_URL` or `DIRECT_URL` in Preview for migration or write QA.
The deployment metadata inspected on 22 September 2026 identifies target
`preview`, status `Ready`, and creation at 18 September 2026 19:43:54 CEST.
The production-credential connection is the reported incident, not inferred
from deployment metadata.
The saved build log contains the migration name and automatic seed step with
seed completion. Do not treat the log alone as an independent verification of
the production `_prisma_migrations` checksum or the seed's data effects.
Until a separate Preview database exists, Preview migrations are forbidden;
even read-only/UI Preview QA is unsafe for feature code that could write data.

## Explicit production migration procedure

Only an operator in a controlled maintenance environment may run
`npm run db:migrate:deploy`. Before doing so, review the migration SQL and
target database, take a backup, and ensure production deployment order is
appropriate. Set all of these locally for this one command:

- `DIRECT_URL`: the intended production PostgreSQL direct connection;
- `DB_MIGRATE_TARGET=production`;
- `DB_MIGRATE_CONFIRM=production`;
- `DB_MIGRATE_EXPECTED_HOST`: the exact host from that reviewed `DIRECT_URL`.

The command refuses unknown targets, Preview (`VERCEL_ENV=preview` or
`DB_MIGRATE_TARGET=preview`), missing confirmation, missing credentials, and
host mismatches. The hostname check is an additional guard, **not proof** of
the database identity: shared pooler hosts can serve multiple databases.
Verify the target project/database out of band before confirming. Do not log
or paste the URL/credentials. This command invokes `prisma migrate deploy`
only; it never runs seed. Preview migrations require a separately designed
workflow and database and are not supported by this command.

`npm run seed` is an explicit, separate maintenance action. It upserts the
admin User and could change password hash, name, role, or organizationId;
never include it in a build/deploy command. An error now exits nonzero.
The production app's normal login, if confirmed by the user, is functional
verification only and not evidence that seed had no side effects.

## Reconciliation of the already-applied migration

The SQL file `20260918190000_staff_identity_and_lead_channel_routes` is copied
byte-for-byte from Development 10 commit `d29d2dcd9dbb616570eaf1a8915da87aef36baeb`.
Its SHA-256 is `681e98fad1c81ad4363bdc7f9f066f64c5b6532c8a84228a66317f54fbfd20f5`.
It is included as repository schema history only; do not run it again for this
hotfix. Before production review, independently compare the corresponding
`_prisma_migrations` production record (`migration_name`, `checksum`,
`finished_at`, `rolled_back_at`, `logs`) in a read-only session. The expected
record has this checksum, non-null `finished_at`, null `rolled_back_at`, and
no failed-migration logs. Do not print credentials or customer records.
