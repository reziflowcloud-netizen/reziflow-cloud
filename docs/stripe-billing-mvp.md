# Stripe Billing MVP — Test Mode only

Production baseline: `41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04`. R7/R8 intake: `4c06aacaa3a695d977cb46f06bf8610f94a2d88a`. All corrections stay in `feature/stripe-billing-mvp`, existing Draft PR #20. The R7/R8 correction and actual Stripe Test Mode acceptance ran locally on Windows against an isolated synthetic database. No production access, deployment, merge, real Stripe payment, real organization edit, or Meta/RAM/SL change is authorized.

## Configuration

The server-only variables in `.env.example` remain required. The feature defaults **OFF**; invalid/missing configuration, Live keys, `VERCEL_ENV=production`, and a production LegalHub return origin disable it. The branch remains excluded from Vercel Git deployments. Use only private development settings; never paste credentials in chat, GitHub, reports or Work artifacts.

| Variable | Requirement |
| --- | --- |
| `STRIPE_SECRET_KEY` | Test secret/restricted key only |
| `STRIPE_WEBHOOK_SECRET` | Development endpoint signing secret |
| `STRIPE_STARTER_PRICE_ID` | Server allowlisted active licensed monthly PLN Price, 24900 grosz |
| `STRIPE_PRO_PRICE_ID` | Server allowlisted active licensed monthly PLN Price, 49900 grosz |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Test Portal; payment method changes and period-end cancellation only |
| `STRIPE_BILLING_APP_URL` | Fixed loopback/development HTTPS origin, no query/path/credentials |
| `STRIPE_BILLING_GRACE_DAYS` | Explicit **7**, owner approved on 2026-11-19 |

Official SDK: `stripe@23.2.0`, API `2026-11-18.endive`. Checkout uses `allowed_payment_method_types`; subscription periods are on items; invoice subscription references are under `parent.subscription_details`; settlement sources use InvoicePayment → PaymentIntent → Charge. The local CLI actually delivered `2026-10-28.endive` events despite requesting latest. Raw signatures remained mandatory; event references selected current resources retrieved through the pinned November API. Actual Test acceptance passed this observed combination, not every possible API version. Account defaults were not changed.

## F1/F2: durable operations without network-held database locks

`StripeBillingOperation` stores tenant, intended action, immutable request JSON, fingerprint, idempotency key, first-attempt/POST timestamps, conservative retention deadline, phase, sanitized provider IDs/result and error code. The actor snapshot contains only user ID, tenant and session version; the credential fingerprint is a hash, never the key. Requests retain original plan/Price/return URLs across later button selections or configuration changes.

`StripeBillingCoordinator` stores one organization work slot, generation, token and a 60-second lease. It also stores the last strictly verified paid-through date and an explicit financial-review hold. A composite FK prevents binding an operation to another tenant's coordinator.

1. A **short database-only** transaction authorizes the current Owner/Admin, checks tenant eligibility and claims a durable operation/lease. Organization locking exists only inside these short transactions. Lock timeout is 750ms, statement timeout 2500ms, interactive transaction timeout 5s and pool acquisition wait 1s; contention becomes a controlled `BILLING_BUSY`/503 with Retry-After.
2. All Stripe reads and writes happen **outside** transactions, with no retained connection or row lock. Immediately before a provider POST, another short transaction records `postStartedAt` and rechecks lease/fence, actor, feature flag and administrative snapshot. The POST follows after commit. SDK request timeout is 8s with configured network retries 0; the official SDK may still retry one connection-reset error, always using the same immutable key.
3. A short final transaction verifies operation ID/generation/token/unexpired lease, current actor and organization fingerprint. An expired/stale worker cannot commit or release a newer lease. Manual/Agency/trial/custom billingLimits changes during I/O win; unrelated CRM settings are excluded from the billing fingerprint; returned provider IDs remain journaled for reconciliation without overwriting those settings. Flag disablement preserves the remote identifier and leaves recovery pending.
4. Reconciliation updates projection and event ledger atomically. Concurrent work returns retryable busy rather than retaining connections while waiting for Stripe. Retried events fetch current Stripe state after a fresh reservation; timestamps/cached event status do not drive entitlements. Old-subscription events cannot replace the subscription linked to the server-created Checkout.

The journal phases distinguish reserved/in-flight/POST-started, uncertain, completed, safe read/precondition failure and manual review. No cleanup job silently deletes or rotates uncertain operations. Retain operations and event receipts for replay safety; hard organization deletion remains restricted by FKs. All included QA cleanup targets synthetic disposable tenants/databases only.

### Crash, timeout and retention recovery

- Customer mapping commits before a Checkout is possible. Customer-success/mapping-failure retries use the same Customer request/key. If no provider ID is known after the conservative **23-hour window from reservation**, automatic POST replay stops for manual reconciliation; a UUID is not an indefinite idempotency guarantee.
- Checkout recovery uses the original operation metadata to locate the existing Customer-scoped session. Exactly one match may be retrieved without another POST. Unknown/paginated/ambiguous outcomes require manual review; a changed Price or return URL never mutates an existing request.
- A completed Checkout recovered after a lost commit is mapped, but returns confirmation pending. It never grants access itself; only a subsequent verified webhook can grant the tier. Its matching active subscription is identified by the original operation metadata, rather than blindly treating every active subscription as permission to create or abandon another session.
- Within the retained window, unresolved mutation retries use the same key/parameters. In-flight idempotency conflicts are retryable. Executed/cached provider 500 failures and parameter-integrity errors require manual reconciliation, without new keys or objects.
- An expired mutating operation blocks unrelated tenant billing work until the original request is resumed or an operator reconciles it. It does **not** block legacy ingestion/routing or other CRM work. There is no background recovery scheduler in this MVP. After crashes or missed delivery, the operator must resume the original request and resend the original Test Mode event as necessary; if the original actor was revoked or uncertainty cannot be resolved, stop for manual review.
- A recovered original Price remains verifiable from the fingerprint-checked server Checkout intent even if the current Price configuration changed. A credential change during pending recovery is conservative: manual reconciliation is required rather than silently rebinding accounts.

## Authorization and compatibility

Only current database Owner/Admin with the matching tenant/session and without restricted access may manage billing. Clients send only `plan`; arbitrary tenant/Customer/Price fields and hostile Origins are rejected. Stripe Customer/subscription metadata and the server-created Checkout relationship are verified. Raw webhook signatures use the official SDK; Live/connected-account events are rejected. Browser redirects are restricted to hosted Stripe domains and never confirm payment.

Existing manually administered Starter/Pro, Manual, Agency, trial and custom-limit organizations are not automatically migrated. Webhooks do not rewrite organization status, trial dates or settings. Custom billing limits continue to override the effective plan. Flag OFF preserves existing billing snapshot/creation-limit behavior and the localized administrator-contact fallback, without querying the new operation/coordinator tables. It also stops webhook processing; reconcile events and operations before re-enabling a pilot.

## F4: access boundaries

| State | Effective access |
| --- | --- |
| Initial incomplete/failed payment | Free, no paid grace |
| Verified standard paid active period | Verified Starter/Pro |
| Ordinary failed renewal | At most 7 days from failed period start; repeats never extend it |
| Known period-end cancellation | End at the last actually paid boundary, with **no renewal grace**, even if final cancellation delivery is missing |
| Absolute `cancel_at` schedule | Store/display its date separately; no grace beyond that boundary, no shortening of an already verified paid period. Later schedules permit intervening renewals and only ordinary bounded grace |
| Verified cancellation reversal | Resume normal bounded renewal/grace policy |
| Canceled immediately / unpaid / paused / incomplete expired | Free creation limits |
| Missing/invalid period bound | Free; never indefinitely paid |
| Missing ordinary renewal delivery | Current period plus bounded renewal grace; operator reconciliation required |
| Unsupported settlement/adjustment | Manual review; no new tier or paid-period extension; previously strictly verified access is bounded by its existing paid-through date |

Only creation limits change; no automatic deletion of clients, Leads, cases, documents or users occurs. Cancellation during an unpaid renewal uses the **last verified paid-through** boundary, not the end of the new unpaid Stripe item period.

R8 normalizes both `cancel_at` and `cancel_at_period_end` into the cancellation notice. Nullable coordinator fields `scheduledCancelAt` and `cancelAtPaidThrough` retain the actual date and raw period-end instruction respectively. A verified reversal clears the date/instruction and restores only the original bounded renewal window. An earlier schedule alone cannot revoke proven paid time; a later schedule alone cannot grant unverified paid months. New Checkout clears prior paid proof and cancellation state after the previous subscription has become terminal.

## F5: explicit financial MVP policy

Automatic grant/renewal supports only one standard Starter/Pro card settlement: a matching Test invoice/subscription/customer, one full-price quantity-one line covering the exact item period, PLN, expected subtotal/total/amount_due/amount_paid, zero amount remaining, zero balances/discounts/credits/credit notes/off-Stripe payment, and the ordinary automatic subscription-create/cycle invoice. There must be exactly one paid InvoicePayment for that invoice with the expected amounts, one succeeded PaymentIntent with the expected amount received/customer/currency, and its matching paid/captured card Charge with the full capture, no refund and no dispute.

A normal still-open, wholly unpaid invoice is a failed/pending payment eligible for ordinary renewal grace only when a previous paid tier exists. Zero totals, zero `amount_paid` marked paid, discounts, customer balance credits, partial settlement, out-of-band payments, alternate/multiple settlement sources, taxes/lines outside this narrow policy, and incomplete financial proof are **UNSUPPORTED_SETTLEMENT / MANUAL_REVIEW_REQUIRED**, not assertions that legitimate credits are invalid. The public billing status is `manual_review_required`; localized UI tells the owner to contact the administrator and not pay again.

R7 treats a normal draft invoice, including provisional `ending_balance=null`, as pending without a financial hold. It grants no payment proof. Explicit draft adjustments still require review. Projection retains the last strictly verified paid-through date and finite grace until finalization/full settlement. Paid-through never regresses on an older paid resource read. Existing financial holds, including false holds created by an older build, are not silently cleared; they still require controlled reconciliation.

Refund, credit-note and dispute events latch a durable review hold for the subscription. Neither late paid events nor a later standard invoice automatically clear it or extend access. Previously verified paid-through access remains bounded; no new Checkout is offered while the hold exists. There is no automatic refund, re-charge, subscription replacement, cancellation or CRM data deletion. Financial hold resolution requires an explicit owner/accounting decision and controlled reconciliation; no generic self-service “clear review” endpoint is included.

Relevant events include subscription/Checkout/invoice lifecycle events, `invoice_payment.paid`, `charge.refunded`, `refund.created/updated/failed`, `credit_note.created/updated/voided`, and dispute created/updated/closed/funds events. Verified invoice/intent/charge identifiers are indexed in the tenant operation journal. Adjustment events resolve ownership through those verified relationships **before any Stripe call**. An adjustment arriving before its relationship is known receives retryable `FINANCIAL_MAPPING_PENDING`, never guessed ownership or silent grant. After acquiring a lease, current subscription/invoice/payment state is fetched and verified again. No financial/card/customer payload is retained in the journal.

## Database and rollout constraints

The original additive migration creates state/events. New migration `20261119190000_stripe_billing_operations` creates only the operation/coordinator tables, seven indexes on the new journal and tenant/composite FKs. Existing table columns/data are untouched. Both migrations pass the existing Local Maintenance Runner SQL audit; blocking-index MEDIUM classification concerns only new empty tables. Migration deployment is limited to disposable PostgreSQL in this work.

R7/R8 add `20261120120000_stripe_billing_scheduled_cancel` and `20261120121000_stripe_billing_cancel_boundary`: one nullable coordinator column each, with no default, backfill, index or destructive DDL. The existing SQL auditor accepts both. The preserved local Test E2E database retained identical values for every pre-existing column across 54 tables after these migrations.

OLD APP + NEW DB uses the actual baseline client/billing code and verifies unchanged hashes of all 50 existing application tables. NEW APP + OLD DB with flag OFF verifies a real baseline DB without the coordinator table before running all new migrations. Activation must follow migration and independent re-review; enabled use against an old DB is intentionally unsupported.

Self-service plan changes/proration, coupons/trials and immediate Portal cancellation remain disabled. Portal configuration is rechecked outside a transaction and finalized under a short fence. FakturaXL accounting invoices and KSeF submission remain manual. No VAT-inclusion promise is shown. Accountant/owner agreement on VAT exemption and Stripe invoice/PDF/email/Portal document policy remains a Live gate.

## Actual local Test Mode acceptance — 2026-11-20

The existing Poland account, protected external-to-Git Test configuration and owned loopback PostgreSQL cluster were revalidated. Two new synthetic organizations used the ordinary login/Checkout flow. Actual hosted Starter/Pro Checkout, signed CLI delivery, Test Clock renewal, draft/open/paid, failed renewal/recovery, Test refund review, Portal `cancel_at` cancellation/reversal, expiry without grace and new Checkout after cancellation passed. The pinned Test API accepted a Test Clock `customer` parameter on each original app-created synthetic Customer; customer mapping and operation journals were preserved without rewriting provider IDs.

Only original signed bytes were forwarded/replayed, within signature tolerance. Concurrent busy responses required explicit original-event retries; automatic upstream retry scheduling and indefinite delayed delivery are not claimed. Local E2E processes and the owned cluster were stopped afterward, preserving prior/current data and evidence. Feature remains OFF outside the isolated child process.

See [R7/R8 local and actual Test evidence](qa/stripe-billing/r7r8-report.md), [F1–F5 QA evidence](qa/stripe-billing/report.md) and [R6/Windows evidence](qa/stripe-billing/r6-report.md). The exact new HEAD and actual CI run/step results are published in PR #20 after push. Keep Draft; no merge or deployment. Historical Windows root cause remains UNKNOWN and a separate production gate. Next: independent Engineering Manager Security Re-review of the new HEAD.
