# Decision received — QA and reproduction

Branch `feature/case-decision-received`; fresh fetched base
`2cfa567b7d638682b551088df2274df51096bd7e`.
Implementation `1747eae`, placement/UI-harness correction `c126592`.
No merge/deployment/remote migration/backfill or production credential reads.
Only the feature branch was pushed. Automatic previews were not used.

## Meaning and audit

`Case.decisionReceived` records receipt marked in CRM independently of positive/
negative outcome. False means unrecorded, not proof of non-receipt. No equivalent
structured field existed. Legacy MOS task/document metadata and dates remain intact.

The additive non-null Boolean defaults false. GET exposes it through the existing
Case projection. PATCH validates strict boolean, handles true and false explicitly,
and preserves omitted values. Existing scope, transaction, CAS, legacy manual-save
bridge and autosave queue remain authoritative. Date/reminder/status/result code is
unchanged. Mobile moves the existing predicted-date input into the existing MOS
accordion, directly above the checkbox; important-date summaries still use that date.
No new section or save system.

## Observed checks

- Focused regressions: **64/64 PASS**, including four receipt-specific queue,
  debounce/rapid-toggle, conflict-retention and reminder no-op tests.
- Real isolated app: **5 integration groups + 6 rendered matrix cases PASS**;
  details in [integration-report.json](qa/decision-received/integration-report.json).
- Checked/unchecked minimal autosave PATCH; reload and leave/reopen; authorized
  colleague sees both states; omitted-field PATCH preserves checked state;
  7 invalid types rejected with no version advance; stale CAS 409.
- Restricted non-owner and foreign tenant GET/PATCH 404; anonymous mutation blocked
  by middleware (redirect followed only when explicitly requested).
- Failure retains unchecked draft while DB stays checked; existing Retry persists
  false. Unrelated MOS/date/status values preserved.
- Receipt-only patches change **zero Tasks and zero Notifications**, comparing
  complete row snapshots, including populated pre-existing reminder/notification
  rows. Mobile date edits still autosave and sync both predicted-decision reminder
  kinds; Important Dates summary changes with the date. Subsequent receipt edits
  leave those populated reminder rows byte-for-byte unchanged.
- Migration chain on empty disposable PostgreSQL: **52 applied, 0 failed, 0 pending**.
- Second disposable DB: base **51 migrations**, insert synthetic legacy Case, then
  `migrate deploy` applies only the additive migration. Every prior Case field and
  `updatedAt` unchanged; new field false. Final **52 applied, 0 failed, 0 pending**.
- All **52 base migration files** (51 SQL files plus lock file) byte-identical to
  base main; no prior migration checksum changed; no `db push`.
- Old Prisma client generated from exact base schema: create/read/update PASS on
  expanded DB. Exact base application on separate loopback port + old client:
  authenticated GET, legacy versionless PATCH and rendered old UI PASS; checked
  receipt, MOS and date preserved by old-app writes.
- Prisma validation PASS. Isolated `npm run build` (`prisma generate && next build`)
  PASS; no migration/seed step. Explicit isolated TypeScript check **PASS** (exit 0).
- UI-only mock harness: six matrix cases plus mock CAS/conflict/failure/retry PASS,
  runtime errors 0. [UI-only report](qa/decision-received/ui-only-report.json).
  This does not prove database/authentication/permissions. Windows execution is
  reserved for independent Work review; Cloud Chromium verified its behavior.

Pairwise matrix (not the entire Cartesian product):

| Width | Language | Theme | Synthetic screenshot |
| --- | --- | --- | --- |
| 1440 | RU | Light | [image](qa/decision-received/1440-ru-light.png) |
| 1440 | UA (`uk`) | Dark | [image](qa/decision-received/1440-uk-dark.png) |
| 1024 | PL | Slate | [image](qa/decision-received/1024-pl-slate.png) |
| 390 | RU | Dark | [image](qa/decision-received/390-ru-dark.png) |
| 414 | UA (`uk`) | Slate | [image](qa/decision-received/414-uk-slate.png) |
| 430 | PL | Light | [image](qa/decision-received/430-pl-light.png) |

All six verify 16×16 square geometry, placement below the predicted-date input,
no page horizontal overflow, true/false autosave, reload/reopen and minimal payload.
Final integration runtime errors / unexpected HTTP 5xx: **0 / 0**.

## Reproduction — frontend only (Windows supported)

See [independent UI review](decision-received-ui-review.md). No Docker/PostgreSQL
or Prisma generation is needed. The harness imports the actual Case page and its
mobile components; only its API/layout/auth context is synthetic.

## Reproduction — real isolated database/app (Cloud/Linux Docker)

Requires Node 24, repository dependencies, Chromium, local Docker socket and free
loopback ports 55434/3107/3108. Do not point these scripts at shared infrastructure.
The scripts refuse other DB host/port/names, use disposable synthetic settings,
and materialize app source under `work/` without repository env files. The build
has its own dependencies/schema; it cannot replace the running app's Prisma client.

Start from a fresh feature checkout; setup intentionally refuses an existing
`legalhub-decision-qa` container rather than reusing/wiping a database:

```sh
npm ci --ignore-scripts
node scripts/prepare-decision-received-qa.cjs
node scripts/decision-received-local.cjs node scripts/qa-decision-db-status.cjs
DECISION_LEGACY_QA=1 node scripts/decision-received-local.cjs node scripts/qa-decision-db-status.cjs
node scripts/decision-received-local.cjs node node_modules/prisma/build/index.js validate
node scripts/decision-received-local.cjs dev
```

Another terminal, while the loopback server is ready:

```sh
node scripts/decision-received-local.cjs node scripts/qa-decision-received.cjs
node scripts/decision-received-local.cjs node scripts/seed-decision-review.cjs
node scripts/prepare-decision-old-app.cjs
node scripts/decision-received-local.cjs old-dev
```

Another terminal after old app is ready:

```sh
node scripts/decision-received-local.cjs node scripts/qa-decision-old-app.cjs
```

The stable review seed prints only synthetic login details. Integration fixture
passwords are random and never printed. Screenshots contain synthetic records only.
The DB container is task-specific, labeled `codex.qa=decision-received`, with only
`127.0.0.1:55434` bound. It is separate from the pre-existing onboarding database.
Setup was run end to end, including both full migration/upgrade paths.

```sh
node --test --test-isolation=none tests/decision-received.test.mjs tests/entity-autosave.test.mjs tests/entity-write-compatibility.test.mjs tests/case-personal-appearance-note.test.mjs tests/mobile-refresh-autosave.test.mjs tests/security/hardening.test.mjs tests/deployment-safety.test.mjs
node scripts/decision-received-local.cjs typecheck
node scripts/decision-received-local.cjs build
```

`build` executes the exact npm build script in a copied, env-isolated app; its
first run installs the unchanged lockfile with scripts disabled, then generates
its own client. The normal repo build script itself is unchanged. Generated
scratch applications under `work/` are outside the explicit isolated typecheck.

## Automation failures distinguished from product findings

Early QA attempts had symlinked route discovery, email normalization, automatic
redirect following, responsive selector/locale formatting and pre-hydration timing
errors. These were harness errors and corrected before final PASS. Screenshot
inspection did identify one product placement issue (desktop grid put the checkbox
beside the date); `c126592` fixes it and geometry assertions now cover it.

The shared dependency directory disappeared during interim browser/build runs
(module-not-found/500); its root cause was not established. Final build dependencies
and schema are fully isolated, and the final complete runs passed.
A root TypeScript invocation also included generated old-app scratch source with a
different Prisma type universe; the explicit isolated source typecheck is used.
Final results supersede those interrupted attempts. The existing Browserslist age
warning is nonblocking; no dependency/lockfile update was made.

No customer data, external messages, Tasks/notification features, QStash, Meta,
Vercel settings/secrets, organization settings, production data or deployment was
changed. Stop at feature-branch review; additive migration is prepared, not approved
for deployment. New app requires the additive column before rollout; old app works
against the expanded DB.
