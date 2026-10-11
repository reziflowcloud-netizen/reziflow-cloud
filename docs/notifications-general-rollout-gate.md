# Notifications general Production rollout — STOP

Safety review: 2026-10-11. Production was not changed. This report records a
blocked general rollout; it does not mark Development 12 complete.

## Current Production state

- Fresh `origin/main`: `7621e8bd99e551de0561ed79c7bd8f2a10e5d25c`.
- Production: `dpl_7SagjMScXqZaCNzP3jKKpDaGjkz4`, READY, same commit.
- `NOTIFICATIONS_ENABLED`, `WEB_PUSH_ENABLED`, `NOTIFICATION_EVENTS_ENABLED`,
  `NOTIFICATION_SCHEDULED_EVENTS_ENABLED`, `NOTIFICATION_QSTASH_ENABLED`: `true`.
- Event organization pilot: TestRezidents; event and push user pilot: User16.
- General switch and activation watermark: absent in Production.
- QStash EU schedule/queue: `legalhub-production-notifications`, ACTIVE,
  POST `https://legalhubcrm.com/api/internal/notifications`, `*/15 * * * *`.
- QStash plan shown in current console: **Free**.
- Current default-branch GitHub workflow: `workflow_dispatch` only; manual
  fallback is preserved, automatic GitHub cron is absent.
- 23 organizations; 33 users; 25 active linked Employees; 1 active subscription.
- Potential scan: 1,023 Tasks, 274 Cases, 957 Leads (2,254 records).
- Latest inspected pilot logs: automatic runs at 08:15 and 08:30 UTC have
  DELIVERED chunks. The inspected final 08:30 chunk returned HTTP 200.
  Existing schedule authentication remains configured; Authorization/body are
  redacted. Neither scheduler credentials nor provider configuration changed.

## Read-only backlog and activation simulation

The audit ran without writes, at `2026-10-11T08:39:06.067Z`. It uses the existing
occurrence policy, explicit same-organization User/Employee links, current
preferences, mine/team scope and existing notification dedupe keys. Output
contains counts and opaque organization IDs only, with no names/emails/client
data. Existing pilot notifications are deduped before counting new copies.

| Event | Potential new copies without watermark | With watermark |
| --- | ---: | ---: |
| Task due soon | 0 | 0 |
| Task overdue | 1 | 0 |
| Case +7 days | 0 | 0 |
| Case +1 day | 0 | 0 |
| Lead next contact | 18 | 0 |
| Total | 19 | 0 |

Baseline copies affect 3 recipients in 2 organizations:
`cmovf5ugk0001w5j41wbhwekf`: 16;
`cmqgv312400017xew5ex6awcx`: 3.
The watermark suppresses 218 historical occurrence candidates before recipient
selection. Projected first run within 30 minutes: 0 copies, maximum per
organization 0. The volume gate (100 total / 20 per organization) **PASS**.
This is a read-only projection of the observed data, not a guarantee about new
edits/assignments before a later activation; rerun it at activation time.

Existing confirmed Phase 3B synthetic fixtures: Task 1, Case 1, Lead 1;
notifications 3; deliveries 3. They were not recreated or removed: activation
was stopped before cleanup. Cleanup must validate exact recorded IDs/names,
tenant/User ownership and absence of new unrelated relations, including the
synthetic Case client, before deleting only this disposable set.

## Blocking provider capacity gate

The existing architecture evaluates 25 records per page and processes one page
per QStash message. A complete general sweep requires:

- Tasks: `floor(1023 / 25) + 1 = 41` messages.
- Cases: `floor(274 / 25) + 1 = 11` messages.
- Leads: `floor(957 / 25) + 1 = 39` messages.
- Total: **91 messages/sweep × 96 sweeps/day = 8,736 messages/day minimum**.

This excludes provider retries, outbox drain pages, time-budget continuations,
and other workloads. Watermark filtering occurs after the DB page is fetched,
so zero created notifications does not reduce these 91 messages. Cleaning the
three fixtures does not change the page calculation.

The official [QStash pricing](https://upstash.com/pricing/qstash) lists Free at
1,000 messages/day; delivery attempts, including retries, consume messages.
The proposed sweep exceeds this by 8.736× and would use a full day's quota in
about 11 sweeps (roughly 2¾ hours from an unused quota).
**Overall capacity gate FAIL. General rollout STOP.**

Possible follow-up: select only relevant upcoming occurrence candidates in the
DB before keyset pagination, while retaining 25-record pages, transaction
boundaries, QStash continuation, cadence and provider. Measure the remaining
daily delivery demand with retry headroom before approving general rollout.
An explicitly approved QStash paid plan is another option; no billing/plan
change was attempted. No optimization or provider/cadence change was deployed.

## Prepared isolated implementation

- Explicit `NOTIFICATION_EVENTS_GLOBAL_ENABLED=true` plus canonical UTC
  `NOTIFICATION_EVENTS_GLOBAL_SINCE`. Missing/invalid boundary fails closed.
- Original trigger instant is evaluated in Europe/Warsaw: default Task due soon
  at due date −1 day midnight; Task overdue at due date +1 day midnight; Case
  at date −7/−1 days midnight; exact Task reminder/Lead contact at its stored
  instant. Occurrences earlier than activation cannot generate new copies.
- Existing occurrence IDs, dedupe keys, pilot catch-up and notification
  access/read/badge policy are retained. No DB migration.
- General assignment, scheduled-recipient and push-outbox gates preserve
  same-tenant identity, preferences, explicit Employee links, mine/team,
  subscription ownership and push opt-in. Invalid Employee links are skipped.
- Additional aggregate scheduler metrics: deliveries created, recipients
  evaluated, skipped unlinked entities, duplicates prevented. Recipient
  evaluations are not claimed as distinct recipients across pages.
- Browser permission remains requested only by the existing explicit enable
  action; no automatic prompt, subscription or preference rewrite was added.

Validation: **256/256 isolated tests PASS, 0 skipped**, including real local
PostgreSQL/pool=1, general tenants, historical boundaries, future events,
assignment/scheduled retry/dedupe, security, tenant isolation, notification
click/resume, Staff Routing, visibility, webhook/client pool checks, auth and
autosave. TypeScript, Prisma validate, isolated safe build, diff check PASS.
New 600-record pool=1 performance QA: 9,542 ms, 5,251 SQL statements, 27
pages, 600 notifications. This is DB QA, not proof of sufficient provider quota.

## Requested final status (general rollout)

| # | Check | Result |
| --- | --- | --- |
| 1 | Previous main | `7621e8bd99e551de0561ed79c7bd8f2a10e5d25c` |
| 2 | Previous deployment | `dpl_7SagjMScXqZaCNzP3jKKpDaGjkz4` |
| 3 | Final main | Unchanged, same as #1 |
| 4 | Final Production deployment | Unchanged, same as #2 |
| 5 | Activation timestamp | Not set; simulation above only |
| 6 | Historical backlog protected | YES in prepared code/QA; general mode not activated |
| 7 | Projected first-run volume | 0 in the observed 30-minute projection |
| 8 | Maximum organization projected volume | 0 |
| 9 | Phase 3A general enabled | NO; pilot remains enabled |
| 10 | Phase 3B general enabled | NO; pilot remains enabled |
| 11 | QStash cadence 15 minutes | YES, unchanged |
| 12 | GitHub auto scheduler OFF | YES |
| 13 | GitHub manual fallback | YES, preserved |
| 14 | First automatic GENERAL run | NOT RUN — rollout stopped |
| 15 | Second automatic GENERAL run | NOT RUN |
| 16 | Third automatic GENERAL run | NOT RUN |
| 17 | Organizations evaluated | 23 inventoried in read-only audit; no general live sweep |
| 18 | Notifications created first general run | N/A; no general run |
| 19 | Duplicate notifications | No general run; isolated retry/dedupe PASS |
| 20 | Skipped unlinked Employees | No general run; baseline eligible skip count 0; QA PASS |
| 21 | P2024 | General observation N/A; isolated regression PASS |
| 22 | P2028 | General observation N/A; isolated regression PASS |
| 23 | Pool timeout | General observation N/A; isolated pool=1 regression PASS |
| 24 | Unexpected HTTP 5xx | General observation N/A; inspected pilot chunk HTTP 200 |
| 25 | Push remains opt-in | YES |
| 26 | Non-subscribed Users safe | YES, isolated PostgreSQL QA |
| 27 | Employee own-only | PASS isolated QA |
| 28 | Owner mine/team | PASS isolated QA |
| 29 | Privacy | PASS isolated QA |
| 30 | Tenant isolation | PASS isolated QA |
| 31 | Security regression | PASS isolated QA |
| 32 | Autosave regression | PASS isolated QA |
| 33 | Runtime/browser errors | No general observation; local checks passed; prior pilot DEP0169 warning remains documented |
| 34 | QStash schedule healthy | YES for existing pilot; Free capacity FAIL for proposed general sweep |
| 35 | Pilot fixtures cleaned | NO — retained after safety STOP |
| 36 | Git status | Prepared changes committed separately; origin/main untouched |
| 37 | PROJECT_STATE/HANDOFF updated as complete | NO — completion would be false |
| 38 | NOTIFICATIONS GENERAL PRODUCTION ROLLOUT COMPLETE | NO |
| 39 | DEVELOPMENT 12 COMPLETE | NO |
