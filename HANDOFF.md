# LegalHub CRM Handoff

Prepared from the verified production state on 2026-09-23.

## Start Here

```text
Continue maintenance and scoped development of LegalHub CRM.

Application root:
C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration

Before editing:
1. Read PROJECT_STATE.md and this HANDOFF.md.
2. Read the task-specific canonical documentation.
3. Run git fetch origin, git status --short --branch, and inspect recent log.
4. Treat the repository and current production state as the source of truth.
5. Do not read or expose secrets.
6. Do not run migrations, seeds, or backfills unless explicitly authorized.
7. Preserve assignedToId (User/access) and employeeId
   (Employee/business responsibility) as separate concepts.
```

## Current Production

```text
URL: https://legalhubcrm.com
branch: main
production application commit: cb7d54ee055f2c7206ec2476b7ad8e6cb6c2c84c
deployment: Hpv2rqh3uec16Qa27rvtDZDstyt2
status after rollout: READY
```

Before this documentation update, local `main` matched `origin/main` at the
production application commit. This handoff task changes only
`PROJECT_STATE.md` and `HANDOFF.md`; it does not redeploy application code or
change the production database.

## Staff Routing V2 — Complete (Development 10)

Staff Routing V2 is active in Production. The accepted implementation includes:

- Explicit CRM User ↔ Employee identity.
- Staff Scope `ALL` / `MINE` / `EMPLOYEE` across Leads, Cases, Tasks, and
  Calendar, with an organization visibility setting and compact
  `StaffScopeControl`.
- Multi-Employee channel routing with persistent server-side round-robin and
  a concurrency-safe cursor; channels and organizations have independent
  routing state.
- Protection against routing to unlinked Employees and unified
  routing/settings Save UX.
- Responsive Settings and Leads filter fixes.

Production DB: the V2 expand migration is applied;
`LeadChannelRouteMember` and `nextPosition` are active. The legacy
`LeadChannelRoute.employeeId` column is intentionally retained; contract
cleanup has **not** been done. **Do not remove it yet.** Consider a separate
contract migration only after a stable production period and explicit
confirmation that no old code path depends on it.

Final Staff Routing V2 QA: 55/55 regression tests PASS; security, Lead
visibility, tenant isolation, and restricted access PASS; mobile 390/414/430
and desktop 769/1024/1440 PASS; page horizontal overflow 0;
browser/runtime errors 0.

## Mobile UX Rollout — Complete

The accepted Mobile UX chain is fully implemented and deployed:

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

Responsive contract:

```text
mobile:  <= 768px
desktop: >= 769px
fixed mobile navigation: Пульт | Ліди | Справи | Клієнти | Ще
```

Canonical handoff material:

```text
legalhub-os/mobile-ux/MOBILE_UX_SPEC.md
legalhub-os/mobile-ux/MOBILE_UX_QA_REPORT.md
legalhub-os/mobile-ux/mockups/
```

Use those files for maintenance decisions. Do not create a new competing
mobile specification or continue a broad redesign without a new owner-approved
scope.

## Accepted QA Baseline

```text
360px sanity                   PASS
390px                          PASS
414px                          PASS
430px                          PASS
desktop 769 / 1024 / 1440      PASS
Light / Dark / Slate           PASS
RU / UA / PL                   PASS
Full / Restricted permissions PASS
Security regression            PASS
Lead visibility regression     PASS
Production smoke               PASS
```

Final production verification covered all 11 mobile surfaces, desktop
regression, fixed navigation and active states, More bottom sheet, safe
list/detail and save/edit flows, Task sticky Save, Case/Client relations,
Calendar timed values, date-only all-day labels, and overflow checks.

## Security And Data Handling Baseline

Already present in production and not optional:

- Security/GDPR hardening.
- Private/authenticated document delivery through the authorized LegalHub
  endpoint.
- Tenant isolation and restricted permission enforcement.
- Safe user projections, backend guards, same-origin checks, security headers,
  upload/path/URL protections, masked credentials, and Meta signature checks.
- Lead responsible visibility fix.

The controlled Lead responsibility backfill was completed earlier in
production. **Never repeat it as a setup step or rollout task.** The final
Mobile UX rollout required no schema migration, seed, or data backfill.

Do not include secrets, provider credentials, storage identifiers, permanent
provider URLs, password material, tokens, or connection strings in logs,
documentation, URLs, HTML, API output, commits, or chat responses.

## Critical Assignment Invariant

```text
assignedToId -> User.id      access ownership / restricted visibility
employeeId   -> Employee.id  visible business responsibility
```

Do not substitute one for the other. Restricted access and tenant isolation
must continue to use the established access rules even when the visible
Employee changes. Employee ↔ CRM User identity is explicit; never guess links
from names or combine these fields.

## Safe Build And Database Rules

`npm run build` runs `prisma generate && next build`; migration deployment is
a separate guarded workflow. Confirm the target and environment isolation
before any database operation.

Never run the following merely to inspect the project:

- production migrations;
- Prisma schema pushes;
- seed scripts;
- historical or responsibility backfills;
- destructive document cleanup.

## Next Work

The Mobile UX programme and Development 10 are closed. New findings should be
opened as small, independent maintenance/refinement tasks with a clear screen,
breakpoint, expected behavior, permissions impact, regression scope, and
deployment gate. Keep production unchanged until the user explicitly approves
a deployment.

For every follow-up:

1. Start from current `origin/main` unless the task names another base.
2. Preserve the approved mobile shell and the desktop layout.
3. Reuse existing business logic, APIs, permissions, and theme/language
   mechanisms.
4. Verify only the affected area plus proportionate mobile, desktop, access,
   and security regressions.
5. Stop before production unless deployment is explicitly authorized.
