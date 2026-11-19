# PR #20: R6 correction and Windows structure diagnostics

Intake HEAD `9d364bdf35e07f1b8f1ea5f86d7031e406bb501e`, main `41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04`; remote refs matched and the isolated Stripe checkout was clean. R6 implementation commit: `f5557c5`.

## R6 reproduction and correction

Before the correction, the new real PostgreSQL regression persisted the fallback round-robin cursor (0 → 1), Lead and employee/user assignment through the unchanged legacy HTTP handler, but the signed paid webhook returned HTTP 200 with the organization still Free. The provider response is held by an explicit test barrier until cursor/Lead/assignment persistence and the still-Free, in-flight reconciliation state have been asserted; this proves the writes precede finalization independently of machine speed. The same test now applies Starter and the verified paid period. Concurrent delivery returns retryable BUSY; duplicate deliveries perform no provider calls, do not advance coordinator generation and retain one reconciliation operation/event. No provider POST is issued by reconciliation.

The billing fingerprint now explicitly includes `plan`, `status`, `billingProvider`, `billingStatus`, `billingCustomerId`, `billingSubscriptionId`, `billingPriceId`, `trialStartedAt`, `trialEndsAt`, `currentPeriodEndsAt`, `cancelAtPeriodEnd`, `graceEndsAt`, and `settings.billingLimits`. Other settings, including routing cursors, UI preferences, notification configuration and Google Sheets metadata, are excluded. The complete billingLimits value is retained conservatively, including unknown/custom keys. This needs no new administrative version column/write-path migration.

Finalization still locks the organization for a short transaction, rechecks the billing fingerprint, current actor authorization where applicable, runtime flag, lease expiry, operation pointer, generation and fencing token. All Stripe I/O remains outside transactions. Genuine concurrent billing overrides return HTTP 409, persist verified financial references/result and `ADMINISTRATIVE_CHANGE` in a durable `manual_review` operation, and create **no completed StripeBillingEvent**. A duplicate requests manual review instead of claiming payment was applied. Flag disablement remains uncertain/retryable. Database finalization failure rolls back both entitlement and ledger; normal retry applies once. Explicit policy ignores established before provider reconciliation (e.g. an old subscription or an already manual organization) remain distinct from an unsafe finalization conflict.

## Verification

Commands run with only explicit disposable loopback database configuration, never repository/private environment files:

| Command / scope | Result |
| --- | --- |
| `STRIPE_BILLING_TEST_DATABASE_URL=.../legalhub_billing_qa npm run test:billing` | Exit 0: 57 PASS, 0 FAIL/SKIP; original 47 plus 10 R6 checks. Original uncorrected run failed all four unrelated-settings cases and five genuine-conflict cases as expected. |
| `npx tsc --noEmit`; synthetic-unreachable-DB `npx prisma validate` | Exit 0 |
| `pwsh -NoProfile -File tests/stripe-billing-sql-audit.ps1` | Exit 0; existing audit accepts both additive migrations |
| `STRIPE_BILLING_COMPAT_DATABASE_URL=.../legalhub_billing_compat_qa node scripts/qa-stripe-billing-compat.mjs` | Exit 0; OLD APP + NEW DB reads/writes, 50 existing table hashes unchanged; NEW APP + OLD DB flag OFF before billing tables exist |
| `LEAD_WEBHOOK_POOL_TEST_DATABASE_URL=.../legalhub_webhook_qa?connection_limit=1&pool_timeout=5 ... node --test tests/lead-webhook-pool-timeout.test.mjs` | Exit 0: 6 PASS |
| `RUN_DB_TESTS=1 DATABASE_URL=.../staff_routing_qa ... node --test tests/staff-routing-v2-db.test.mjs` | Exit 0: 4 PASS |
| `META_LEAD_ADS_SYNTHETIC_DB_TEST=1 DATABASE_URL=.../meta_lead_ads_qa?schema=public ... node tests/meta-lead-ads-db.mjs` | Exit 0; tenant FK, default OFF, binding uniqueness, concurrent dedupe, old Lead query |
| `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect STRIPE_BILLING_ENABLED=false ... node --test tests/*.test.mjs tests/security/*.test.mjs tests/local-maintenance/*.test.cjs` | Exit 1: 268 PASS, 1 existing Push failure, 14 explicit DB skips |
| `NOTIFICATIONS_TEST_DATABASE_URL=.../legalhub_notifications_qa ... node --test tests/notifications-db.test.mjs` | Exit 1: 10 PASS, 2 FAIL (pagination child + parent), 0 SKIP |
| Same Push and Notifications tests from immutable main source extracted under ignored `.qa/baseline-regression` | Same failures: Push line 53 `409 !== 200`; Notifications line 112 overlapping pages. Test blobs match main exactly. |
| Unreachable synthetic DB, synthetic JWT, telemetry OFF, `CIRCLE_NODE_TOTAL=3 npm run build` | Exit 0 |
| `STRIPE_BILLING_TEST_DATABASE_URL=.../legalhub_billing_qa CHROMIUM_PATH=/usr/bin/chromium node scripts/qa-stripe-billing-browser.mjs` | Exit 0: 54 RU/UA/PL × Light/Dark/Slate × six viewport combinations; actual built browser/API/DB flow, manual-review states, flag OFF |
| `pwsh -NoProfile -File tests/local-maintenance/structure-proof-tests.ps1` | Exit 0: 66 model checks |
| `git diff --check` | Exit 0 |

F1–F5 remain covered: real SDK HTTP with 15s delay/10 Checkouts, six same-tenant channel-routed legacy requests, other tenant, two connections, zero idle transactions across seven samples and zero observed Organization locks; stale leases, short bounded lock failures, immutable operation recovery, 23h replay bound, cached 500/429/disconnect/timeout, revocations/flag changes, finite cancellation and strict settlement/refund/dispute checks. This run observed 601 instrumented SDK calls outside transactions, and six legacy ingestions completed in 88ms during the 15s provider delay. The new R6 test separately exercises actual **fallback** routing, with no channel route configured.

No new migration. Existing feature migrations are `20261119170000_stripe_billing_test_mvp` and `20261119190000_stripe_billing_operations`; only named synthetic databases were migrated/reset. No existing table destructive DDL was introduced.

## Windows evidence

**STATUS: BLOCKED — historical Windows root cause remains UNKNOWN.** Both diagnostic attempts on code HEAD `df493620515686fd656dce9a0334d0dbce28542f` passed: [Meta run 44593496891](https://github.com/reziflowcloud-netizen/reziflow-cloud/actions/runs/44593496891), structure jobs `135805526372` and `135807817041`. The [Stripe run 44593496694](https://github.com/reziflowcloud-netizen/reziflow-cloud/actions/runs/44593496694) also passed all steps. Final exact-HEAD CI links and SHA are published in the PR comment after the report commit.

Actual selected server/postgres/initdb/pg_dump/pg_restore: **17.11**; PowerShell **7.6.9**; Windows image `win25-vs2026`, version `20261103.298.1`. Both prior and current guards passed 94 structure checks (66 model checks included), and real lock-safety tests passed. Both positive equality stages have count 33 and digest `82e00cac296200e36e28ee2f2b1953eeab6f4b21449b548a0ac065d3973c5b01`:

- `tests/local-maintenance/structure-proof-tests.ps1:186`, `source-pre-backup-after-reversible-ddl`: PASS.
- `tests/local-maintenance/structure-proof-tests.ps1:196`, `target-post-pg-dump-restore`: PASS.
- Negative checks prove first-difference diagnostics: `proof.table_flags|LeadChannelRouteMember`, property `rls`, true → false; `proof.sequence|QaSequence`, property `increment`, 1 → 2. Strict rejection remains intact.

Historical jobs `135761799292` and `135763622829` from run `44581144634` did not record which positive assertion failed. Their exact historical failure stage therefore remains **UNKNOWN**, not inferred from timing or a generic exception. That run used image `20261116.315.1`; its inventory drift (PG 17.12 / PS 7.6.10) is not proof of causation. Same-runner prior/current comparisons have identical guard hashes and pass, so this is not labeled a proven baseline defect or fixed backup corruption. Local PS 7.6.10 passes all 66 model checks and produces the same digest as PS 7.5.4 for a shared synthetic descriptor input, which also does not establish the Windows cause. The full Windows PG17.12/PS7.6.10 failing environment was not reproduced. No speculative production guard fix was made. A proven cause/fix remains required before declaring READY.

The first added diagnostic run `44593183878` failed in diagnostic collection (multiline JSON aggregate conflicted with the existing one-row query boundary). Commit `df49362` fixes the **test-only collector** using `jsonb_agg`; the successful runs above exercise it. That intermediate failure is not the original structure mismatch. No production Local Maintenance Runner file was changed.

 Diagnostics are test-only, with separate source/pre-backup and target/post-restore markers, exact caller line, selected server/tool/PowerShell/runner versions, synthetic descriptor counts/digests before/apply/undo, and the first differing object/property. The prior successful guard is extracted from `596dabf48169e3c8f10beee431b1e20d4ab5b782` and exercised with the same diagnostic fixture in the same runner before the current guard. The current strict guard job remains mandatory. The comparison step is diagnostic only and cannot substitute for it.

## Scope and handoff

Hosted Stripe Test/Live acceptance, real payments and Production/RAM smoke are SKIP by explicit task restriction. The 14 broad-suite skips require opt-in DB environment variables; billing, legacy, Staff Routing, Notifications and Meta are exercised separately above. No change to Production, private configuration, actual RAM/SL organizations, Meta settings, FakturaXL/KSeF, existing routing code or other worktrees. Feature flag OFF, deployment exclusion retained, existing PR remains Draft. No merge, deployment or force push. Next: independent Engineering Manager Security Re-review of the final exact HEAD recorded in PR #20.
