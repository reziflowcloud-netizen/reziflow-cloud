# Project State

Last updated by Codex: 2026-06-28.

## Project

LegalHub CRM is a SaaS CRM for legalization agencies in Poland. It combines the public LegalHub landing/registration flow with the internal CRM for organizations, users, clients, cases, tasks, leads, documents, billing/referrals, and integrations.

Current local app root:

```text
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration
```

GitHub remote:

```text
https://github.com/reziflowcloud-netizen/reziflow-cloud.git
```

Production site:

```text
https://legalhubcrm.com
```

## Stack

- Next.js 14.2.35
- React 18
- TypeScript
- Prisma 5.13
- PostgreSQL
- Tailwind CSS

Important commands:

```bash
npm install
npm run dev
npm run build
npm run seed
npx prisma generate
```

`npm run build` runs:

```bash
node scripts/vercel-migrate.js && prisma generate && next build
```

## Current Git State

At the time this file was written:

```text
branch: main
remote: origin/main
status: local uncommitted changes
latest commit: 1a9f18c Add employee assignment for leads
```

Always run this again in a new chat before editing:

```bash
git status --short --branch
```

## Important Files

- `package.json` - scripts and dependencies.
- `DEPLOY_NOTES.md` - deployment, recovery, environment variable, and production notes.
- `prisma/schema.prisma` - database schema.
- `prisma/migrations/` - committed database migrations.
- `src/lib/auth.ts` - auth helpers.
- `src/lib/apiScope.ts` - organization/user data access scoping.
- `src/lib/leads.ts` - lead constants and request normalization.
- `src/app/api/leads/route.ts` - lead list and create API.
- `src/app/api/leads/[id]/route.ts` - lead detail, update, delete API.
- `src/app/api/leads/[id]/convert/route.ts` - lead-to-client/case conversion.
- `src/app/leads/page.tsx` - leads table.
- `src/app/leads/new/page.tsx` - new lead form.
- `src/app/leads/[id]/page.tsx` - lead card/detail screen.
- `src/app/settings/employees/page.tsx` - responsible employees settings UI.
- `src/app/api/employees/route.ts` and `src/app/api/employees/[id]/route.ts` - Employee API.
- `prisma/migrations/20260627120000_lead_employee_assignment/migration.sql` - adds `Lead.employeeId`.
- `src/app/api/organization-settings/route.ts` - organization-level CRM feature toggles.
- `src/app/settings/sections/page.tsx` - Fields and sectors settings page, including automatic reminders and tutorial videos toggles.
- `src/components/TutorialVideoButton.tsx` - shared header button for opening CRM tutorial videos.
- `src/lib/tutorialVideos.ts` - central map of CRM sections to YouTube URLs.

## Current Data Model Notes

`assignedToId` means a real CRM `User`. It is used for access scoping and restricted users. Do not replace it with `Employee`.

`Employee` is a separate business list for responsible employees / trustees:

```text
Employee(id, organizationId, name, active, createdAt)
```

`Case` already has:

```text
employeeId Int?
employee   Employee?
```

`Lead` now has both:

```text
assignedToId Int?
assignedTo   User?
employeeId   Int?
employee     Employee?
```

`Employee` now has `leads Lead[]` in addition to `cases Case[]`.

## Recently Implemented

Leads can now be assigned to a responsible `Employee` from Settings -> Employees, not only to a system `User`.

Implemented behavior:

- Keep `Lead.assignedToId` for CRM users and restricted access logic.
- Add a separate `Lead.employeeId` relation to `Employee`.
- The lead create form, lead detail page, lead list, sorting, search, quick "unassigned" filter, board cards, and bulk assignment now use `Employee` as the visible responsible person.
- `assignedToId` remains an internal CRM `User` field for access/reminder assignment, but the visible `CRM user` select was removed from lead UI to keep the funnel card layout clean.
- Lead APIs include `employee: { select: { id: true, name: true } }`.
- Creating/updating a lead validates newly selected employees against the current organization.
- Lead-to-client/case conversion copies `Lead.employeeId` to `Case.employeeId` when a case is created.

Verification already run:

```bash
cmd /c npx prisma format
cmd /c npx prisma generate
cmd /c npx next build
```

Note: `npm run build` was intentionally not run because this project's build script executes `prisma migrate deploy` through `DIRECT_URL`. Use the normal deployment flow when you are ready to apply migrations to the target database.

Database/migration status as of 2026-06-28:

- Local `.env` was updated to Supabase pooler URLs.
- `DATABASE_URL` and `DIRECT_URL` both passed a connection check.
- Prisma reported only one pending migration: `20260627120000_lead_employee_assignment`.
- `npx prisma migrate deploy` was run via `DIRECT_URL` and applied that migration successfully.
- Verification confirmed `Lead.employeeId`, `Lead_organizationId_employeeId_idx`, `Lead_employeeId_fkey`, and the `_prisma_migrations` record exist.
- The connected database is not empty: at verification time it contained 294 leads and 7 employees.

## Current Tutorial Video Work

Tutorial video infrastructure has been started locally:

- `Organization.settings.tutorialVideosEnabled` controls whether tutorial video buttons are shown.
- The default is `false`, so old and new organizations do not see tutorial buttons until an admin enables them.
- Settings -> Fields and sectors now has a separate "Training videos" card under automatic reminders.
- A shared `TutorialVideoButton` component is placed in the header action area for Dashboard, Cases, Leads, Clients, Stages, Tasks, and Calendar.
- Settings and import/export are intentionally excluded for now.
- Video URLs are centralized in `src/lib/tutorialVideos.ts`.
- Final YouTube URLs have been added for Dashboard, Cases, Leads, Clients, Stages, Tasks, and Calendar.
- Stages, Tasks, and Calendar intentionally share one tutorial video.

Verification already run for this local work:

```bash
cmd /c npx next build
```

Context from the earlier integration chat:

- The `legalhub-integration` folder was created as a safe sandbox from the landing/CRM merge work.
- The earlier chat explicitly treated local database access as optional/missing and said production database credentials live in Vercel environment variables.
- A temporary Neon/PostgreSQL database was likely used for testing, but the currently restored local credentials point to Supabase.

## Access Control Warning

Restricted access uses `User.restrictedAccess` and `assignedToId`. Keep this behavior intact:

- a restricted system user should still see only records assigned to their `User.id`;
- `Employee` assignment is business metadata and should not grant app access.

Relevant file:

```text
src/lib/apiScope.ts
```

## Encoding Note

Some older Russian/Ukrainian strings in source files appear as mojibake in the repository. Avoid broad encoding repair unless the task is explicitly about text encoding and the UI has been checked. For normal feature work, edit only the directly related strings.

## Secrets

Do not print or commit `.env`.

Local `.env` exists in this app root, but production secrets live in Vercel. See `DEPLOY_NOTES.md` for safe environment and recovery notes.
