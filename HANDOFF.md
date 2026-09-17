# LegalHub CRM Handoff

Prepared from the verified production state on 2026-09-17.

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
commit: a63557a8bfd770f333d7eb36ed4b26869ceecb71
deployment: dpl_DxRQuhsmYgvH6i1FcAdMNKDXVvRh
status after rollout: READY
```

Previous stable rollback point:

```text
commit: d40b6f3ce88408a99f3c09bb162b786421ef66b3
deployment: dpl_ARsSogYVQdgYHbUmTXQwKJ22gBu7
```

Before this documentation update, local `main` matched `origin/main` at the
production commit. This handoff task changes only `PROJECT_STATE.md` and
`HANDOFF.md`; it does not change application code or production.

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
Employee changes. Existing Employee/User synchronization remains name-based
and is separate technical debt, not a reason to combine these fields.

## Safe Build And Database Rules

`npm run build` invokes `scripts/vercel-migrate.js` and can run migration/seed
logic when `DIRECT_URL` is configured. For a code-only verification, prefer a
deliberate safe build such as `npx next build` and confirm the target before any
database operation.

Never run the following merely to inspect the project:

- production migrations;
- Prisma schema pushes;
- seed scripts;
- historical or responsibility backfills;
- destructive document cleanup.

## Next Work

The Mobile UX programme is closed as a major redesign. New findings should be
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
