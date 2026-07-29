# Handoff

Prepared for the next LegalHub CRM development chat on 2026-07-29.

## Start Prompt

```text
Continue development of LegalHub CRM.

Application root:
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration

Treat the repository as the source of truth, not old chat memory.

Before editing:
1. Read PROJECT_STATE.md, HANDOFF.md, DEPLOY_NOTES.md, package.json, and
   prisma/schema.prisma.
2. Run git status --short --branch, git diff --check, and
   git log --oneline -10.
3. Do not read .env or expose secrets.
4. Do not revert or commit existing changes without the user's permission.
5. Preserve the separate meanings of assignedToId (User/access) and
   employeeId (Employee/business responsibility).
```

## Repository Snapshot

Application root:

```text
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration
```

Audited branch and committed HEAD:

```text
branch: main
HEAD: 1c3f879 Add batch MOS document submission
origin/main: 1c3f879
```

At the start of this handoff audit, `main` was synchronized with
`origin/main`. There were no uncommitted application changes.

Working tree after preparing this handoff:

```text
M  PROJECT_STATE.md
M  HANDOFF.md
?? legalhub-os/MESSAGING_INTEGRATIONS_AUDIT.md
```

- The two Markdown modifications are this requested handoff update.
- They are intentionally not committed because the user did not authorize a
  commit.
- `legalhub-os/MESSAGING_INTEGRATIONS_AUDIT.md` existed before this audit. It
  was not read, edited, staged, or committed.
- There are no uncommitted changes under `src/`, `prisma/`, `scripts/`, or
  `package.json`.

Re-run `git status --short --branch`; do not assume this snapshot is still
current.

## Work Completed In This Long Chat

The following substantial work is present in committed code:

- Added `Lead.employeeId` and visible Employee assignment across lead create,
  detail, list/board, filters, bulk actions, and lead conversion.
- Preserved `Lead.assignedToId` as User ownership for restricted access.
- Added user-to-Employee synchronization and case responsibility
  synchronization.
- Added tutorial video controls, quick-start visibility, and videos for each
  quick-start step.
- Improved dashboard and list loading behavior.
- Updated legal pages and registration consent; added registration email
  notification.
- Added pricing/trial limits, organization overrides, organization counts, and
  safer organization document deletion.
- Added responsible columns to case/client lists and a client column toggle.
- Improved lead webhook reliability, table/board horizontal scrolling, and
  dark/slate styling.
- Added Meta OAuth diagnostics, shared messages webhook, subscriptions, and
  disconnect action. Meta App Review remains external and is not proven
  approved by code.
- Added organization-configurable MOS email field.
- Added custom fields inside existing standard sectors and automatic inclusion
  in CSV exports.
- Added multi-select MOS document submission with individual checkboxes,
  Shift-range selection, select-all, one date, server-side validation, and
  batch Task creation.

## Critical Assignment State

Do not simplify this model accidentally.

```text
assignedToId -> User.id
employeeId   -> Employee.id
```

Confirmed in current code:

- `Lead` has both `assignedToId`/`assignedTo` and `employeeId`/`employee`.
- `Case` has both `assignedToId`/`assignedTo` and `employeeId`/`employee`.
- `Client` and `Task` use `assignedToId` only.
- Restricted access in `src/lib/apiScope.ts` filters by `assignedToId`.
- Lead UI shows Employee as the responsible person.
- Lead create/update validates Employee ownership but does not generally
  replace `assignedToId` when an Employee is selected.
- Restricted lead writes force `assignedToId` to the current User.
- Lead conversion copies `Lead.employeeId` to `Case.employeeId` and transfers
  User assignment separately.
- `src/lib/employeeSync.ts` creates/activates same-name Employee records for
  organization users and backfills missing lead/case `employeeId` from
  `assignedToId`.
- Case create/update resolves an Employee to a same-name User and uses that
  User for `Case.assignedToId` when a match exists.

This mapping is name-based. There is no `Employee.userId` foreign key. Treat
duplicate names and user renames as technical debt.

## Substantially Changed Application Files

Assignment and access:

```text
prisma/schema.prisma
src/lib/apiScope.ts
src/lib/employeeSync.ts
src/lib/leads.ts
src/lib/organizationProvisioning.ts
src/app/api/leads/route.ts
src/app/api/leads/[id]/route.ts
src/app/api/leads/[id]/convert/route.ts
src/app/api/cases/route.ts
src/app/api/cases/[id]/route.ts
src/app/api/employees/route.ts
src/app/api/users/route.ts
src/app/api/users/[id]/route.ts
src/app/leads/page.tsx
src/app/leads/new/page.tsx
src/app/leads/[id]/page.tsx
src/app/cases/page.tsx
src/app/cases/[id]/page.tsx
src/app/clients/page.tsx
```

Settings, custom fields, exports, tutorials, and MOS:

```text
src/app/api/organization-settings/route.ts
src/app/api/custom-sections/route.ts
src/app/api/custom-sections/[id]/route.ts
src/app/api/custom-fields/route.ts
src/app/api/custom-fields/[id]/route.ts
src/app/api/export/route.ts
src/app/settings/sections/page.tsx
src/components/CustomSectionsRenderer.tsx
src/components/TutorialVideoButton.tsx
src/lib/tutorialVideos.ts
src/lib/ui-sections.ts
src/app/api/cases/[id]/mos-documents/submit/route.ts
```

Meta, storage, billing, registration, and performance:

```text
src/app/settings/integrations/page.tsx
src/app/api/meta/oauth/*
src/app/api/meta/subscriptions/route.ts
src/app/api/webhooks/meta/messages/route.ts
src/lib/metaOAuth.ts
src/lib/leadWebhookHandler.ts
src/lib/billing.ts
src/app/api/organizations/[id]/route.ts
src/app/register/RegisterClient.tsx
src/app/dashboard/page.tsx
src/app/globals.css
```

## Migrations Added

```text
prisma/migrations/20260627120000_lead_employee_assignment/migration.sql
prisma/migrations/20260728120000_case_mos_email/migration.sql
prisma/migrations/20260728150000_custom_section_target/migration.sql
```

Details:

- `20260627120000_lead_employee_assignment` adds `Lead.employeeId`, the
  `(organizationId, employeeId)` index, and an `ON DELETE SET NULL` Employee
  foreign key.
- `Case.employeeId` predates this work; it comes from
  `20260105000000_case_v2`.
- `20260728120000_case_mos_email` adds nullable `Case.mosEmail`.
- `20260728150000_custom_section_target` adds nullable
  `CustomSection.targetSectionKey`, preserving existing standalone sections.

Whether these migrations are applied to a particular database cannot be
determined from code or git. A previous project note recorded a successful
application of the lead migration to one Supabase database, but this audit did
not access the database and does not verify its present state. The two July 28
migrations also require environment-specific verification.

Do not run `prisma migrate deploy`, `prisma db push`, seed, or `npm run build`
until the exact target database is confirmed and a database-changing operation
is explicitly intended.

## Verification Performed

Final handoff audit:

```text
git status --short --branch
git diff --check
git log --oneline -10
npx tsc --noEmit
```

Results:

- Git commands completed successfully.
- `git diff --check` reported no whitespace errors before the documentation
  edits.
- TypeScript completed with no errors.
- No migration, seed, production database query, or `.env` read occurred.

Latest batch MOS work before this audit:

- `npx tsc --noEmit` passed.
- `npx next build` passed.
- Local production UI was checked with a test case.
- Individual, Shift-range, and select-all selection were verified.
- The final submit button was not clicked, so the visual test did not alter
  case data.
- Commit `1c3f879` was pushed to `main`; GitHub reported Vercel success.

No automated test script exists in `package.json`.

## Manual Checks Still Needed

1. Verify migration application on the intended production/database target
   without exposing connection strings.
2. Test the multi-document MOS submission once in production using a safe test
   case, including refresh and duplicate prevention.
3. Confirm Meta App Review status in Meta Developers; repository code cannot
   prove permission approval.
4. Decide whether `legalhub-os/MESSAGING_INTEGRATIONS_AUDIT.md` should remain
   local or be reviewed and committed separately.
5. Test responsibility behavior for duplicate Employee/User names and after a
   user rename.

## Known Bugs And Technical Debt

- Employee/User matching is based on normalized names, not a stable foreign
  key.
- Concurrent identical MOS batch requests can theoretically create duplicate
  completed tasks because there is no database unique constraint.
- `src/lib/auth.ts` has a development fallback JWT secret; production must set
  `JWT_SECRET`.
- `Case.cabinetPassword` is stored as a normal string; no encryption layer was
  observed in the audited path.
- Legacy mojibake remains in some source strings.
- The build script can deploy migrations and run seed, which makes a routine
  `npm run build` state-changing when `DIRECT_URL` is configured.
- Meta permissions and App Review are operational/external dependencies.
- There is no configured automated unit/integration test command.

## Next Recommended Development Step

First perform a read-only deployment/database audit for the three migrations,
then manually smoke-test the production MOS batch workflow. After those checks,
the next structural improvement should be an explicit stable link between
`Employee` and `User` (designed with a data migration and duplicate-name
handling) so responsibility metadata and access ownership no longer depend on
display-name matching.

Do not start that refactor until existing organization data and restricted
access behavior have been sampled and the migration plan is approved.

## Do Not Break Or Revert

- Do not use `employeeId` as the access-control field.
- Do not remove `assignedToId` from Lead or Case.
- Do not make restricted access depend on Employee names.
- Do not drop the lead employee migration or assume `Case.employeeId` belongs
  to it.
- Do not make `CustomSection.targetSectionKey` required; null preserves
  standalone sections.
- Do not remove active custom fields from any CSV export mode.
- Do not expose MOS email when `mosEmailFieldEnabled` is false.
- Do not bypass case scope or organization validation in MOS batch submission.
- Do not remove the Meta disconnect flow or shared messages webhook while App
  Review is pending.
- Do not delete or stage the existing untracked messaging audit file without
  user approval.
- Do not read or commit `.env`, passwords, API keys, access tokens, or secrets.
