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
Lead -> Employee assignment has been implemented locally but is not committed yet. Review git status/diff first, then continue with UI testing, commit/deploy, or the next product task.
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
```

## Next Task Checklist

- Confirm current git status.
- Review the uncommitted Lead -> Employee implementation.
- Test lead create/edit/list/bulk assignment in the browser.
- Local `.env` now points to Supabase pooler URLs and passed connection checks on 2026-06-28.
- Confirm restricted CRM user access still scopes by `assignedToId`.
- The `20260627120000_lead_employee_assignment` migration has already been applied through `DIRECT_URL`.
- Commit the implementation when satisfied.
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
- Do not read, print, or commit `.env`.
- Do not do broad refactors or encoding cleanup while implementing this feature.
