# PR #20 — F1–F5 correction evidence

Date: 2026-11-19. Reviewed input HEAD: `596dabf48169e3c8f10beee431b1e20d4ab5b782`; main: `41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04`. Both matched remote at intake; the isolated checkout was clean. This updates only the existing Stripe branch/PR, with the flag OFF and deployment exclusion retained.

## Findings and actual local results

| Finding | Local result | Evidence |
| --- | --- | --- |
| F1 DB locking | FIXED | No provider call in an interactive transaction; short reservation/POST-marker/finalization transactions; 60s lease, generation/token fencing; bounded lock/pool waits. Real PostgreSQL + official SDK HTTP delay 15s; 10 concurrent Checkouts; 6 same-tenant real legacy HTTP ingestions complete in **140ms**; Staff Routing and another organization proceed; two pooled connections, zero idle transactions across seven samples and zero Organization locks during the observed delay. 454 instrumented SDK calls outside transactions. |
| F2 idempotency | FIXED | Immutable plan/Price/URL/body/fingerprint; Customer and Checkout commit-loss recovery; different-plan/config retry; completed Checkout mapping without a new subscription; conservative 23h window; cached Customer/Checkout 500; 429, reset, timeout; ambiguous/expired outcomes fail closed; fenced stale worker. |
| F3 workflow | FIXED locally; CI verified after push | Double-quoted health command parses as YAML; workflow checks out explicit PR head and runs both billing suites. Actual exact-HEAD run and step conclusions are published in the PR comment; local preparation is not called container PASS. |
| F4 cancellation | FIXED | Before/at/after/7-days-after boundary; no grace for known cancellation; missing/invalid end is Free; verified reversal; failed renewal plus cancellation uses the last truly paid date. |
| F5 settlement | FIXED | Invoice totals/balances/discounts/credits + InvoicePayment → PaymentIntent → captured Charge proof. Unsupported financial states and refund/credit-note/dispute events enter distinct manual review, never create paid access, extend paid-through or cause another charge/subscription. |

`npm run test:billing`: **47 PASS, 0 FAIL, 0 SKIP**, actual disposable PostgreSQL, real SDK HTTP serialization/signatures and controlled faults. The fixture uses a unique provider-ID namespace per instance and models in-flight idempotency conflicts/cached responses. SDK may transparently retry one ECONNRESET despite configured network retries 0; the same immutable key is asserted and no extra object is created.

The slow-network test invokes the **unchanged real legacy handler over a loopback HTTP server**, with actual ingestion/billing/routing queries and PostgreSQL locks. Only its DB instance and post-commit external push transport are injected. An additional existing one-connection legacy suite verifies replay, routing/notification persistence and wrong-key rejection.

## Other checks

| Check | Actual result |
| --- | --- |
| SQL guard / disposable migrations | PASS; both additive migrations, 56 total migrations |
| OLD APP + NEW DB | PASS; actual baseline Prisma/billing code, 50 table hashes unchanged, old reads/writes work |
| NEW APP + OLD DB, flag OFF | PASS; current snapshot runs before coordinator table exists |
| TypeScript / Prisma / safe build / whitespace | PASS, exit 0; build input hash captured and unchanged during build; unreachable synthetic DB for build |
| Staff Routing DB | PASS, 4 tests |
| Legacy webhook constrained-pool DB/HTTP | PASS, 6 tests |
| Meta Lead Ads DB | PASS, synthetic tenant FK/default-off/binding/dedupe checks |
| Available Meta/RAM/auth/Staff Scope compatibility | PASS for source freeze and automated snapshot/security checks; no real RAM or external Meta action |
| Full existing source suite | 268 PASS, 1 baseline FAIL, 14 SKIP, exit 1 |
| Existing Notifications DB suite | Baseline pagination failure, exit 1; 10 passing tests, failing subtest + parent counted as two failures |
| UI | Real built app and SDK fixture; RU/UA/PL × Light/Dark/Slate × 390/414/430/768/1024/1440, 54 combinations; manual-review notice and no purchase CTA; flag-OFF fallback |
| Actual Stripe-hosted Checkout / external webhook / Test Clocks | SKIP, explicitly outside this synthetic task; no credentials requested |
| Actual Production/RAM smoke | SKIP under Production/real-organization restrictions |

The Push subscription test still fails at `tests/push-pilot-api.test.mjs:53` (`409 !== 200`); Notifications pagination still fails at `tests/notifications-db.test.mjs:112` (overlapping pages). Both were already reproduced on the immutable main baseline in the initial implementation, whose relevant source files remain unchanged. They are not hidden or relabeled PASS. Skipped broad DB tests are distinct from the explicit DB runs above.

## Commands and exit codes

Every DB target is disposable loopback PostgreSQL, port 55439. No repository env files were loaded. PostgreSQL 18 runtime and PowerShell 7.5.4 were installed outside the checkout; browser uses system Chromium locally and Playwright Chromium in Actions.

| Command | Exit |
| --- | --- |
| `git fetch origin main feature/stripe-billing-mvp`; `git ls-remote --heads origin main feature/stripe-billing-mvp`; `git status --short` | 0 (initial rev-parse of an absent local remote-tracking ref was corrected with ls-remote; remote HEADs unchanged) |
| `DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_qa npx prisma migrate deploy` | 0 |
| `npx prisma generate` | 0 |
| `/tmp/legalhub-billing-tools/pwsh/pwsh -NoProfile -File tests/stripe-billing-sql-audit.ps1` | 0 |
| `STRIPE_BILLING_TEST_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_qa npm run test:billing` | 0; 47 PASS |
| `STRIPE_BILLING_COMPAT_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_compat_qa node scripts/qa-stripe-billing-compat.mjs` | 0 |
| `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect npx prisma validate` | 0 |
| `npx tsc --noEmit --pretty false` | 0 |
| `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect JWT_SECRET=synthetic-build-only-secret NEXT_TELEMETRY_DISABLED=1 CIRCLE_NODE_TOTAL=3 npm run build` | 0 |
| `STRIPE_BILLING_TEST_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_billing_qa node scripts/qa-stripe-billing-browser.mjs` | 0 |
| `LEAD_WEBHOOK_POOL_TEST_DATABASE_URL='postgresql://billing_qa@127.0.0.1:55439/legalhub_webhook_qa?connection_limit=1&pool_timeout=5' DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect STRIPE_BILLING_ENABLED=false node --test tests/lead-webhook-pool-timeout.test.mjs` | 0; 6 PASS |
| `RUN_DB_TESTS=1 DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/staff_routing_qa STRIPE_BILLING_ENABLED=false node --test tests/staff-routing-v2-db.test.mjs` | 0; 4 PASS |
| `META_LEAD_ADS_SYNTHETIC_DB_TEST=1 DATABASE_URL='postgresql://billing_qa@127.0.0.1:55439/meta_lead_ads_qa?schema=public' STRIPE_BILLING_ENABLED=false node tests/meta-lead-ads-db.mjs` | 0 |
| `DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect STRIPE_BILLING_ENABLED=false NEXT_TELEMETRY_DISABLED=1 node --test tests/*.test.mjs tests/security/*.test.mjs tests/local-maintenance/*.test.cjs` | 1; 268 PASS / 1 baseline FAIL / 14 SKIP |
| `NOTIFICATIONS_TEST_DATABASE_URL=postgresql://billing_qa@127.0.0.1:55439/legalhub_notifications_qa DATABASE_URL=postgresql://synthetic@127.0.0.1:1/never_connect STRIPE_BILLING_ENABLED=false node --test tests/notifications-db.test.mjs` | 1; same baseline pagination failure |
| Python `yaml.safe_load` + exact double-quoted health-command assertion | 0; Docker/container status separately requires Actions |
| `git diff --check` | 0 |

Earlier development failures were resolved before these results: fixture IDs originally collided across parallel processes; the fixture now namespaces all provider IDs. The compatibility probe needed a `regclass::text` cast. The Meta standalone test retains fixed binding IDs, so its second invocation initially collided with its prior fixture; only its named disposable database was recreated/migrated before the passing run. The SDK connection-reset test now accepts its documented transparent single retry and verifies object/key uniqueness. No baseline application behavior was changed to silence those setup/test failures.

## Cleanup and re-review handoff

Tests delete only their collected synthetic tenant IDs in FK-safe order, preserving operation/event retention rules outside QA. Named disposable databases were recreated for fresh schema/compatibility proofs; these resets are test setup, not destructive migrations. Fixture servers, browser/app processes and test Prisma connections close in finally/after hooks. Runtime logs remain in ignored `.qa/` or `/tmp/`; committed JSON/screenshots contain synthetic data only.

Actual exact-HEAD GitHub Actions run and all required step conclusions are recorded in the PR #20 follow-up comment after push; skipped steps are never PASS. The updated branch remains Draft and unmerged. Main Coordinator can pass the pinned HEAD, this report and the F1–F5 table to Engineering Manager for independent Security Re-review. Actual hosted Test Mode E2E follows the [secure plan](../../stripe-billing-mvp.md), not this synthetic acceptance run.

PRODUCTION CHANGED: NO. REAL STRIPE PAYMENTS: NO. No FakturaXL/KSeF changes, other development-worktree edits, Live keys, merge or deployment.
