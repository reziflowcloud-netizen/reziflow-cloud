# Meta Lead Ads: private internal QA pilot

This feature is **disabled by default**. It adds a separate Lead Ads app and webhook; the existing RAM Messenger/Instagram Direct paths and Google Sheets ingestion remain independent. No Meta app, Page subscription, CRM organization, token, scheduler, or production database change is performed by this PR.

## Boundaries and data flow

1. The dedicated callback is `/api/webhooks/meta/lead-ads` (no organization slug). It accepts only `X-Hub-Signature-256` signed with `META_LEAD_ADS_APP_SECRET`; the secret and App ID must differ from configured legacy Meta credentials.
2. The signed Page entry ID and Form ID must match one enabled `MetaLeadAdsBinding` for that App. The binding has a single organization owner enforced by a unique index. A contradictory `value.page_id` is rejected.
3. Pilot mode checks the exact test Lead ID against an allowlist **before** calling Graph or storing contact fields. A denied or unbound event creates no delivery or Lead. Global reception and each binding default OFF. Binding activation requires a server-side allowlisted organization ID.
4. The webhook writes a durable `MetaLeadAdsDelivery` receipt, then makes at most two immediate attempts. The separately authenticated `/api/internal/meta-lead-ads` POST worker retries due receipts after 429, 5xx or transport failure with bounded backoff, an attempt limit and a lease for interrupted workers. A scheduler for this endpoint must be approved and configured before an operational pilot. Without it, failed receipts remain visible as pending but will not retry automatically.
5. Graph uses a Page token from server environment, sent in `Authorization`, with `appsecret_proof`. Tokens, app secret and contact fields are absent from receipt rows, webhook responses and error codes. The Graph lead ID and Form ID are rechecked against the receipt and binding.
6. `inboundLeadOnce` serializes per tenant and deduplicates using the App/Lead ID. Staff Routing and assignment notification run inside creation transaction. Replay and interrupted delivery do not advance the routing cursor, recreate a Lead or repeat assignment push. Sources are `facebook_lead_ads`, `instagram_lead_ads` and `meta_lead_ads_unknown` according to Graph `platform`.
7. Shadow mode records only a keyed HMAC event fingerprint and delivery count. It does not call Graph, read contact fields, create Leads or notify users. Changing a binding from shadow to pilot/live does not convert old shadow receipts into Leads. No RAM shadow binding or allowlist is created here.

`MetaLeadAdsBinding` and `MetaLeadAdsDelivery` are additive tables. Legacy `LeadChannelRoute.employeeId`, Meta messaging tables, Lead and Organization columns are unchanged. OLD APP + NEW DB is schema compatible; migration still needs a separate production backup/preflight and explicit approval.

## Private QA organization and credentials

Create **LegalHub Internal QA** only in a separately approved environment after explicit owner authorization. Never use public TestRezidents for this pilot. Record its immutable organization ID privately; the slug is not used for routing. Assign a synthetic Owner/Admin and test Employees with explicit User↔Employee links, and configure channels in Staff Routing. Do not put actual Lead IDs, Page tokens or App secrets in Git, the Prisma JSON settings or a browser field.

Server-only configuration, all initially absent/OFF:

| Variable | Purpose |
| --- | --- |
| `META_LEAD_ADS_APP_ID`, `META_LEAD_ADS_APP_SECRET`, `META_LEAD_ADS_VERIFY_TOKEN` | Dedicated Lead Ads app and callback verification. Values must differ from the legacy Messenger/Instagram app. |
| `META_LEAD_ADS_PAGE_TOKEN_<PAGE_ID>` | Page-scoped retrieval token for each permitted Page. No token is accepted through CRM UI. |
| `META_LEAD_ADS_RECEIPT_HMAC_KEY` | Separate stable server-only key for receipt deduplication and shadow identifiers. Rotate only with a reviewed dedupe migration. |
| `META_LEAD_ADS_PILOT_ORGANIZATION_ID` | Exact private QA organization ID allowed to enable pilot mode. |
| `META_LEAD_ADS_ENABLED=true` | Separate global webhook switch. |
| `META_LEAD_ADS_ACTIVATED_AT` | UTC ISO timestamp set when enabling or re-enabling the global switch. Older pending receipts are blocked by the worker. |
| `META_LEAD_ADS_WORKER_SECRET`, `META_LEAD_ADS_WORKER_ENABLED=true` | Independent retry endpoint authorization and switch. Schedule its POST separately; never expose the secret in the browser. |
| `META_LEAD_ADS_GRAPH_VERSION` | Optional pinned `vN.N` Graph API version; defaults to `v23.0` and must be reviewed before a real pilot. |
| `META_LEAD_ADS_SHADOW_ORGANIZATION_IDS`, `META_LEAD_ADS_LIVE_ORGANIZATION_IDS` | Separate comma-delimited allowlists for future, independently approved shadow/live tenants. Leave unset for private QA. |

Admin/Owner opens Settings → Integrations → Separate Meta Lead Ads. Create an OFF Page/Form binding, record only approved test Lead IDs, then enable Pilot. Diagnostics show token configured state and receipt counts, never token values or contact fields. Disabling and re-enabling resets the binding activation time, so stale pending deliveries cannot be processed later.

## Owner's first external test: Page, Form, Testing Tool

These steps require a separate authorization for Meta configuration. No paid RAM campaign is needed.

1. Create a **new Meta developer app** dedicated to Lead Ads under an owner-controlled business. Keep RAM's existing messaging app and subscriptions untouched. Confirm App ID and App Secret privately.
2. On the owner's own Facebook Page, accept applicable lead terms and create/publish one Instant Form with synthetic answers and a privacy policy. Confirm Page and Form IDs in Meta's interface.
3. In the new app, configure a Page `leadgen` webhook with the dedicated callback and verify token. Install/subscribe that app on the owner's Page. The [Meta sample workflow](https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md) documents app subscription, Page installation, test leads and single-lead retrieval.
4. Obtain a Page token with access to that Page and leads; store it only as the server secret named for the Page ID. Check token permissions and Page Lead Access in Meta's UI. The app does not perform OAuth onboarding, Page discovery or subscription changes.
5. With the private QA organization's ID in the server allowlist, create its Page/Form binding in CRM, add the exact test Lead ID and enable Pilot. Keep global/worker switches OFF until migration, scheduler, security review and rollout approvals have passed.
6. Open the [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/) while signed in with a Page/App role permitted to test, choose the owner Page and published Form, create a synthetic test submission, note its test Lead ID privately and add it to the pilot allowlist. Then enable the approved switches and repeat the controlled test. Check Meta Track Status and only aggregate CRM diagnostics. Meta's [sample](https://github.com/fbsamples/lead-ads-webhook-sample) illustrates the signed Page/Form/Lead IDs and Page subscription flow.

The Testing Tool and retrieval may be unavailable in Development Mode depending on app roles, Page Lead Access, token scopes and current Meta policy. Do **not** assume a test will work before verifying `leads_retrieval` and the app's access level in the Meta dashboard. Only a role-holder's own test submission should be attempted in Development Mode. Do not ingest real leads or use a RAM Page at this stage.

## Permissions and App Review preparation

For this manual Page-token implementation, the functional core is `leads_retrieval` for single-lead retrieval and `pages_manage_metadata` for Page webhook subscription. Meta may require `pages_read_engagement`, `pages_show_list`, `pages_manage_ads`, `ads_read` or other dependencies to issue a usable Page token or grant Lead Access; verify the **actual** scopes and access levels in the current Meta app dashboard before requesting any. The CRM itself does not call Ads Management APIs, list Pages or change subscriptions. Do not request Messenger/Instagram Direct permissions for this app. Meta's current [Lead Ads guide](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/) and [App Review portal](https://developers.facebook.com/docs/app-review/) are the authoritative places for final permission requirements.

For App Review, prepare: business verification if Meta requires it; valid privacy policy and data deletion instructions; an owner-controlled Page/Form; a screencast showing consent, setup, test lead, tenant binding, receipt, CRM creation and deletion/disable path; a test account with the required app/Page roles; a precise explanation of each requested permission and how contact data is used. Advanced Access/App Review requirements for non-role users or third-party Pages must be checked before leaving the private pilot. No review submission is made by this PR.

## Separate RAM shadow pilot gate

Requires explicit RAM owner consent, a new Page/Form binding and server-side `META_LEAD_ADS_SHADOW_ORGANIZATION_IDS` allowlist; permission and token ownership review; a retention window for hashed receipt metrics; independent security review; and proof that no Graph request, Lead, notification or contact-field storage occurs. The shadow switch defaults OFF. Moving RAM from shadow to live needs a separate approval, privacy review, App Review status check and controlled rollout.

## Offline QA and rollout boundaries

`node --test tests/meta-lead-ads.test.mjs` covers HMAC, IDs, pilot blocking, source separation and additive SQL checks. `pwsh -NoProfile -File tests/meta-lead-ads-db.ps1` creates a new disposable localhost PostgreSQL 18 cluster, deploys the full migration chain there, checks drift and executes tenant/uniqueness/concurrency assertions. It does not use production credentials or contact data.

Before any later production pilot: independently review this PR, verify Meta permissions and Graph version, back up Production, test the additive migration and OLD APP + NEW DB, approve and apply migration separately, configure the retry scheduler, then enable only the private QA org. No migration, Meta app setup, subscription, scheduler or deployment is authorized by this document.
