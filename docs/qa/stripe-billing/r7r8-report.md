# PR #20 — R7 renewal / R8 scheduled cancellation

Intake: `4c06aacaa3a695d977cb46f06bf8610f94a2d88a`, existing `feature/stripe-billing-mvp`. This task uses **R7 = draft renewal** and **R8 = Portal cancel_at**; earlier private E2E numbering is historical and its evidence was preserved. All actual provider operations below used the existing Poland account in Stripe Test Mode and synthetic organizations only. No Live, Production, real payments, merge or deployment.

## Reproduction and correction

Before correction the two automatic DB/HTTP regressions failed on original source: a normal draft with `ending_balance=null` latched a financial hold; Portal `cancel_at` with `cancel_at_period_end=false` did not mark cancellation. The original SHA was additionally extracted into a separate private immutable snapshot and the same two selected tests reconfirmed **0 PASS / 2 FAIL, exit 1**. Private baseline evidence is retained independently of the corrected run.

R7 now returns pending for an ordinary draft without granting payment proof. Known discounts/credits/nonzero balances/off-Stripe payment/tax/unsupported collection still require review. Finalized settlement retains the unchanged strict full-price InvoicePayment → PaymentIntent → captured Charge checks. The projection retains verified paid-through, grants only finite existing renewal grace and advances only on proved payment. Older reads/delayed events cannot regress that boundary. Durable financial holds are not automatically cleared.

R8 records nullable `scheduledCancelAt` and `cancelAtPaidThrough` on the coordinator. The UI separately displays the verified paid period and scheduled date in RU/UA/PL. Absolute dates and raw period-end instructions remain distinct: no extra grace after a known ending boundary; future schedules allow intervening renewals without granting future paid months. A schedule alone never shortens already proved paid time. Verified reversal removes its cancellation cap while retaining the original grace ceiling. New Checkout after terminal cancellation clears the old proof/schedule, so an initial draft cannot inherit paid entitlement.

Two additive migrations each add one nullable coordinator column, with no default, backfill or index. Existing production maintenance/routing/workflow code is untouched. Compatibility extraction now explicitly reads tar from stdin on Windows. Browser QA uses the existing Linux runner arguments only on Linux; Windows uses normal Chromium defaults.

## Local verification

Windows, Node 24.14.0/npm 11.9.0, PostgreSQL 18.6. Each command ran with explicit synthetic loopback configuration and a clean child environment, without loading repository environment files. QA and compatibility databases were newly named within the existing owned isolated cluster; the prior actual E2E database was preserved.

| Command / scope | Actual result |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Exit 0 |
| `npm run test:billing` | Exit 0; **64 PASS / 0 FAIL / 0 SKIP**, including original 57 and seven R7/R8 checks |
| `npx prisma generate`; `npx prisma validate`; `npx tsc --noEmit` | Each exit 0 |
| `pwsh -NoProfile -File tests/stripe-billing-sql-audit.ps1` | Exit 0; existing auditor accepts all four billing migrations |
| `npx prisma migrate deploy` on owned synthetic databases | Exit 0; actual preserved E2E DB has 58 applied migrations; all pre-existing column values across 54 tables unchanged immediately after migration |
| `node scripts/qa-stripe-billing-compat.mjs` | Exit 0; OLD APP + NEW DB and NEW APP + OLD DB flag OFF; 50 existing application tables unchanged |
| `npm run build` with unreachable synthetic DB, no Stripe credentials | Exit 0 |
| `node scripts/qa-stripe-billing-browser.mjs` | Exit 0; 54 RU/UA/PL × Light/Dark/Slate × 390/414/430/768/1024/1440 combinations; scheduled notice/reversal; no overflow or browser exceptions |
| `git diff --check` | Exit 0 |

The billing suite retains F1–F5/R6: strict settlement and adjustments; tenant/actor/Origin isolation; Manual/Agency/trial/custom limits; flag OFF legacy behavior; bounded leases/locks and provider I/O outside transactions; immutable request/recovery bounds; concurrent genuine overrides; actual unchanged legacy Google Sheets fallback round-robin ingestion while reconciliation is in flight. No billing tests were skipped.

Intermediate development failures were resolved before acceptance: one existing F4 reversal assertion exposed a retained cancellation grace cap (plus its parent test); Windows compatibility extraction initially failed opening `tape0` without explicit tar stdin. The final runs above passed. The broad Push/Notifications suites were not rerun in this correction: earlier main-reproduced results remain **268 PASS / 1 Push FAIL / 14 opt-in DB SKIP (exit 1)** and **10 PASS / 2 Notifications FAIL counting child+parent (exit 1)**, as documented in the R6 report. They are not relabeled PASS.

## Actual Stripe Test Mode acceptance

The built runtime's executable source was hashed against the tested checkout (684 non-documentation files). Existing reports, fixtures and four prior synthetic organizations were preserved; two new organizations were added. Real app authentication and app-created Checkout mapping were used, without fabricated JWTs or rewriting Customer/subscription/journal identifiers.

| Scenario | Observed assertion |
| --- | --- |
| Hosted Starter Checkout, 249 PLN/month | Official test card, actual paid session; full settlement, Starter and verified paid-through; one subscription |
| Hosted Pro Checkout, 499 PLN/month | Official test card, actual paid session; full settlement, Pro and verified paid-through; one subscription |
| Starter Test Clock draft → paid renewal | Actual draft `ending_balance=null`: no hold, old paid boundary and finite grace, no new grant. Actual finalized/paid cycle: full settlement extends paid-through |
| Pro failed renewal and recovery | Actual draft, then open/past_due with official failing test method: no hold/no extension. Official successful method plus paying the existing open invoice: full settlement restores active and extends the boundary |
| Genuine unsupported adjustment | Actual Test refund lifecycle against the verified Starter charge, including refund failure, latched REFUND review; no new paid period, Checkout 409. This is not a claim of a successful completed refund. Credit/discount/dispute cases additionally remain DB/HTTP regressions |
| Hosted Portal cancellation | Actual `cancel_at` populated with raw `cancel_at_period_end=false`; coordinator/API/UI preserve the date; policy is Free at paid boundary and the next day, no grace |
| Hosted Portal reversal | Actual clear schedule; held original signed event released then replayed; UI clears notice, paid-through preserved |
| Expiry | After Portal reversal, a Test API helper rescheduled the exact original period end without proration; Test Clock advanced beyond it. Actual deleted event: Stripe and CRM canceled, Free at paid boundary. This reschedule was an API helper, not a second Portal action |
| Hosted resubscription after cancellation | Normal new app Checkout then hosted test payment; old subscription canceled, two historical subscriptions total and **exactly one nonterminal**, full new paid proof, old schedule cleared |
| Duplicate/delayed delivery | **41 unique original events**, all final deliveries HTTP 200; **29 replay attempts**, one receipt per event and unique operation dedupe keys; one nonterminal subscription per fixture |

Local policy assertions evaluate explicit Test Clock boundary instants; the host OS clock was not changed. Test Clock events/actual DB projection are independently checked. Unpaid grace expiry was checked with the policy at its exact boundary, not by claiming the Windows clock advanced.

### API version and delivery limits

Application SDK 23.2.0 uses `2026-11-18.endive`. Actual CLI payloads reported **`2026-10-28.endive`**, despite latest selection. Their actual subscription/invoice/payment/adjustment reference shapes were accepted and current full resources read with the pinned November API. Raw signature verification stayed enabled; an unsigned webhook was rejected. No account or Live default was changed. This proves the observed version pair, not universal payload compatibility.

Concurrent real events sometimes returned retryable `BILLING_BUSY`/503. The local observer retried the **original raw body and original signature** sequentially within tolerance; it never re-signed provider events. Explicitly held/replayed Portal reversal and duplicate completed Checkout also passed. Automatic Stripe retry scheduling and signatures outside tolerance were not tested. Synthetic SDK fixture signatures in the DB regression suite remain separate from these actual provider deliveries.

Secrets stayed in a private ACL-protected configuration outside Git, never in report output. The CLI logger redacted signing/API secrets before disk writes. All owned app/listener/observer/PostgreSQL processes were stopped, ports 3129/3130/55439 closed, DB/evidence preserved; the separate existing PostgreSQL Windows service was untouched. The persisted feature flag stayed OFF; only the isolated child app enabled it.

## CI and handoff

Exact committed SHA, Stripe synthetic CI and Windows/Meta job/step conclusions are published in the PR #20 conversation after the authorized normal push. No CI PASS is implied before those results exist. The historical Windows structure mismatch root cause remains **UNKNOWN**, as documented in R6; current passing CI cannot explain that old failure. It remains a separate production gate, with no weakened maintenance guard or Meta/RAM/SL changes in this task.

Ready for independent Engineering Manager Security Re-review after exact-HEAD CI. Keep Draft and feature OFF. Accounting/document/VAT policy and Live rollout remain outside this local Test acceptance.
