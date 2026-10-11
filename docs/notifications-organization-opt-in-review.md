# Notifications organization opt-in / QStash Free review

Prepared 2026-10-11. **Implementation and isolated QA only. Production migration,
application deploy, provider reconfiguration and customer enablement deferred.**
This supersedes the proposed global-watermark/full-sweep model. Production
remains the approved TestRezidents/User16 pilot. Its three synthetic fixtures
were preserved; no new Production fixture or manual generation was performed.

## Persistence and authorization

Two Organization columns store the default-false boolean and nullable activation
timestamp. Existing JSON settings writers replace complete snapshots, so using
that JSON could silently lose the master on an unrelated settings write.
The additive migration adds these columns and only the justified
`Task(organizationId, dueDate)` index. It automatically enables no organization,
including the pilot. Future pilot opt-in must be explicit via the authorized
toggle, using the database clock.

The API binds tenant identity to the current authenticated User and rechecks
Owner/Admin full-access in the database transaction. Employee and restricted
Admin get 403; foreign identity fields are rejected. Organization locks serialize
toggle against generation. Repeated ON preserves its watermark; OFF→ON gets
a fresh timestamp. OFF preserves preferences, subscriptions and Center history.
Changing the master invokes no Push permission prompt. Each User separately
enables Push, and retains own channel/event/privacy/Mine-Team preferences.

Phase 3A single/bulk assignments and Phase 3B use persisted opt-in. The global
`NOTIFICATION_EVENTS_ENABLED` emergency gate remains. Generation no longer
requires manual organization/User allowlists or a global activation timestamp.
Dedupe identities, routing, visibility, VAPID/AES, subscriptions and the existing
iPhone click/fallback remain intact.

## Candidate and transport behavior

SQL starts with enabled organizations, then applies occurrence window,
activation, responsible User/explicit Employee link, personal preferences and
existing recipient dedupe keys before ORDER/LIMIT 26. JavaScript receives at
most 26 occurrence identifiers, rechecking at most 25 in short transactions.
Provider calls remain outside transactions. There is no full entity pagination.

Task/Lead use a bounded 24-hour recovery window, never before activation.
Continuations carry the frozen run timestamp and occurrence key. Historical
overdue/contact occurrences and the OFF gap are not backfilled. Case daily
selection uses exact Warsaw DATE at +7/+1 and skips historical missed windows.
SQL was checked against Warsaw DST fold/gap and both Case DST boundaries.

`node scripts/prepare-org-notification-schedules.mjs` prints reviewed metadata
only: no credentials, HTTP calls or generation. Two shared schedules use the
existing fixed Production endpoint, EU queue, parallelism=1, forwarded existing
cron auth, redaction, 2 retries, 55s timeout:

| Stream | UTC cron | Body | Warsaw time |
| --- | --- | --- | --- |
| Task/Lead | `*/15 * * * *` | `{}` | Every 15 minutes |
| Case | `0 6 * * *` | `{"mode":"daily"}` | 07:00 winter / 08:00 summer |

Business DATE stays Europe/Warsaw. Provider UTC behavior is documented by
[Upstash](https://upstash.com/docs/qstash/features/schedules).
These two schedules are **prepared, not applied**; the provider still has its
single existing pilot schedule. GitHub remains manual fallback only, with
separate frequent/daily version-2 checkpoints; no GitHub cron was added.
Automatic Vercel deployment is disabled for this exact review feature branch.

Empty and <=25-candidate runs finish in one QStash message; 26–50 use two; 51
use three. No empty confirmation page is needed. Outbox drains in a bounded
request budget; genuine additional fan-out/slow provider work may require
delivery continuation. Cost boundary tests use fast transport, not unlimited
device fan-out.

## Read-only cost / EXPLAIN evidence

Production audit: **2026-10-11 09:40:56 UTC**, READ ONLY transaction,
PostgreSQL 17.6. New columns are absent in Production. The audit simulated only
the explicit pilot with activation at audit time: **1 ON / 22 OFF of 23**,
without persisting state. Current Task/Lead/Case candidates: **0 / 0 / 0**.
Each empty stream needs one page.

Read-only projection of 96 future 15-minute windows, with static current data
and simulated occurrence dedupe, finds one future Task occurrence, maximum
one candidate/window, and zero next-daily Case candidates. Total stays
**97 messages/day** (96 frequent + 1 daily). Counting two retries on every
request conservatively gives **291/day**. Headroom: **903/1000 (90.3%) normal**,
**709/1000 (70.9%) stressed**. Normal <=300; both estimates <=500.
The 1000/day Free quota was rechecked in
[official pricing](https://upstash.com/pricing/qstash).

These are projections, not a measured provider day after deploy. New opt-ins,
entity edits, fan-out and failures can change volume; repeat the capacity gate
against actual metrics as adoption grows.

Production EXPLAIN ANALYZE confirmed Task only had its primary key and used
a sequential scan. Lead/Case used existing tenant indexes. A local comparison
with 10,000 OFF-tenant Tasks measured **363.924ms without** the new Task index
versus **4.263ms with** it: one selected Task, zero rows removed at its indexed
heap node. All comparison data/DDL rolled back. Existing Lead/Case indexes
remain. Current custom-date volume returned zero qualifying rows; no
speculative custom-date index was added. A boolean-only Organization index
was also omitted for the current 23-row selector.

## QA and rollout boundary

Isolated PostgreSQL regression **259/259**, zero skipped/failed: Center/read/
badge, preferences, Phase 2 Web Push, Phase 3A routes/bulk/ingestion, Phase 3B,
QStash retry/concurrency, iPhone fallback simulation, webhook/Client GET pools,
Staff Routing, Lead visibility, autosave, security and tenant isolation.
Actual API checks cover default OFF, roles/tenant, ON→OFF→ON, unchanged
preferences/subscriptions/history and refreshed watermark. The isolated
counterpart was returned ON; Production was not toggled.

UI: 12 Owner/Employee × RU/UA/PL × 390/1366px variants, no overflow/page errors/
permission requests; Owner ON/OFF works, Employee sees no master. Null, array,
plain-text and invalid reminder descriptions are safe. The migration executed
and rolled back locally: all 14 existing QA organizations became OFF with null
activation; new-organization default OFF is tested separately. TypeScript,
Prisma validate, safe build and diff checks pass. Build uses loopback QA only,
with generation disabled. New-model real iPhone Production QA is deferred;
the previously verified click path was not changed.

For a later approved rollout: pause/drain old pilot schedule/queue and finish
legacy continuations, apply migration, deploy reviewed code, explicitly enable
only TestRezidents through the normal toggle, configure/verify both schedules
and daily body/auth, then resume within approved scope. Customer organizations
stay OFF until their own opt-in. Never resume old v1 manual checkpoints against
the new candidate cursor format.

## Requested 43-item checklist

PASS means isolated implementation QA unless qualified. Exact commit, remote
equality and clean status are verified in the delivery message, avoiding a
self-referential commit hash in this file.

| # | Check | Result |
| --- | --- | --- |
| 1 | Organization storage | Two dedicated Organization columns |
| 2 | Migration needed | YES; additive, not applied in Production |
| 3 | New organizations default OFF | YES |
| 4 | Existing non-pilot OFF | YES after migration; Production pilot gate unchanged |
| 5 | TestRezidents ON | Pilot preserved; isolated counterpart returned ON; new Production master deferred |
| 6 | Owner/Admin toggle | PASS |
| 7 | Employee blocked | PASS; 403, restricted Admin too |
| 8 | Activation timestamp | PASS; database clock |
| 9 | OFF→ON no backfill | PASS |
| 10 | ON→OFF stops events | PASS |
| 11 | Re-enable watermark | PASS |
| 12 | Phase 3A master | PASS; single/bulk |
| 13 | Phase 3B master | PASS |
| 14 | Task candidate-first | PASS |
| 15 | Lead candidate-first | PASS |
| 16 | Case daily | PASS; Warsaw DATE |
| 17 | DB filtering / no JS mass-filter | YES |
| 18 | QStash schedules | 2 prepared; current provider still 1 pilot schedule |
| 19 | Frequent cadence | Every 15 minutes prepared |
| 20 | Case cadence | Daily 06:00 UTC prepared |
| 21 | Empty run deliveries | 1 |
| 22 | Normal/day | 97 projected |
| 23 | Reasonable stressed/day | 291 projected |
| 24 | Free headroom | 903 normal / 709 stressed |
| 25 | Production enabled-org count | Legacy pilot 1; persisted model not deployed; simulated 1 ON / 22 OFF |
| 26 | Task candidates NOW | 0 in explicit read-only pilot simulation |
| 27 | Lead candidates NOW | 0 |
| 28 | Case candidates NOW | 0 |
| 29 | Pool=1 | PASS |
| 30 | P2024 regression | PASS; no observed failures |
| 31 | P2028 regression | PASS; no observed failures |
| 32 | Concurrent scheduler | PASS; four schedulers/two clients |
| 33 | Dedupe/retry | PASS; atomic outbox/rollback/replay |
| 34 | Security | PASS |
| 35 | Tenant isolation | PASS |
| 36 | Autosave | PASS |
| 37 | TypeScript / Prisma / build | PASS |
| 38 | Changed files | Inventory below |
| 39 | Commit | Exact hash in delivery message |
| 40 | Local == remote | Verified after feature push in delivery message |
| 41 | Git status | Verified after commit/push in delivery message |
| 42 | QSTASH FREE CAPACITY GATE | PASS for audited initial scope |
| 43 | READY FOR FINAL PRODUCTION MODEL REVIEW | YES; rollout deferred |

## Changed files

- `.env.example`, `.github/workflows/notification-scheduler.yml`, `vercel.json`
- `prisma/schema.prisma`, `prisma/migrations/20261011120000_notification_organization_opt_in/migration.sql`
- `scripts/run-notification-job.mjs`, `scripts/prepare-org-notification-schedules.mjs`
- `src/app/api/internal/notifications/route.ts`, `src/app/api/notifications/organization/route.ts`
- `src/app/settings/notifications/page.tsx`
- `src/lib/notificationCandidates.ts`, `src/lib/notificationOrganization.ts`, `src/lib/notificationJobs.ts`
- `src/lib/notificationEventGate.ts`, `src/lib/notificationOccurrence.ts`, `src/lib/notificationPolicy.ts`
- `src/lib/notificationPush.ts`, `src/lib/notificationQstash.mjs`, `src/lib/notifications.ts`, `src/lib/pushSecurity.ts`, `src/lib/scheduledNotifications.ts`
- Deleted obsolete `src/lib/notificationRollout.ts`
- `tests/notification-organization-opt-in.test.mjs`, `tests/notification-general-rollout.test.mjs`
- `tests/notification-events-phase3.test.mjs`, `tests/notification-scheduled-phase3b.test.mjs`, `tests/notifications-db.test.mjs`
- `tests/push-pilot-api.test.mjs`, `tests/push-pilot.test.mjs`, `tests/lead-webhook-pool-timeout.test.mjs`
- This report, superseded gate pointer, `PROJECT_STATE.md`, `HANDOFF.md`

**STOP: Production model review only; no general rollout/additional opt-ins.**
