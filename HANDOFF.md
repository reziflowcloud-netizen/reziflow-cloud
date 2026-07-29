# Handoff

Use this file when continuing the LegalHub CRM work in a fresh Codex chat.

## Start Prompt For A New Chat

```text
Continue work on the LegalHub CRM SaaS project for legalization agencies in Poland.

Project root:
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration

The previous Codex chat became too long and kept compacting context. Please ignore old chat memory and rely on the files in this project.

First:
1. Change to the project root.
2. Read PROJECT_STATE.md, HANDOFF.md, DEPLOY_NOTES.md, package.json, and prisma/schema.prisma.
3. Run git status --short --branch.
4. Do not revert existing changes unless I explicitly ask.
5. Briefly summarize what is already done and what the next step is.

Current state:
The CRM is in production on legalhubcrm.com. Organization admins can configure custom client/case sections and fields in Settings -> Fields and sectors. Custom field groups can be standalone or embedded into an existing standard sector. Active custom fields are included automatically in full, client-only, and case-only CSV exports. The organization-level "MOS email address" switch also lives in Settings -> Fields and sectors. Case MOS documents support checkbox selection, Shift-range selection, select-all, and one atomic batch submission date.
```

## Quick Context

The real application root is:

```text
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration
```

The parent folder:

```text
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe
```

is a Codex workspace. It is not the app root.

## What To Read First

```text
PROJECT_STATE.md
DEPLOY_NOTES.md
package.json
prisma/schema.prisma
src/lib/apiScope.ts
src/lib/leads.ts
src/app/api/leads/route.ts
src/app/api/leads/[id]/route.ts
src/app/leads/page.tsx
src/app/leads/new/page.tsx
src/app/leads/[id]/page.tsx
src/app/settings/employees/page.tsx
src/app/api/employees/route.ts
src/app/api/organization-settings/route.ts
src/app/settings/sections/page.tsx
src/components/TutorialVideoButton.tsx
src/lib/tutorialVideos.ts
```

## Next Task Checklist

- Confirm current git status.
- Read the latest section in PROJECT_STATE.md before changing custom fields or exports.
- Preserve standalone custom sections where `CustomSection.targetSectionKey` is null.
- Validate embedded custom section targets against `src/lib/ui-sections.ts`.
- Keep active organization custom fields in full, client-only, and case-only CSV exports.
- Preserve batch MOS submission validation and case access scoping in `src/app/api/cases/[id]/mos-documents/submit/route.ts`.
- Confirm restricted CRM user access still scopes by `assignedToId`.
- Pick the next CRM task.

## Useful Commands

```bash
git status --short --branch
npm install
npx prisma generate
npm run dev
cmd /c npx next build
```

`npm run build` runs `scripts/vercel-migrate.js`, which can execute `prisma migrate deploy` using `DIRECT_URL`. Use it only when you intend to apply migrations to that target database.

## Do Not Lose

- `assignedToId` is for `User` and access control.
- `employeeId` should be for business responsible employees only.
- Restricted users must remain scoped by their `User.id`.
- The visible lead "Responsible" field is `Employee`; `assignedToId` remains internal and is not shown as a lead UI field.
- Tutorial video buttons are controlled by `Organization.settings.tutorialVideosEnabled`; default is false.
- Video URLs live in `src/lib/tutorialVideos.ts`; Stages, Tasks, and Calendar intentionally share one video URL.
- Dashboard quick start is controlled by `Organization.settings.quickStartEnabled`; default is true.
- Quick start step video URLs live in `src/lib/tutorialVideos.ts`.
- Custom field values remain in `CustomFieldValue`; do not add a database column for every organization-defined field.
- `CustomSection.targetSectionKey` controls whether a custom field group is standalone or embedded in a standard client/case sector.
- `Organization.settings.mosEmailFieldEnabled` is managed by the organization admin in Settings -> Fields and sectors.
- Submitted MOS documents are completed `Task` records; batch submission creates them atomically through the case-scoped endpoint.
- Do not read, print, or commit `.env`.
- Do not do broad refactors or encoding cleanup while implementing this feature.
