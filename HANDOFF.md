# LegalHub CRM Handoff

NOTIFICATIONS — PRODUCTION COMPLETE

Development 12 completed on 2026-10-11. Application merge `4adbf2f3e73aa54c38ee7e84e2f4ca266e0454e2`, Production deployment `dpl_He27oNwevfbt1KDc4sB2XyjUV7uU` READY. This documentation follow-up records the verified rollout; application code is unchanged. Canonical evidence: [notifications-production-complete.md](docs/notifications-production-complete.md).

- Notification Center, personal event preferences, Mine/Team scope, privacy, dedupe, read/unread and badges.
- Owner/Admin organization master switch; existing and new organizations default OFF. Activation watermark prevents historical/off-gap backfill.
- Only TestRezidents enabled: ON=1, OFF=22. Final watermark `2026-10-11T10:27:00.154Z`. Do not enable customer organizations without their explicit opt-in.
- Web Push remains per-user opt-in. Existing User16 iPhone subscription and all existing preferences/read state preserved. Phase 3A assignment events and Phase 3B scheduled events retain access checks and the verified iPhone fallback.
- Candidate-first queries select only eligible occurrences in enabled organizations. No full entity hydration or continuation for empty runs.
- QStash EU: frequent Task/Lead `*/15 * * * *`; daily Case +7/+1 `0 6 * * *` (08:00 Warsaw summer / 07:00 winter), date calculations Europe/Warsaw. Exactly two active schedules; old pilot PAUSED. GitHub manual fallback only.
- Three consecutive real automatic frequent runs: 10:30, 10:45, 11:00 UTC, HTTP 200, one delivery/page each, zero continuations. Daily automatic execution N/A at completion: next run 2026-10-12 06:00 UTC; daily configuration and isolated regressions PASS.
- Static current-data cost projection 97/day normal, 291/day with two retries, Free capacity 1000/day. Reassess when opted-in organizations/candidates grow.
- Fresh private public-schema backup validated; guarded additive migration applied, 50 migrations / pending0 / failed0. Old application + new DB smoke passed before deployment.
- Post-deploy isolated suite 261/261, UI 12/12, TypeScript, Prisma validation, full migration chain and DB-write-free build PASS. Observed Production errors/5xx, duplicates and non-enabled organization events: zero.
- Temporary QStash setup GitHub secret deleted after the two configuration-only runs. Existing cron secret and Production sensitive token unchanged; no credential values in reports.

Updated after the verified notification production rollout on 2026-10-11.

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
production application commit: 4adbf2f3e73aa54c38ee7e84e2f4ca266e0454e2
application rollout deployment: dpl_He27oNwevfbt1KDc4sB2XyjUV7uU
status after rollout: READY
```

The current notification application and additive migration are deployed. The latest documentation follow-up records the rollout without changing application code.

## Forgot Password — Production Complete

Accepted production state:

```text
production main/application commit: af4ed41df056676712917091e75fbd0602d8eef4
production deployment: dpl_FUvk2hDgX8nqaUJ6nxaCcPQsWyVj
migration: 20260923221500_secure_password_reset
migration result: applied successfully
production migrations: 47 applied, 0 pending, 0 failed
```

Implemented and deployed:

- Forgot Password and Reset Password pages.
- Resend email delivery.
- Cryptographically secure reset tokens with only token hashes stored in the
  database.
- 30-minute expiry, single-use enforcement, and previous-token invalidation.
- Account-enumeration protection and persistent rate limiting.
- `User.sessionVersion`, including session invalidation after self-service and
  admin password changes.
- Password-reset audit events and shared email normalization.
- RU / UA / PL recovery flows.

Production E2E verification passed for real email delivery, the production
reset link, first reset completion, rejection of the old password, login with
the new password, rejection of token reuse, session invalidation,
unknown-email protection, and rate limiting.

Final QA: security regression 79/79 PASS; tenant isolation PASS; mobile
390/414/430 PASS; desktop 1440 PASS; runtime errors 0; browser errors 0;
HTTP 5xx 0. The fresh verified pre-migration `public`-schema backup is retained
outside Git.

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

The Mobile UX programme, Development 10, and Forgot Password rollout are
closed. Development 09 remains the Maintenance / Small Fixes development
thread. New findings should be opened as small, independent
maintenance/refinement tasks with a clear screen, breakpoint, expected
behavior, permissions impact, regression scope, and deployment gate. Keep
production unchanged until the user explicitly approves a deployment.

For every follow-up:

1. Start from current `origin/main` unless the task names another base.
2. Preserve the approved mobile shell and the desktop layout.
3. Reuse existing business logic, APIs, permissions, and theme/language
   mechanisms.
4. Verify only the affected area plus proportionate mobile, desktop, access,
   and security regressions.
5. Stop before production unless deployment is explicitly authorized.
