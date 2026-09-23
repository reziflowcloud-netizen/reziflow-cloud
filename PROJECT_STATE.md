# Project State

Last updated against the production repository state by Codex: 2026-09-23.

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

The approved Mobile UX and Staff Routing V2 rollouts are in production.

```text
branch: main
production application commit: cb7d54ee055f2c7206ec2476b7ad8e6cb6c2c84c
production deployment: Hpv2rqh3uec16Qa27rvtDZDstyt2
deployment status at rollout verification: READY
```

At the start of this documentation-only update, local `main` and `origin/main`
matched the production application commit. This update changes only
`PROJECT_STATE.md` and `HANDOFF.md`; it does not redeploy the application or
change the production database.

## Architecture

- Next.js 14 App Router application with React 18 and TypeScript.
- Route handlers under `src/app/api` provide the application API.
- Prisma 5.22 is the ORM; PostgreSQL is the configured datasource.
- Authentication uses a signed JWT in the `auth-token` cookie.
- `organizationId` is the tenant boundary used by application queries.
- `src/lib/apiScope.ts` applies restricted-user filtering.
- Organization feature and integration settings are stored in the
  `Organization.settings` JSON field.
- Tailwind and shared styles in `src/app/globals.css` provide the visual layer.

Important build behavior:

```text
npm run build
  -> prisma generate
  -> next build
```

Migration deployment uses a separate guarded workflow. A routine build must
not invoke migration, seed, or backfill commands. Verify database environment
isolation before any database-aware local QA.

## Staff Routing V2 — Production Complete (Development 10)

The accepted feature is active in production:

- Explicit CRM User ↔ Employee identity links.
- Staff Scope `ALL` / `MINE` / `EMPLOYEE`, controlled by an organization
  visibility setting, across Leads, Cases, Tasks, and Calendar.
- Compact shared `StaffScopeControl`.
- Multiple Employees per channel; persistent server-side round-robin with a
  concurrency-safe cursor. Routing cursors are channel-independent and
  organization-independent.
- Unlinked Employee routing protection and unified routing/settings Save UX.
- Responsive Settings grids and Leads filters, with zero page-level horizontal
  overflow at the accepted mobile and desktop widths.

Production DB state: the V2 expand migration was applied;
`LeadChannelRouteMember` and `nextPosition` are active. Legacy
`LeadChannelRoute.employeeId` is intentionally retained. Contract cleanup has
**not** been done. Do not remove this column yet. Consider a separate contract
migration only after a stable production period and confirmation that no old
code path depends on it.

Final accepted QA: 55/55 regressions PASS; security, Lead visibility, tenant
isolation, and restricted access PASS; mobile 390/414/430 and desktop
769/1024/1440 PASS; page horizontal overflow 0; browser/runtime errors 0.

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
- Employee ↔ CRM User identity is now explicit. Do not infer links by name or
  merge the responsibility and access fields casually.

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

The large Mobile UX redesign and Development 10 (Staff Routing V2) are
complete. Do not continue either as an open-ended programme. Scope any future
finding as an independent maintenance/refinement task. Preserve the accepted
navigation, responsive structure, routing semantics, business logic, tenant
isolation, and permissions unless a new task explicitly authorizes a change.
