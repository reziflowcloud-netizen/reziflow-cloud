# Document actualization admin fallback — implementation and QA

PR #4 stays draft. No merge/deployment/Production access, backfill, schema changes,
RAM/SL/Meta changes or QStash cadence changes are authorized or performed.

## Source provenance

Origin fetch was attempted first and failed because the configured proxy socket
was unreachable. Connector fallback fetched PR #4 and all 53 changed files at exact
head `4a157cdab22088100bca3f8ac2fcea826e455cd1`, including binary screenshots.
Every Git blob SHA-1 matched the connector before reconstruction on exact local
base `895ebe271f8a2c106029992f0497252cc9a81eee`. Reconstructed `src` tree matched
`449a5c07f9f446287229020a596ef16930fe06b1`. No repository env file was copied/read.
[Full per-file provenance](qa/document-actualization/connector-provenance.json).

Remote checkpoint `40ae83257808fe82ad9b5e2630e1f34404eb99df` has exact parent
`4a157cdab22088100bca3f8ac2fcea826e455cd1` and tree
`7045a409dcb3730422b21840801485c90b1c0082`. Connector publication used expected_sha
and no force. Local reconstruction commits are not published as remote ancestry.

Final tested local source HEAD: `7b12ca3f03332c96127e7fd72d72f757c6b1f289`.
Final `src` tree: `7593906e1492e343d07f4c205fdcb60ba43b8bd8`.
Feature and copied-app SHA-256 before/after real integration/browser suites:
`86a071128eecfe019ccf81a13842aedfac2749cdd98a5de0bea6b03202aa1085`.
Corrected remote review checkpoint: `c172dc5f72fed2db1058971d0f7be3c1afb2a0c0`.
The final follow-up contains the horizontal title-span fix and raw 40001 conflict
mapping described below. The final remote commit carries this same source tree; later report-only commits
must not be represented as separately tested source changes. Reports record the
local reconstruction HEAD explicitly, rather than claiming it is the remote head.

## Behavior and audit

- Missing assigned User or Employee, inactive Employee, mismatch, or foreign-tenant
  mapping resolves to no owner. Exactly one current managed cycle Task remains
  unassigned with `documentActualization.requiresAssignment: true`. No admin copies
  or random assignment. Same cycle ID, completion history and personal dedupe keys
  survive fallback → responsible → fallback and A → B → A.
- Default Tasks and Calendar obtain the same task feed, with linked Case scope
  checked. Eligible same-org unrestricted Owner/Admin can obtain fallback under
  Mine even without an Employee link. That Task route handles its narrow 409 case
  without changing resolveStaffScope or widening ordinary Mine/employee filters.
  Calendar can retain its Task feed when that separate Case Mine request returns
  409. Tasks remain visible with organization automation OFF.
- RU/UA/PL compact badges appear in desktop/mobile Tasks, Calendar, Case status and
  task views, and Upcoming Events using existing theme variables.
- Candidate SQL, scheduled emitter, Notification Center/unread/authorized-open SQL
  and managed Push authorization agree on a narrow admin fallback exception.
  Ordinary Tasks, assignments, leads, Case reminders and Team Scope keep their
  existing paths. Recipients receive personal Notification rows; existing
  `(organizationId,userId,dedupeKey)` and delivery uniqueness prevent duplicates.
- Existing task_due/task_overdue, activation watermark, recovery window, organization
  master, personal event switches, privacy, Push opt-in and subscription gates remain.
  No new event, scheduler, cadence, migration or historical activation path exists.
- Managed delivery locks Organization SHARE → Case UPDATE → Task UPDATE, then User,
  preference and subscription SHARE; it rereads membership, authorization,
  notification/occurrence, preferences, master activation and subscription before
  provider handoff. Payload/privacy uses that fresh snapshot and transaction client.
  Stop/reassignment wins before handoff or waits until an already-started send ends.
  Already handed-off sends cannot be recalled; no send begins after the revoking
  mutation commits. Preference/subscription APIs lock User UPDATE, including an
  absent-preference insertion, to order changes against delivery.
- Employee active/delete/confirmed identity and User role/restriction/delete paths
  use Organization NO KEY UPDATE and prelock already-ledgered Cases in sorted order before
  FK changes, then reconcile those ledgers with activation=false. Name-only and
  unrelated Case mutations never activate history. Existing decision/CAS/DocUpdate
  paths retain their transactional cycle behavior. No GET/scheduler/deploy backfill.

No schema/migration needed: existing metadata, ledger Tasks, Notification/outbox
uniqueness and row locks provide the required state and ordering.

## Results

| Check | Result |
| --- | --- |
| Dedicated PostgreSQL/authenticated API/real mocked-provider fallback suite | 15 groups PASS |
| Existing feature PostgreSQL/API/provider regression suite on final source | 18 groups PASS |
| Deterministic next-cycle/checklist HTTP lock races | 4 groups PASS; PostgreSQL deadlock delta 0 |
| Dedicated real-app fallback browser matrix | 18 full language/theme/viewport combinations × 4 screens PASS; 9 additional month-chip captures; 0 runtime/HTTP 5xx errors |
| Existing real-app browser regression | 6 matrix samples + 3 correction journeys PASS |
| Focused existing regressions | 88 PASS, 0 FAIL, 2 explicitly skipped (90 registered) |
| TypeScript noEmit | PASS, exit 0 |
| Isolated optimized Next build | PASS, exit 0 |
| Existing migration chain on empty isolated PostgreSQL | 52 applied; no new migration |

The two pre-existing opt-in/Phase 3B DB suites skip because their independent
`NOTIFICATIONS_TEST_DATABASE_URL` fixture was not supplied. They are not PASS.
Required fallback DB, API, recipient and provider/race coverage ran separately.

Dedicated checks include all invalid owner categories; multiple admins/one Task;
default and unlinked Mine access; tenant/restricted denial; master OFF; repeated
and concurrent scheduler dedupe; personal Center API visibility; reassignment
identity/history; actual provider entry point and privacy; changed role, personal
preferences, master and subscription after early snapshots; locked provider versus
confirmed reassignment; scheduler versus reassignment; Employee active/identity
and User/Employee deletion APIs; personal event opt-out; latest genuine date +90,
service exclusion, decision stop/resume, completion and ordinary Task regression.
No real provider is contacted. Synthetic VAPID/Push keys are memory-only.

Fallback browser coverage is the full 3 languages × 3 themes × 2 widths (1024/390)
matrix: 18 samples covering Tasks, Calendar, Case Detail and Upcoming Events, plus
9 dedicated desktop month-chip captures. Chip checks assert height ≤18px, visible
title/badge widths ≥8px, horizontal containment, top alignment and complete aria/title
labels. Full labels remain in day detail/mobile. Ordinary chips keep their original
rendering. Existing responsible-flow browser coverage remains six pairwise samples
and three real correction journeys. All 93 screenshots are synthetic; committed
PNG samples cover all nine desktop month chips and all nine mobile Calendars. The
portable review bundle contains every screenshot; JSON reports list generated paths.

Work independently verified the corrected checkpoint's 16 blob hashes, 63 local
regression/owner/date tests PASS with no skips, and desktop/mobile samples. Those
counts are separate from Cloud counts; Work's missing web-push dependency is not a
Cloud skip. Final Cloud dependencies include web-push. The optional Cloud DB suites
above are the only skipped suites in the stated focused regression command.

Work's lock inversion report was reproduced on local 8bef7c5, which retained the
checkpoint lock order: new-cycle DocUpdate and Case Task INSERT FK checks and
checklist readiness could deadlock against Employee deactivation. Real API trigger
barriers now verify Organization SHARE → Case → Task for those writers; identity
uses Organization NO KEY UPDATE → sorted activated Cases before FK mutations.
New-Case creation and checklist write wrapper take the same leading SHARE. FK KEY
SHARE remains compatible; GET/access policy/ordinary event behavior is unchanged.
Only the test database gets scoped temporary trigger barriers, removed in finally.

The final run records initial identity HTTP [200,409], followed by explicit GET of
the current link and confirmed retry yielding [200,200]. Other three races return
[200,200] immediately. PostgreSQL deadlock counter delta is 0. An expected existing
Serializable conflict is distinct from a deadlock: Prisma raw SQL 40001 is now
mapped to the same 409 refresh/retry contract as P2034, rather than generic 500.
No automatic business mutation retry was added. Inactive/completed cycle Tasks and
their stored Notification rows are asserted preserved.

## Reproduce / independent Work review

Use a clean checkout with cached dependencies (Node 24, Prisma 5.22, Chromium).
Never run against a shared DB. Local runtime clears inherited app secrets and
never copies repository env files. It supplies only disposable loopback credentials.

```sh
# Cached postgres:16-alpine image was available; no download was needed.
docker --host=unix:///var/run/docker.sock run -d --name legalhub-admin-fallback-qa --label codex.qa=admin-fallback -e POSTGRES_USER=actualization_qa -e POSTGRES_PASSWORD=disposable_only -e POSTGRES_DB=actualization_qa -p 127.0.0.1:55435:5432 postgres:16-alpine
node scripts/document-actualization-local.cjs node node_modules/prisma/build/index.js generate
node scripts/document-actualization-local.cjs node node_modules/prisma/build/index.js migrate deploy
node scripts/document-actualization-local.cjs typecheck
node scripts/document-actualization-local.cjs dev
# In another terminal after readiness; no source/HEAD changes during suites:
node scripts/document-actualization-local.cjs node scripts/qa-admin-fallback-lock-order.mjs
node scripts/document-actualization-local.cjs node scripts/qa-admin-fallback.mjs
node scripts/document-actualization-local.cjs node scripts/qa-admin-fallback-browser.mjs
node scripts/document-actualization-local.cjs node scripts/qa-document-actualization.mjs
node scripts/document-actualization-local.cjs node scripts/qa-document-actualization-browser.mjs
node --test --test-isolation=none tests/document-actualization-policy.test.mjs tests/decision-received.test.mjs tests/entity-autosave.test.mjs tests/entity-write-compatibility.test.mjs tests/case-personal-appearance-note.test.mjs tests/mobile-refresh-autosave.test.mjs tests/notification-scheduled-phase3b.test.mjs tests/notification-organization-opt-in.test.mjs tests/security/hardening.test.mjs tests/staff-routing-scope.test.mjs tests/deployment-safety.test.mjs
node scripts/document-actualization-local.cjs build-prepare
# This run copied cached dependencies; no package/lockfile changes or network install.
cp -a node_modules work/actualization-build/node_modules
node scripts/document-actualization-local.cjs build
```

If local socket/subprocess execution is sandbox-denied, use the environment's
supported execution permission path. This run obtained access and used only the
local socket. Restart Next after a changed source snapshot is copied, because its
watcher can retain removed route directories. Do not change HEAD mid-suite: source
provenance checks deliberately reject even report-only HEAD drift. Interim fixture
email/device-label mistakes and source-refresh/HEAD-drift runs are not final PASS.
The existing browser suite caught a valid-responsible Case task projection dropping
assignedToId; the projection and badge now distinguish omitted fields from explicit
null ownership. A focused regression protects that behavior.
No dependency installation or network-policy workaround was required.
A cold-route barrier timeout was resolved by warming real routes before taking the
barrier. The old correction runner could click Delete before the previous save
completed its Case refresh and correctly received 409; it now waits for the real
subsequent task-feed request, which occurs after version adoption. A screenshot
inspection caught an uncontained title span despite passing height checks; inline
flex sizing and explicit horizontal/visible-width assertions fixed that gap.
Final DB-mutating suites ran strictly sequentially: lock races, fallback integration,
existing integration, fallback browser, existing browser. Every suite also uses
separate synthetic organizations/Cases and scoped cleanup. Failed/interrupted runs
were excluded; final PASS reports share the source identity above.

Independent database-free actual-component review remains available through
`scripts/document-actualization-ui-harness.cjs` and its existing guide; it is UI-only,
not security/provider evidence. The two new real-app runners above exercise fallback.

## User-provided completed Production inventory

Trusted inventory was already completed: total 278, dated 56, overdue 33,
invalid/unlinked responsible 54, automation ledger 0. This is user-provided evidence,
not a Codex Production run or independent verification. Do not rerun or backfill.
Inventory completion does not authorize release. PR remains draft for independent
Work Engineering Manager review; no ready-for-review/merge/deploy action.
