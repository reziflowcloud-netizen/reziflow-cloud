# Document actualization — final development QA

Base `895ebe271f8a2c106029992f0497252cc9a81eee`; branch
`feature/document-actualization-reminders`. No Production writes, credentials,
migrations, activation/backfill, deployment, PR or main merge.

## Source identity

Tested application source commit: `a2cd68132e5598b8e931625e3623c799c23a6671`.
Later checkpoint/report changes do not alter `src`.

- Git `src` tree: `449a5c07f9f446287229020a596ef16930fe06b1`.
- Feature and copied-app SHA-256, before **and after** integration/browser runs:
  `f82a40ef33dcbd2077223cd983a16b5966090d2e986ab51a9b1b9d1c8fbad3da`.
- Runners reject a different copied tree or uncommitted `src`. Reports record HEAD,
  tree/digests and runner SHA-256. Final runner hashes match their committed files.
  No stale copied-app result is counted as final PASS.

## Results

| Check | Observed result |
| --- | --- |
| Feature PostgreSQL/authenticated HTTP/real delivery entry point | **18 groups PASS** |
| Real app/browser | **6 pairwise matrix cases + 3 mutation journeys PASS** |
| Focused regressions | **87 PASS, 0 FAIL, 2 SKIP** (89 registered) |
| Isolated TypeScript `--noEmit` | **PASS**, exit 0 |
| Isolated `npm run build` | **PASS**, exit 0; Prisma generation + Next build only |
| UI-only actual-component mock harness | **6 cases + 3 checks PASS**, errors 0 |
| Existing empty local migration chain | **52 applied successfully**, no new migration |
| Aggregate inventory SQL | Local synthetic READ ONLY run PASS; **Production completed: user-provided trusted-operator evidence** |

The two skips are the pre-existing opt-in DB/API and Phase 3B pool=1/performance
suites in `notification-organization-opt-in.test.mjs` and
`notification-scheduled-phase3b.test.mjs`: `NOTIFICATIONS_TEST_DATABASE_URL` was
intentionally not supplied to those separate fixture suites. They are not counted
as PASS. Required feature DB/notification coverage ran separately against this
feature's dedicated database in the 18-group suite. Work independently reported
55/55 checks passing; those are not added to the counts above.

Detailed reports: [integration](qa/document-actualization/integration.json),
[browser](qa/document-actualization/browser.json),
[UI-only](qa/document-actualization/ui-only.json).

Integration covers latest valid genuine dates, service records, no date, explicit
ownership, tenant/restricted access and Mine visibility; exact POST replays and date
ties; concurrent child writes; Case-versus-child CAS/rollback; add/edit/delete and
fallback; A→B→A and completed-cycle preservation; reserved metadata/ownership/date/
delete guards; master OFF, event preferences, push opt-out, watermark and bounded
historical suppression; repeat/concurrent scheduler dedupe; real
`deliverNotificationPush` with mock provider, privacy, scoped organization projection,
fresh completion/occurrence rechecks; queued and provider-failed retry cancellation;
and three scheduler-versus-stop races using the documented lock order.

Browser journeys verify receipt autosave immediately removes/resumes Case Task views
without reload, reload persistence, current-language Task/Calendar titles, mobile
Case links, no horizontal overflow; actual DocUpdate add/correct/delete with CAS;
Warsaw-day timestamp display/edit preserving the original stored timestamp for a
text-only correction; and neutral no-date/no-task behavior. Final unexpected runtime
errors and HTTP 5xx: **0 / 0**. Screenshots contain synthetic data only.

| Width | Language | Theme | Case / Calendar |
| --- | --- | --- | --- |
| 1440 | RU | Light | [Case](qa/document-actualization/1440-ru-light.png) / [Calendar](qa/document-actualization/calendar-1440-ru-light.png) |
| 1440 | UA (`uk`) | Dark | [Case](qa/document-actualization/1440-uk-dark.png) / [Calendar](qa/document-actualization/calendar-1440-uk-dark.png) |
| 1024 | PL | Slate | [Case](qa/document-actualization/1024-pl-slate.png) / [Calendar](qa/document-actualization/calendar-1024-pl-slate.png) |
| 390 | RU | Dark | [Case](qa/document-actualization/390-ru-dark.png) / [Calendar](qa/document-actualization/calendar-390-ru-dark.png) |
| 414 | UA (`uk`) | Slate | [Case](qa/document-actualization/414-uk-slate.png) / [Calendar](qa/document-actualization/calendar-414-uk-slate.png) |
| 430 | PL | Light | [Case](qa/document-actualization/430-pl-light.png) / [Calendar](qa/document-actualization/calendar-430-pl-light.png) |

This is a pairwise sample, not every Cartesian combination. Independent Windows
visual QA uses the [UI-only harness](document-actualization-ui-review.md).

## Independent Work Windows review (reported)

Work confirmed stop/save/reload/resume/reopen, RU/UA/PL, Light/Dark/Slate samples,
390px without overflow, and exactly one localized Task in Tasks and Calendar.
No console errors were seen. The harness-only logo returned 404. Native date entry
through Work CUA did not produce a valid date: this was a tool limitation, not a
CRM failure. Real-app browser add/edit/delete and timestamp correction are covered
by the successful suite above. Work's review is separate evidence, not added to
Cloud test counts.

## Architecture / migration rationale

No schema or migration changes: Case dates/receipt and existing Task metadata,
status, deterministic IDs and unique notification/outbox keys are sufficient. All
52 base migration files and Prisma schema remain unchanged. New Cases without a
date create no Task; later relevant input changes activate normally. Retained
inactive/completed per-cycle Tasks form the ledger, avoiding a separate activation
column or destructive history cleanup. No GET/scheduler/deploy backfill exists.

Managed controls alone are protected/retired. Existing manual and other automatic
Tasks, Case status/date semantics, document upload/history records, routing,
notification settings and QStash schedules are unchanged. Decision receipt stops
this automation regardless of outcome; completing a control does not invent an
actualization entry or another cycle. Already handed-off provider sends cannot be
recalled; queued/retry sends are suppressed with Case→Task locks and fresh state.

Changed source groups: `documentActualizationPolicy.ts` (date/cycle/localized display),
`documentActualization.ts` (ledger/ownership/delivery guards), `docUpdateWrite.ts`
(parent lock/CAS/scoped corrections), existing Case/checklist and Task API hooks,
existing candidate/evaluator/push/notification-visibility paths, Case inline status,
and metadata-aware Case/Tasks/Calendar/UpcomingEvents rendering. Exact paths are in
[changed-files.txt](qa/document-actualization/changed-files.txt).

## Reproduce real isolated QA

Node 24, dependencies, Docker/local socket, Chromium. Free loopback ports 55435/3127.
Use a fresh dedicated container; never point the scripts at a shared database.
The names/password below are deliberately disposable synthetic fixture values.

```sh
npm ci --ignore-scripts
docker --host=unix:///var/run/docker.sock run -d --name legalhub-actualization-qa --label codex.qa=document-actualization -e POSTGRES_USER=actualization_qa -e POSTGRES_PASSWORD=disposable_only -e POSTGRES_DB=actualization_qa -p 127.0.0.1:55435:5432 postgres@sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6
# Wait for local pg_isready before migration.
node scripts/document-actualization-local.cjs node node_modules/prisma/build/index.js generate
node scripts/document-actualization-local.cjs node node_modules/prisma/build/index.js migrate deploy
node scripts/document-actualization-local.cjs typecheck
node scripts/document-actualization-local.cjs dev
```

Another terminal, after server readiness (no source edits during these runs):

```sh
node scripts/actualization-source-evidence.cjs
node scripts/document-actualization-local.cjs node scripts/qa-document-actualization.mjs
node scripts/document-actualization-local.cjs node scripts/qa-document-actualization-browser.mjs
node scripts/document-actualization-local.cjs build
node --test --test-isolation=none tests/document-actualization-policy.test.mjs tests/decision-received.test.mjs tests/entity-autosave.test.mjs tests/entity-write-compatibility.test.mjs tests/case-personal-appearance-note.test.mjs tests/mobile-refresh-autosave.test.mjs tests/notification-scheduled-phase3b.test.mjs tests/notification-organization-opt-in.test.mjs tests/security/hardening.test.mjs tests/staff-routing-scope.test.mjs tests/deployment-safety.test.mjs
```

The local runtime copies source/config without repository env files, supplies only
local synthetic DB/JWT selectors and uses an independent build dependency/schema
tree. Credentials are not printed. Integration push keys/subscriptions/passwords are
random synthetic values held in memory; the provider is injected, never contacted.
Only previous failed-run tenants with this runner's exact synthetic name/slug are
quiesced inside the dedicated QA DB. Existing onboarding/other databases are unused.

## Tool failures versus product fixes

Interim attempts encountered a copied old source snapshot, Next losing watched
routes after directory replacement (404), sandbox child-process stdout/exec limits,
and a test retry counter including other deliberately queued fixture notifications.
Those runs are not final PASS evidence. The source/digest gate, snapshot-preserving
runtime/restart procedure, supported process permissions and fixture cleanup address
those test-environment issues. Final 18-group/browser runs passed on the source
identity above. The existing Browserslist age/module-type warnings are nonblocking;
no package/lockfile update was made.

Product corrections from Work review were applied: organization projection and fresh
notification occurrence in managed delivery; reserved metadata POST/PATCH rejection;
null body validation; historical description-only activation guard; cross-TZ date
validation and timestamp-preserving UI correction; immediate receipt task refresh;
and current-language desktop/mobile Task/Calendar titles.

[Production inventory and future activation plan](document-actualization-inventory-plan.md)
is completed based on user-provided trusted-operator evidence: total 278, dated 56, overdue 33, invalid/unlinked responsible 54, automation ledger 0. Not rerun by Codex. No activation/backfill/merge/deploy.
