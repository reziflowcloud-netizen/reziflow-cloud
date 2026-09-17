# Project State

Last updated against the production repository state by Codex: 2026-09-17.

## Project

LegalHub CRM is a multi-tenant SaaS CRM for legalization and immigration
agencies in Poland. The Next.js application contains the public site,
registration and legal pages, organization administration, and the internal
CRM.

```text
Application root:
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration

Repository:
https://github.com/reziflowcloud-netizen/reziflow-cloud.git

Production:
https://legalhubcrm.com
```

## Current Production State

The full approved Mobile UX rollout is in production.

```text
branch: main
production commit: a63557a8bfd770f333d7eb36ed4b26869ceecb71
production deployment: dpl_DxRQuhsmYgvH6i1FcAdMNKDXVvRh
deployment status at rollout verification: READY
```

Recorded previous stable rollback point:

```text
commit: d40b6f3ce88408a99f3c09bb162b786421ef66b3
deployment: dpl_ARsSogYVQdgYHbUmTXQwKJ22gBu7
```

At the start of this documentation-only update, local `main`, `origin/main`,
and the production commit were synchronized at `a63557a`. No application code
or production configuration was changed by this handoff update.

## Architecture

- Next.js 14 App Router application with React 18 and TypeScript.
- Route handlers under `src/app/api` provide the application API.
- Prisma 5.13 is the ORM; PostgreSQL is the configured datasource.
- Authentication uses a signed JWT in the `auth-token` cookie.
- `organizationId` is the tenant boundary used by application queries.
- `src/lib/apiScope.ts` applies restricted-user filtering.
- Organization feature and integration settings are stored in the
  `Organization.settings` JSON field.
- Tailwind and shared styles in `src/app/globals.css` provide the visual layer.

Important build behavior:

```text
npm run build
  -> node scripts/vercel-migrate.js
  -> prisma generate
  -> next build
```

When `DIRECT_URL` exists, the wrapper may run database migration/seed logic.
Use `npx next build` for a safe application build when database mutation is not
explicitly intended. Never run migrations, seed, or backfills as part of a
routine inspection.

## Mobile UX — Production

The approved responsive Mobile UX is fully implemented and deployed.

Breakpoints:

```text
mobile:  <= 768px
desktop: >= 769px
```

Implemented mobile screens and shared surfaces:

- Dashboard
- Leads
- Cases
- Clients
- Lead Detail
- Case Detail
- Client Detail
- Tasks
- Stages
- Calendar
- More bottom sheet

The fixed mobile bottom navigation is exactly:

```text
Пульт | Ліди | Справи | Клієнти | Ще
```

The More bottom sheet contains the secondary navigation, language controls,
theme controls, current-user context, and logout. Existing permission rules
control which destinations and actions are available. Desktop layout remains
the existing desktop CRM presentation at 769px and above.

Canonical Mobile UX documentation:

```text
legalhub-os/mobile-ux/MOBILE_UX_SPEC.md
legalhub-os/mobile-ux/MOBILE_UX_QA_REPORT.md
legalhub-os/mobile-ux/mockups/
```

The canonical mockup directory contains the approved 11-screen handoff set.
Do not recreate competing copies or treat older chat screenshots as a newer
source of truth.

## Mobile UX Verification Snapshot

Final accepted verification results:

- 360px sanity: PASS
- 390px: PASS
- 414px: PASS
- 430px: PASS
- Desktop 769px / 1024px / 1440px: PASS
- Light / Dark / Slate: PASS
- RU / UA / PL: PASS
- Full and restricted permissions: PASS
- Security regression: PASS
- Lead responsible visibility regression: PASS
- Production mobile and desktop smoke: PASS
- Browser/runtime errors during final production smoke: 0

The production smoke covered navigation, active states, the More sheet,
list-to-detail navigation, safe no-op detail saves, Task editing with the
sticky Save action, client/case relations, Calendar timed events, date-only
all-day display, and mobile overflow checks.

## Security And Access State — Production

The following are already deployed and must be preserved:

- Security/GDPR hardening.
- Safe user projections and backend permission/configuration guards.
- Organization isolation and nested IDOR protection.
- Same-origin mutation protection and security headers.
- Path traversal, remote-document URL, SSRF, and upload validation controls.
- Masked integration credentials and Meta webhook signature validation.
- Private/authenticated Cloudinary document delivery through LegalHub file
  endpoints; provider identifiers and permanent provider URLs must not be
  exposed to unauthorized frontend/API consumers.
- Lead responsible visibility fix for restricted users.

A controlled production backfill for Lead responsibility was completed before
the Mobile UX rollout. **Do not run that backfill again.** No migration,
backfill, or seed was part of the final Mobile UX production rollout.

## Assignment Model: User vs Employee

This distinction is security-sensitive and remains intentional:

```text
assignedToId -> User.id      (access ownership / restricted visibility)
employeeId   -> Employee.id  (visible business responsibility)
```

- Lead and Case can contain both fields.
- Client and Task use `assignedToId` for their existing ownership behavior.
- Restricted access must continue to use the established access scope and
  must not be inferred only from the visible Employee value.
- Lead conversion carries Employee responsibility and User access ownership
  separately.
- Existing Employee/User synchronization is name-based rather than an
  explicit foreign-key relationship; do not merge the fields casually.

## Implemented Product Areas

- Public landing, conference landing/demo flow, pricing, registration, login,
  contact, legal, and data-deletion pages.
- Multi-organization users, roles, restricted access, super-admin organization
  management, plan limits, trials, overrides, and referrals.
- Dashboard metrics, dynamics, recent records, upcoming events, and quick
  start/tutorial actions.
- Leads with configurable organization statuses/colors, sources, filters,
  responsibility, communication data, reminders, conversion, and bulk actions.
- Clients with contact/profile data, phones, responsible ownership, cases,
  custom fields, imports, and exports.
- Cases with services, statuses, responsibility, payments, comments,
  documents, MOS/correspondence data, important dates, and custom sections.
- Tasks, priorities, Calendar, Stages, notifications, and reminders.
- Organization settings, integrations, employees, services, statuses, fields,
  storage, import/export, and tutorial visibility.
- Conference tracking/reporting and the secure shared demo flow.

## Operational Rules

- Never expose or commit `.env` files, passwords, API keys, tokens, connection
  strings, JWT secrets, or integration credentials.
- Preserve tenant scoping and restricted-user filters on every read and write.
- Do not expose storage provider URLs or identifiers in public/API responses.
- Do not run Prisma migration, seed, or historical backfill operations without
  an explicit task naming the target environment.
- Production changes require a separate explicit deployment instruction.
- Keep desktop behavior visually stable unless a task explicitly targets it.

## Next Development Approach

The large Mobile UX redesign is complete. Do not continue it as an open-ended
redesign programme. Any issue discovered after production should be described,
scoped, implemented, and verified as an independent maintenance/refinement
task. Preserve the accepted navigation, breakpoints, responsive structure,
business logic, permissions, and desktop presentation unless the new task
explicitly authorizes changing them.
