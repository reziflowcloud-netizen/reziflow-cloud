# Development 13 — QA evidence, 2026-11-19

Status: **BLOCKED for actual Stripe Test Mode acceptance; ready for independent code review with the flag OFF.** No production changes. No real Stripe API/payment/subscription calls. No credentials were committed.

## Actual results

| Check | Result | Evidence/scope |
| --- | --- | --- |
| Origin/main audit | PASS | Fetched HEAD equals `41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04`; isolated branch/worktree |
| Hosted Stripe Test Checkout | SKIP | No Test secret/webhook credentials; Stripe API not available under environment network policy |
| Test products/Portal already created | REPORTED | Prior “Work Stripe Registration & Verification” final messages, not a new account verification |
| Official SDK request serialization | PASS | Actual `stripe@23.2.0` HTTP client against a loopback provider fixture; pinned API request header |
| Signed raw webhook / public middleware route | PASS | Real built app/API, official SDK test signatures, disposable PostgreSQL |
| Idempotency / concurrent retries | PASS | One Customer/session across concurrent requests, one ledger entry/projection across eight event retries, external-success rollback recovery |
| Out-of-order events / replacement subscription | PASS | Current remote state fetched under tenant lock; equal-second events and late old-subscription events cannot roll back the current subscription |
| Subscription lifecycle | PASS locally | First paid period, initial failure, failed renewal, grace/recovery, cancellation/undo, replacement after cancellation including unpaid replacement |
| Tenant / role / session isolation | PASS | Current database Owner/Admin, restricted/employee denial, foreign tenant, stale session, hostile Origin, extra client IDs, Customer metadata mismatch |
| Billing compatibility | PASS | Manual/Agency/trials/custom limits protected; existing limit enforcement; flag OFF fallback; no data deletion |
| UI RU/UA/PL | PASS | Actual components, current plan, prices, period/status, Portal, cancellation, grace, pending/error/loading and localized contact dialog |
| Mobile/tablet/desktop | PASS | 54 combinations: RU/UK/PL × Light/Dark/Slate × 390/414/430/768/1024/1440; no horizontal overflow/browser exceptions |
| Migration SQL audit | PASS | Actual existing Local Maintenance Runner parser; six additive statements; SHA256 `2ffda4bdc897c43a469e4e1fa8099e94f0beaee6ccd35014ab7d8d3dafa52ee3` |
| Disposable PostgreSQL migrations | PASS | 55 migrations including the new migration; loopback port 55439 only |
| OLD APP + NEW DB | PASS | Baseline generated Prisma client + actual baseline billing code; 50 existing table data hashes unchanged, old read/write works |
| TypeScript / Prisma / safe build | PASS | Exit 0; no remote DB configured for build |
| Staff routing DB regression | PASS | Four tests, including migration preservation and concurrent isolated assignment |
| Meta Lead Ads DB regression | PASS | Synthetic tenants only; default OFF, unique bindings, tenant FK and concurrent receipt dedupe |
| Meta Messenger/Instagram / legacy ingestion | PASS for available automated checks | Existing source/snapshot/security/pool-timeout tests; relevant provider/legacy files unchanged; no external account or RAM/SL action |
| General existing regressions | BASELINE FAIL | 267 PASS, 1 FAIL, 13 SKIP; failing Push subscription test reproduces on immutable baseline |
| Existing notifications DB regression | BASELINE FAIL | Pagination overlap failure; 10 passing tests, failing subtest + parent (2 reported failures); same failure on immutable baseline |
| Actual Stripe Test Clocks | SKIP | SDK capability checked; no clock created/advanced |
| New GitHub Actions run | PENDING | Workflow added; local commands are the evidence above |

The built application browser test runs with a guarded **test-process-only** network preload. It redirects the actual server SDK's Stripe requests to a local fixture and blocks other remote requests. Browser redirects to the hosted domains stop at an explicit synthetic page. This verifies the application boundaries but **does not validate Stripe's hosted pages or payment processing**. One localized temporary-error scenario uses browser interception to verify UI behavior; the other lifecycle scenarios use real application APIs and PostgreSQL with the SDK fixture.

## Commands and exit codes

All URLs below are synthetic, loopback-only database targets. The disposable PostgreSQL server used `@embedded-postgres/linux-x64@18.6.0-beta.19`, installed outside the checkout. PowerShell 7.5.4 and system Chromium supplied the audit/browser runtimes.

| Actual command | Exit | Result |
| --- | --- | --- |
| `git fetch origin main` / `git rev-parse origin/main` / `git worktree add -b feature/stripe-billing-mvp /workspace/stripe-billing-mvp origin/main` | 0 | Baseline verified; separate checkout |
| `npm install --save-exact stripe@23.2.0` | 0 | Official pinned SDK |
| `npx prisma generate` | 0 | Updated client |
| `DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_qa npx prisma migrate deploy` | 0 | Disposable DB only |
| `/tmp/legalhub-billing-tools/pwsh/pwsh -NoProfile -File tests/stripe-billing-sql-audit.ps1` | 0 | Existing Local Maintenance Runner audit |
| `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect npx prisma validate` | 0 | Valid schema |
| `npx tsc --noEmit --pretty false` | 0 | TypeScript |
| `STRIPE_BILLING_TEST_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_qa npm run test:billing` | 0 | 17 PASS, 0 SKIP |
| `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect JWT_SECRET=synthetic-build-only-secret NEXT_TELEMETRY_DISABLED=1 CIRCLE_NODE_TOTAL=3 npm run build` | 0 | Safe Next build; input digest captured |
| `STRIPE_BILLING_TEST_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_qa node scripts/qa-stripe-billing-browser.mjs` | 0 | Actual built app + SDK fixture; 54 visual combinations and feature-OFF fallback |
| `STRIPE_BILLING_COMPAT_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_compat_qa node scripts/qa-stripe-billing-compat.mjs` | 0 | Fresh disposable compatibility DB; old app/new DB |
| `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect NEXT_TELEMETRY_DISABLED=1 node --test tests/*.test.mjs tests/security/*.test.mjs tests/local-maintenance/*.test.cjs` | 1 | 267 PASS / 1 baseline FAIL / 13 SKIP |
| `NOTIFICATIONS_TEST_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_notifications_qa DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect node --test tests/notifications-db.test.mjs` | 1 | Baseline pagination failure |
| `RUN_DB_TESTS=1 DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/staff_routing_qa node --test tests/staff-routing-v2-db.test.mjs` | 0 | 4 PASS |
| `META_LEAD_ADS_SYNTHETIC_DB_TEST=1 DATABASE_URL='postgresql://billing_qa@127.0.0.1:55439/meta_lead_ads_qa?schema=public' node tests/meta-lead-ads-db.mjs` | 0 | Synthetic DB isolation/dedupe |
| `git diff --check` | 0 | Whitespace clean |

Baseline reproduction used a read-only `git archive 41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04` extraction under ignored `.qa/baseline-regression`, not another development worktree. From that immutable source:

- `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect node --test tests/push-pilot-api.test.mjs`: **exit 1**, same `409 !== 200` at line 53, with 3 other tests passing.
- `NOTIFICATIONS_TEST_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_notifications_qa_baseline DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect node --test tests/notifications-db.test.mjs`: **exit 1**, same pagination overlap at line 112. Separate disposable baseline database.

These failures were not relabeled PASS or changed as part of Billing. Broader skipped DB cases remain SKIP; the dedicated Billing, Staff, Notifications and Meta database runs above give their actual separate results.

## Review handoff

Independent Engineering Manager Security Review is the next step. Review authorization, paid invoice validation, tenant locking/idempotency, replay of old events, replacement subscriptions, grace and administrative overrides. The Draft PR must remain unmerged and undeployed. Actual Test Mode acceptance and accountant approval remain separate gates. See [implementation/runbook](../../stripe-billing-mvp.md).

The accompanying JSON and representative screenshots contain only synthetic data. Runtime reports/logs without credentials remain in ignored `.qa/`; no production data was copied into the checkout.
