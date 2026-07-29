# Project State

Last audited against the repository by Codex: 2026-07-29.

## Project

LegalHub CRM is a multi-tenant SaaS CRM for legalization and immigration
agencies in Poland. The same Next.js application contains the public site,
registration and legal pages, organization administration, and the internal
CRM.

Application root:

```text
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration
```

GitHub:

```text
https://github.com/reziflowcloud-netizen/reziflow-cloud.git
```

Production:

```text
https://legalhubcrm.com
```

## Architecture

- Next.js 14 App Router application with React 18 and TypeScript.
- Route handlers under `src/app/api` provide the application API.
- Prisma 5.13 is the ORM; PostgreSQL is the only configured datasource.
- Authentication uses a signed JWT in the `auth-token` cookie.
- `organizationId` is the tenant boundary used by application queries.
- `src/lib/apiScope.ts` adds restricted-user filtering for cases, clients,
  leads, and tasks.
- Organization feature and integration settings are stored in the
  `Organization.settings` JSON field.
- Tailwind is installed, while much of the CRM UI also uses shared CSS in
  `src/app/globals.css`.

Important build behavior:

```text
npm run build
  -> node scripts/vercel-migrate.js
  -> prisma generate
  -> next build
```

When `DIRECT_URL` exists, `scripts/vercel-migrate.js` runs
`prisma migrate deploy` and then `prisma/seed.js`. Do not run `npm run build`
for a read-only audit. `npx next build` avoids that wrapper but should still be
used deliberately.

## Current Git Snapshot

Audit started from:

```text
branch: main
HEAD: 1c3f879 Add batch MOS document submission
origin/main: 1c3f879
```

Before this handoff documentation edit there were no uncommitted application
changes. One unrelated untracked file already existed:

```text
legalhub-os/MESSAGING_INTEGRATIONS_AUDIT.md
```

Do not delete, overwrite, or commit that file without first deciding its
ownership with the user. The edits to `PROJECT_STATE.md` and `HANDOFF.md`
created by this audit are intentionally left uncommitted.

## Implemented Modules

- Public landing, pricing, registration, login, contact, Privacy Policy,
  Regulamin, and data deletion pages.
- Multi-organization users, roles, restricted access, superadmin organization
  management, plan limits, trials, manual overrides, and referrals.
- Dashboard metrics, recent records, upcoming events, and configurable quick
  start.
- Leads: configurable statuses, sources, filters, table/board views, contact
  history, reminders, messages, phone channels, qualification fields, bulk
  actions, assignment, and conversion to clients/cases.
- Clients: extended identity/contact data, multiple phones, family links,
  responsible-user list column, cases, custom fields, import/export.
- Cases: services, statuses, responsible employees, payments, comments,
  documents, MOS/correspondence data, important dates, custom sections/fields,
  and batch MOS document submission.
- Tasks, priorities, calendar, stages, notifications, and automatic reminders.
- Settings for services, statuses, users, employees, fields/sectors,
  integrations, storage, import/export, and tutorial visibility.
- Document templates and Cloudinary/Dropbox-backed case documents.

## Assignment Model: User vs Employee

This distinction is security-sensitive.

`assignedToId` is a relation to a real CRM `User`. It is used by
`src/lib/apiScope.ts` to restrict data visible to a user:

```text
Lead.assignedToId   -> User.id
Case.assignedToId   -> User.id
Client.assignedToId -> User.id
Task.assignedToId   -> User.id
```

`Employee` is a separate organization business directory used as the visible
responsible employee:

```text
Employee(id, organizationId, name, active, createdAt)
Lead.employeeId -> Employee.id
Case.employeeId -> Employee.id
```

Confirmed behavior:

- Migration `20260627120000_lead_employee_assignment` adds
  `Lead.employeeId`, its organization/employee index, and the foreign key to
  `Employee`.
- `Case.employeeId` is older and originates from
  `20260105000000_case_v2`; it was not added by the lead migration.
- Lead create/update APIs validate `employeeId` inside the organization.
- The visible responsible field in lead UI uses `Employee`; the old visible
  CRM-user selector was removed.
- Selecting a lead employee does not generally replace `Lead.assignedToId`.
  Restricted users still force `assignedToId` to their own `User.id`.
- Lead conversion copies `Lead.employeeId` to `Case.employeeId` and carries
  `assignedToId` separately for access ownership.
- `src/lib/employeeSync.ts` ensures every organization user has an active
  same-name Employee record and backfills missing `employeeId` on leads/cases
  that already have `assignedToId`.
- Case create/update resolves a selected Employee back to a User by normalized
  name and sets `Case.assignedToId` when a matching user exists.

The Employee/User association is name-based, not an explicit database
relation. Do not replace or merge these fields without redesigning restricted
access and migrating existing data.

## Custom Fields And MOS

- `CustomSection.targetSectionKey` lets an organization keep a custom section
  as a standalone card or embed it into a supported standard client/case
  sector.
- Target keys are validated through `src/lib/ui-sections.ts`.
- Values remain in `CustomFieldValue`; organization-defined fields do not add
  a database column per field.
- Active custom fields are included in full, client-only, and case-only CSV
  exports.
- `Case.mosEmail` is a real nullable column. Its visibility is controlled by
  `Organization.settings.mosEmailFieldEnabled` in Settings -> Fields and
  sectors.
- Case MOS documents can be selected individually, as a Shift range, or all at
  once. A case-scoped API validates the configured document names and creates
  completed Task records with one `createMany` call for the shared submission
  date.

## Integrations

- Meta OAuth connection, page/Instagram selection, token diagnostics,
  subscriptions, disconnect, Facebook Lead Ads webhooks, and a shared
  Facebook Messenger/Instagram Direct messages webhook exist in code.
- Meta Advanced Access/App Review is external state and cannot be inferred
  from this repository. The last user-provided state was an active review for
  `instagram_basic`, `pages_read_engagement`, and
  `instagram_manage_messages`.
- Generic lead webhooks and a Google Sheets Apps Script webhook URL are
  supported.
- A Telegram lead webhook route exists; this is not evidence of full two-way
  Telegram chat.
- There is no confirmed two-way WhatsApp or Viber messaging implementation.
- Cloudinary is the default document storage path; organizations can enable
  Dropbox storage in integration settings.
- New-registration email notification code exists.

## Prisma And Migrations

The repository contains migrations through:

```text
20260728150000_custom_section_target
```

Migrations created during the current development period:

```text
20260627120000_lead_employee_assignment
20260728120000_case_mos_email
20260728150000_custom_section_target
```

Repository code proves that these migrations exist, but it does not prove
which database environments have applied them. A previous handoff recorded
that the lead employee migration had been applied to one Supabase database,
but this 2026-07-29 audit did not connect to any database and does not re-verify
that claim. The two July 28 migrations are likewise not marked as applied by
anything in git.

Do not run `prisma migrate deploy` merely to inspect status. Verify the intended
database and deployment environment first.

## Recent Significant Changes

- Employee responsibility for leads and synchronization between organization
  users and Employee records.
- Tutorial video controls and quick-start step videos.
- Dashboard/list loading optimizations.
- Registration consent, legal documents, and new-registration notifications.
- Organization deletion cleanup for document files.
- Pricing limits, trials, admin overrides, and organization aggregate counts.
- Responsible columns in client/case lists.
- Lead webhook timeout fix, horizontal scrolling, and dark-theme lead styling.
- Meta shared messages webhook and disconnect action.
- Organization-specific MOS email field.
- Custom fields embedded in standard sectors and exported automatically.
- Batch submission of multiple MOS documents.

## Verification Snapshot

During the final audit:

```text
git status --short --branch
git diff --check
git log --oneline -10
npx tsc --noEmit
```

All commands completed successfully; TypeScript reported no errors. No build,
Prisma migration, seed, or database-changing command was run during this
handoff audit.

The latest application commit `1c3f879` had already passed `npx tsc --noEmit`,
`npx next build`, a local browser check of MOS multi-selection, and a successful
Vercel status before this audit began.

## Known Risks And Technical Debt

- Employee/User synchronization depends on normalized display names. Duplicate
  names and later renames can create ambiguous or stale mappings.
- The batch MOS endpoint skips existing submissions in application logic, but
  there is no database unique constraint preventing duplicate concurrent
  submissions.
- `src/lib/auth.ts` contains a development fallback for `JWT_SECRET`.
  Production must provide a strong environment value.
- `Case.cabinetPassword` is stored as a normal nullable string; no encryption
  layer was observed in the audited Prisma/API path.
- Some legacy Russian/Ukrainian source strings are mojibake. Avoid broad
  encoding rewrites without UI regression testing.
- No dedicated automated test script is configured in `package.json`.
- `npm run build` can mutate the configured database and run seed logic.

## Security

Do not read, print, copy, or commit `.env` files, passwords, API keys, access
tokens, or other secrets. Production values are managed outside the repository.
