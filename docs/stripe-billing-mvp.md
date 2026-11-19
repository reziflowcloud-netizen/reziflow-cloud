# Stripe Billing MVP — Test Mode only

Baseline: `41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04`, fetched from `origin/main` on 2026-11-19. Branch: `feature/stripe-billing-mvp`; separate checkout: `/workspace/stripe-billing-mvp`. The original checkout was left clean. No deployment, production database access, live Stripe requests, real payments, merges, Meta account changes, FakturaXL API or KSeF API actions were performed.

The implementation is reviewable with the flag OFF. **Actual Stripe-hosted Test Checkout, actual Stripe webhook delivery and Test Clock advancement remain SKIP:** this environment has no test credentials or webhook endpoint secret, and `api.stripe.com` is outside its configured network allowlist. The Windows handoff was unavailable locally. Its existence, test prices and portal were subsequently corroborated by the final messages in the chat “Work Stripe Registration & Verification”; those are **REPORTED**, not a fresh account/API verification. Do not paste credentials into chat, source, PRs or test reports.

## Configuration and boundaries

Use the server-only variables in `.env.example` in a private **development** environment. No remote environment variables were read or changed. `STRIPE_BILLING_ENABLED` defaults OFF. Missing/invalid configuration, a live key, `VERCEL_ENV=production`, a production LegalHub return URL, duplicate Price IDs or missing explicit grace days disable the integration. This branch is also excluded from Vercel Git deployments in `vercel.json`.

| Variable | Meaning |
| --- | --- |
| `STRIPE_SECRET_KEY` | Test secret/restricted key only (`sk_test_…` / `rk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Development endpoint signing secret |
| `STRIPE_STARTER_PRICE_ID` | Allowlisted active monthly PLN Price for 24900 grosz |
| `STRIPE_PRO_PRICE_ID` | Allowlisted active monthly PLN Price for 49900 grosz |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Test portal configuration; payment method update + end-of-period cancellation |
| `STRIPE_BILLING_APP_URL` | Fixed loopback/development HTTPS origin, no path/query/credentials |
| `STRIPE_BILLING_GRACE_DAYS` | **7**, approved by the owner in this chat on 2026-11-19; explicitly required |

The official SDK is pinned to `stripe@23.2.0` and API `2026-11-18.endive`, the version documented by that SDK's generated API definitions and `cjs/apiVersion.js`. In this API Checkout uses `allowed_payment_method_types`, subscription periods live on subscription items, and invoice subscription references are under `parent.subscription_details`. Align the development webhook endpoint to this API version. This implementation makes no live-mode activation path available.

## Request and payment flow

1. An authenticated Owner/Admin sends only `{ "plan": "starter" }` or `{ "plan": "pro" }` to `POST /api/billing/checkout`. Extra identifiers and fields are rejected. Current database role, restricted access, tenant membership and session version are rechecked, including after acquiring the organization lock. Origin must match the configured development origin.
2. Only a Free organization explicitly opting in, or an already managed `stripe_test` organization, can use Checkout. Existing manual Starter/Pro, Agency, Manual, trial/status overrides and organizations with custom limits cannot be silently migrated. Customer metadata is generated on the server; no contact information is copied into Stripe automatically.
3. Customer and Checkout idempotency keys are committed before external requests. The Customer mapping commits before any Checkout is created. An organization row lock serializes competing attempts. Existing nonterminal subscriptions block another Checkout. Repeated selection resumes the existing open session; selecting a different card does not create a second session. Expiration/cancellation is verified with Stripe before rotating a committed key. A replacement starts on Free and gains no grace from its canceled predecessor.
4. Checkout return URLs are informational. Only a signature-verified webhook can update payment state. First payment and paid renewals require a current Stripe subscription, allowlisted price, expected quantity/currency/amount/period, matching Customer/subscription and a settled current invoice. Unpaid, incomplete and unrecognized states cannot grant a new paid tier.
5. `POST /api/webhooks/stripe` is public through middleware and validates the Stripe signature against the raw body. Relevant events lock the mapped organization, re-read current Stripe state **inside** that lock and commit the projection with the event ledger. Payload timestamps and cached payload statuses do not drive entitlement. A late event for an old subscription cannot replace the subscription associated with the current server-created Checkout. Failed processing leaves no completed ledger row and returns non-2xx for retry.
6. The API returns stable error codes, never provider errors or request payloads. The UI accepts HTTPS redirects only to `checkout.stripe.com` / `billing.stripe.com`. No card data, payment methods, bank data, raw webhook payloads or keys are stored in CRM or its new tables.

Supported events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`. Unknown unrelated events are ignored; live/connected-account events are rejected. An unmapped managed event racing persistence is retried.

## Entitlements, grace and cancellation

| Verified state | CRM behavior |
| --- | --- |
| First payment incomplete/failed | Free; no paid grace |
| Active + settled invoice covering current period | Starter/Pro and current paid period |
| Failed renewal / unpaid active period | At most 7 days from the failed period's start; repeated events never extend grace |
| Grace expired | Free limits for creation of new records; existing data remains available |
| `cancel_at_period_end=true` while active | Retain paid access through the paid period; show cancellation notice |
| Cancellation undone before expiry | Retain paid access and show renewal date again |
| Canceled immediately or at period end | Free limits; never delete CRM records |
| `unpaid`, `paused`, `incomplete_expired` | Free limits; payment-status notice |
| Paid recovery / new paid subscription | Restore verified tier and clear grace |
| Missing renewal webhook | Existing paid period plus the agreed grace bounds access; operator must reconcile/resend missing events |
| Manual/Agency/trial override | Preserve the existing administrative workflow |

The existing organization `status`, trial dates and settings are not rewritten by webhooks. Individual `billingLimits` continue to override the effective plan, including after a subscription state changes. No new broad write-denial or data-removal path was added. Turning the flag OFF restores the legacy snapshot/limits behavior and contact fallback; it also stops webhook processing, so disabling an already enabled pilot requires an operational handoff and event reconciliation before re-enabling.

Notifications in this MVP are persistent, localized **Billing-page** notices for overdue payment, grace, cancellation and pending confirmation. No new email/push/Notification Center pipeline is claimed. Existing notification code was not changed.

### Plan changes and Portal

Self-service Starter ↔ Pro changes, proration, coupons, trials and immediate cancellation are not offered. A client with a nonterminal subscription uses the Portal for payment-method updates and cancellation at period end; plan changes go through the administrator. The server rejects a portal configuration enabling subscription updates or immediate cancellation. After confirmed terminal cancellation, a new Checkout may purchase a different tier. No existing manual paying customer is automatically transferred.

Before a real Test Mode pilot, verify the handoff's Portal configuration against these guardrails. Its invoice download settings also require the accounting review described below. Do not modify the live portal or prices as part of this work.

## Database and operations

The additive migration `20261119170000_stripe_billing_test_mvp` creates only `StripeBillingState` and `StripeBillingEvent`, their indexes and organization FKs. It does not add/change existing columns or update existing rows. The existing provider/customer/subscription/price/status/period/grace fields are reused. The provider value `stripe_test` deliberately distinguishes this pilot from manually administered tenants.

Existing Local Maintenance Runner `Test-MigrationSql` accepts all six SQL statements. It classifies blocking indexes as MEDIUM risk; all four indexes belong to new empty tables. Migration deployment ran only on disposable loopback PostgreSQL. OLD APP + NEW DB used the actual baseline-generated Prisma client and baseline `billing.ts`; hashes of all 50 existing application tables were unchanged before/after the migration, and old-client reads/writes passed.

The new audit/state rows use `ON DELETE RESTRICT`. Hard deletion of a Stripe-managed organization therefore requires a separate retention/cleanup decision. Existing tenants without billing rows retain their existing deletion behavior. Do not delete the ledger as an idempotency retry mechanism.

For transient failures, retry the same Checkout request; stable keys recover external success after a database rollback. For webhook outages, inspect only sanitized status codes, confirm the endpoint/key/API version, and resend the original event from **Test Mode**. Unknown customer or subscription mismatches require manual investigation rather than rebinding client-supplied IDs. Preserve ledger history; no recurring reconciliation job is included.

### Test Clocks

The installed official SDK exposes `testHelpers.testClocks.create/advance/retrieve` and `customers.create({ test_clock })`. Test Clocks are suitable for deterministic subscription renewals and dunning. A clock must be attached at Customer creation; existing Checkout-created customers cannot be retrofitted. A dedicated disposable fixture must provision a clock-bound synthetic Customer, its server-side metadata/mapping and the corresponding checkout state before use. Advance one billing period, wait for the clock to be `ready`, then assert the verified invoice/webhook result. Actual clock creation/advancement was **SKIP** without test credentials. The local suite models renewal/failure periods but does not claim Stripe Test Clock execution.

## Accounting and activation gates

Stripe automates payment collection/subscriptions. FakturaXL remains the manually operated accounting system. The owner verifies each accounting invoice before sending it to KSeF. No automatic FakturaXL invoice creation or KSeF submission is implemented. UI prices carry no VAT-inclusion promise.

**Live activation remains prohibited.** VAT exemption basis, buyer-facing Stripe invoices/PDFs/email/Portal downloads and the single accounting invoice policy still need accountant/owner confirmation. Also pending: actual hosted Test Checkout/payment failure, actual signed webhook delivery, Test Clock renewal, safe Portal configuration verification and independent Engineering Manager Security Review. The independent reviewer should inspect tenant authorization, committed idempotency keys, transaction rollback/replay, out-of-order subscription adoption, paid-invoice proof, custom/manual compatibility, grace and the additive SQL. No merge or deployment is authorized.

See [QA report](qa/stripe-billing/report.md) for actual PASS / REPORTED / SKIP outcomes and command exit codes. CI in `.github/workflows/stripe-billing.yml` uses synthetic credentials, loopback PostgreSQL and a loopback Stripe SDK fixture only; CI results are pending until the Draft PR runs.
