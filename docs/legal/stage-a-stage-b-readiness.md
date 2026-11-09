# LegalHub Stage A and Stage B Factual Review

**Publication proposal superseded for Stage A:** use [Stage A QA approval and one test plan](stage-a-qa-approval.md). The general legal-page rewrite remains an unpublished document draft; the current PR restores its executable routes to main and adds only standalone static QA notices. The factual findings below remain available for Stage B and do not impose the general production-release gate on the limited QA documents.

9 November 2026. This is an approval record for PR #14. No production data, credentials or backup contents were opened, and no production PostgreSQL connection was made. **CONFIRMED** identifies an observed setting, code behaviour or documented requirement with the scope shown. **UNKNOWN** identifies a fact the available safe evidence does not establish. A complete draft is not an executed agreement or permission to publish.

## Decision boundaries

**Stage A** is the owner's App 1160353550276176, Page 1449474971582722 and Form 2046130655900851, synthetic submissions and the existing isolated local CRM/PostgreSQL. It does not process SL or RAM leads or use the production CRM database. A CRM tenant called LegalHub Internal QA is not a second legal entity. A customer DPA with SL, SL's form disclosures and access to non-role customers are not prerequisites merely because the internal QA test exists.

**Stage B** adds a separate organisation, real people and production retention. Its controller/processor agreement, processing instructions, lawful-basis notices, authorised providers/transfers, retention/deletion procedure and Meta customer-access approvals must be completed before that processing starts. These Stage B items are not silently made Stage A conditions.

An internal test can still involve personal administrator/account identifiers or network metadata. Synthetic contact fields do not automatically make every associated activity exempt from GDPR. Applicable platform/processor terms and truthful app notices still matter for Stage A.

## Roles and existing contracts

| Scenario | Finding | Status and limit |
| --- | --- | --- |
| Own internal QA | LegalHub determines its own testing purpose; there is no separate SL controller instructing this test | CONFIRMED scope from the owner's instructions and isolated resource inventory. Own-purpose personal metadata needs an applicable basis; the legal assessment is not proved by code |
| Agency client and lead records | The agency is controller where it determines purposes/essential means; LegalHub is processor when acting on its documented instructions | CONFIRMED functional distinction; the actual customer's legal identity, agreement and instructions remain UNKNOWN until supplied/executed |
| LegalHub's own accounts/security/support | LegalHub is controller where it determines those purposes and essential means | Conditional role distinction, not a blanket assertion that every security action has an approved legitimate-interest assessment |
| Infrastructure providers | Their role depends on the activity and contract; a hosting processor and account-data controller can coexist | Public provider terms confirmed; exact LegalHub contracting entity, incorporation and covered services UNKNOWN |
| Meta | Platform terms govern its own processing; its entire activity cannot be labelled LegalHub subprocessing | No new Meta role or contract acceptance is inferred from OAuth permissions |

The existing Regulamin section 3 refers to Article 28 and the Privacy Policy. It establishes an intended entrustment model, but the reviewed repository and synced-reference filename inventory did not reveal a complete executed customer DPA. The referral alone does not establish all mandatory clauses. Agreements held elsewhere remain UNKNOWN, rather than presumed absent.

| Article 28 element | Existing reviewed terms | This PR's DPA draft |
| --- | --- | --- |
| Parties, scope, duration, purposes, data and people | Broad SaaS description; no completed customer processing schedule found | Sections 1–2 and Schedule 1 |
| Documented instructions and unlawful-instruction notice | Not fully specified in reviewed public terms | Section 3 |
| Confidentiality and Article 32 measures | General privacy/security language; operational evidence incomplete | Sections 4–5 and Schedule 2 |
| Prior subprocessor authorisation and equivalent obligations | No complete customer authorisation process found | Section 9 and Schedule 3 |
| Rights, breaches, DPIA and authority assistance | Deletion contact exists; complete contract duties not found | Sections 6–8 |
| Controller's return/delete choice and copies | General deletion notice; no complete agreed exit schedule found | Section 10 and Schedule 4 |
| Information, audits and inspections | Complete clauses not found | Section 12 |
| Written binding agreement | Regulamin references acceptance; complete legal execution evidence unavailable | Execution section; not signed or activated by this PR |

See [the complete proposed DPA](article-28-dpa-draft.md). Its clauses are prepared; its customer-specific schedules and signatures must be completed for Stage B. It is not represented as the Commission's unmodified SCC template.

## Providers regions and transfers

| Service | What is confirmed | What remains unknown |
| --- | --- | --- |
| Vercel | Authenticated metadata identifies reziflow-cloud, domain legalhubcrm.com, Pro plan, current READY production deployment; that deployment's `regions` is `[iad1]`. Functions settings independently show Washington, D.C., USA selected | Full CDN/cache/support/log/subprocessor residency, account-holder legal identity and complete transfer assessment |
| Supabase | Repository rollout documentation identifies the production DB provider and historical eu-west-1 pooler. The accessible account's project metadata shows Ireland/eu-west-1 and Free; Backups says Free excludes scheduled backups | Current production DATABASE_URL-to-project association was not checked because credentials were excluded. Vercel Storage shows no marketplace database connection. Do not upgrade this association from historical/consistent evidence to independently verified current binding |
| Local backup storage | Scripts create private operator-managed public-schema backups; repository records past application-data restore verification | Present copies, physical locations, rotation and deletion periods; no backup file was opened or enumerated |
| Meta | Supplies QA form events and Graph retrieval under the owner's App/Page | All current platform-side metadata locations/retention and the precise legal role per service |
| Cloudflare Quick Tunnel | Existing QA uses a temporary public HTTPS relay; vendor docs designate Quick Tunnels for testing/development | All transit/log locations and applicability of a particular customer DPA to this accountless test service; no claim of EEA-only routing |
| Upstash QStash | Notification code fixes an EU-central endpoint and repository reports prior scheduler activation; continuation carries job state/cursor and forwarded authentication, not a database connection | Current console configuration and full retention/subprocessor/location scope were not opened; no settings changed |
| Cloudinary and Dropbox | Upload/download/delete paths exist for documents and organisational settings can select storage | Which organisations currently use them, regions, contracts and retained provider copies; no organisation settings or files were read |
| Resend | Contact/password-reset email paths exist | Current activation, agreements, region and email retention; no mailbox content read |
| Web push | Optional push sends an encrypted payload to the device's provider; TTL is 3600 seconds in code and subscription keys are erased on certain permanent failures | Actual enabled devices/providers and their retention. TTL is not a CRM notification deletion period |
| GitHub | Source/review platform and a manually dispatched scheduler workflow are documented | It is not authorised here as a store for customer records or secrets |

The United States function-processing location is **CONFIRMED**. A claim that all processing remains in the EEA is unsupported. The available Supabase region does not override that fact.

[Vercel's public DPA](https://vercel.com/legal/dpa) covers qualifying Pro services and provides transfer clauses. [Supabase's public DPA](https://supabase.com/legal/customer-resources/data-processing-addendum) forms part of its applicable agreement and includes SCC provisions. [Cloudflare's DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) has its own agreement/acceptance scope. Their existence does not mean LegalHub must sign a duplicate instrument, nor does it prove the particular account holder, service coverage, role/module or required assessment. Those are the remaining contractual facts.

## Actual retention and erasure

| Category | Confirmed implementation | Actual period or procedure not established |
| --- | --- | --- |
| Leads | Tenant-scoped Lead DELETE exists; related contacts/history can cascade, but generic references/notifications do not form a complete erasure cascade | No general age-based expiry or maximum Lead retention found; customer policy UNKNOWN |
| Notifications and outbox | Separate Notification/NotificationPushDelivery records; user/organisation cascades exist | No general age-based purge found. Marking read or a one-hour push TTL is not deletion |
| Terminal Lead Ads receipts | Separate manual maintenance may tombstone complete/blocked/shadow records older than 30 days; clears direct lead ID/link/error while keeping a keyed fingerprint | Whether and how often the operator actually runs it; it is not deployed automatic retention |
| Minimal Lead Ads dedupe record | A tombstone becomes eligible for manual deletion when the original receipt `createdAt` is older than 366 days | Not 366 days after tombstoning; no scheduler. Necessity and agreed duration for real data UNKNOWN |
| Notification dedupe | Notification.dedupeKey is retained with the Notification | It does not share the Lead Ads 366-day cleanup rule |
| Pending/processing receipts | Excluded from terminal cleanup | No expiry in that job; cannot claim a maximum without another procedure |
| CRM webhook logs | LeadWebhookLog is separate; Lead deletion sets its relation null; organisation deletion has a removal path | No general automatic log expiry found |
| Private QA HTTP logs/files | IDs, timestamps, status and digest; previous diagnostics deliberately preserved | No approved global expiry or automatic purge; a previously proposed seven-day review is not an adopted retention policy |
| Provider runtime logs/traces | Retention is a distinct provider/plan/add-on/drain setting. Vercel's published runtime default is one day for Pro, thirty with Observability Plus | Effective add-on/drains, tracing and exported copies were not verified. Provider defaults are not proof of erasure of all copies |
| Supabase scheduled backups | Accessible Free project shows no included scheduled backups; no paid seven-day backup promise applies to it | This is not proof that operator-created/off-platform copies do not exist |
| Operator backups | Local-maintenance code creates a new private public-schema dump and preserves previous backups; no age-rotation rule found | Current inventory, maximum period and post-restore deletion handling UNKNOWN |

Receipt cleanup is organisation-scoped, separately authenticated, gated and batch-limited; dry run is not deletion. The public policy must not call it automatic or a full personal-data deletion process. The 30/366-day thresholds are code behaviour, not statutory periods.

Additional implemented paths: system-admin organisation deletion removes many related tables and invokes document cleanup; document deletion calls local/Cloudinary/Dropbox removal as applicable. Some file/provider failures are caught while metadata removal can proceed, so success does not prove destruction of every remote copy. None of these paths was executed in this review.

The legacy `/api/meta/data-deletion` returns a static instructions URL and code. It does not validate a signed request or initiate a per-user deletion workflow. It is not the proposed QA App deletion callback. The QA App currently selects **Data deletion instructions URL**, which Meta permits as a separate option.

## Stage requirements

| Requirement | Before Stage A QA Live | Before Stage B SL | Basis and scope |
| --- | --- | --- | --- |
| Accurate public app Privacy Policy and usable deletion instructions | Required for the App; can describe the narrow own-QA scope without an SL agreement | Required for the real customer flow and actual processing | Meta policy/settings requirements; GDPR transparency where personal data is involved |
| Basic Settings | Complete the fields required by the applicable Dashboard/validator | Maintain current and accurate details | Current UI blocks Publish on Privacy URL. Basic Settings docs additionally list name, contact email, Terms URL, icon, category and purpose |
| Controller identity and applicable purpose/basis | Own QA and any personal administrator/technical metadata must be properly described | Agency/controller and LegalHub/processor roles, notices and lawful bases must be established | GDPR role/purpose based; form submission is not blanket consent |
| Customer DPA with SL | Not required for an internal tenant of the same entity | Required where SL engages LegalHub as processor | Article 28; it does not depend on how the CRM tenant is named |
| Provider agreements and transfer safeguards | Apply to the actual QA personal-data activities, if any; not a blanket requirement to finish SL's whole provider schedule | Actual data-flow/provider authorisations and safeguards required before that flow | Contract scope and GDPR roles/transfers, not the App's mode alone |
| App roles and own Page authorisation | Existing owner-admin QA scope, exact Page/Form and allowed synthetic Lead ID | Actual SL owner authorisation/Lead Access; no tester-role bypass | Meta authorisation model |
| Review / Advanced Access | Not established as a prerequisite for this precise own-role QA Live experiment; documented Development role-user retrieval exception exists | Review/Advanced customer access path must be completed for required non-role permissions | General Lead Ads/Access Levels docs confirmed; exact use-case Dashboard requirements and actual approval remain UNKNOWN |
| Business Verification | Generic Basic Settings docs distinguish going Live from accessing data not owned by the developer; no current QA BV blocker was displayed | Plan for verified business as required for external/Advanced access; exact selected App flow must be checked | Do not treat a client-access requirement as automatically mandatory for every own-QA publication |
| Production retention/backups | SL retention schedule and paid production backup upgrade are not prerequisites for a synthetic local QA lead | Risk-appropriate retention, deletion and recovery procedures must be established for the real flow | GDPR duties depend on real processing/risk; buying a particular plan is an option, not a universal statutory requirement |
| Stable endpoint and one-test shutdown plan | Required by the agreed controlled test scenario | Production endpoint and operations needed for service | Operational requirement. A ten-minute window or synthetic-only allowlist is an agreed safeguard, not a Meta/GDPR statutory number |

## Current QA App

Read-only UI verification: App **1160353550276176**, **Unpublished**; Privacy, Deletion Instructions and Terms URLs empty; icon upload empty and category not selected; name and contact email populated. Publish is disabled and displays Privacy URL as the current blocker. `leads_retrieval` is **Ready for testing**, showing 37 calls; `pages_manage_metadata` is **Ready for testing**, showing 78. These labels are not evidence of an Advanced Access approval. No token was read or refreshed.

After approved legal text is separately published, the permitted next preparation is to fill only this QA App's correct public URLs, category and icon and re-read the dynamic validator. Approval of PR #14 does not itself publish the pages or authorise these Meta changes. It is not yet possible to certify that filling the URLs will be the final Meta requirement without performing those currently unauthorised changes. If Meta then requires Review/BV, stop rather than bypass it.

The existing app URLs are `https://legalhubcrm.com/privacy` and `https://legalhubcrm.com/data-deletion`. Previous anonymous checks returned 200 for both; the proposed text remains unpublished. Instructions must be entered as Instructions, not as an automated callback. `/robots.txt` previously redirected to Login; real Meta crawler acceptance is not established by a simulated User-Agent.

No evidence establishes that Live will fix Pending. A later authorised test must prove original Meta HTTP/HMAC delivery, Graph retrieval, a new automatic QA receipt/Lead, assignment and notification, with deduplication distinguished from local simulation. No such test was repeated here.

## Remaining owner facts and release decision

Only the owner's contracts/records or an authorised equivalent can settle: the LegalHub contracting entity and applicable provider agreements/transfer assessment; current Supabase project association without credentials; any agreements held outside the repository; actual local backup inventory/retention; adopted Lead/notification/log/QA-evidence retention and who executes deletion. No secret or client-data disclosure is needed to supply those facts.

The texts in PR #14 are a reviewable factual correction and the DPA is a complete clause draft with deliberately incomplete factual schedules. **Unconditional publication readiness for the general production Privacy Policy is not established:** it still needs applicable purpose/basis, actual retention criteria and transfer disclosures to be validated and, where necessary, completed. Describing an unknown fact conditionally does not by itself satisfy every transparency duty. This is a general-publication issue, not a demand to finish the SL DPA before an internal synthetic test.

For Stage A, approve the bounded own-QA notice/operating scope and settle only its applicable metadata/provider/retention facts; leave SL agreement, customer access approvals and production data schedules for Stage B. Publication/merge/deployment, editing Meta fields, switching Live and restoring subscriptions remain separate actions requiring the owner's explicit permission. No action is authorised by this review document.

## Sources

Code paths above refer to existing QA adapter checkout `51c560a5f0090b669ee4ffe48485ba4d6a3a873e`; that is a local combined QA revision, not an assertion that the adapter is deployed to main. Current Production region is from read-only deployment metadata and settings. No database connection was used to infer data contents.

- [Meta Basic Settings](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings?locale=en_US)
- [Meta deletion instructions or callback](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback)
- [Meta Lead Ads requirements and role-user testing exception](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads?locale=en_US)
- [Meta Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels) — its stated App Type scope must be respected for this newer use-case App
- [DPC controller–processor contracts](https://www.dataprotection.ie/en/dpc-guidance/data-processing-agreements)
- [European Commission roles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en)
- [EDPB lawful processing](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Vercel runtime-log defaults](https://vercel.com/docs/logs/runtime)
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

Production changed: NO. Meta App mode changed: NO. RAM Company affected: NO. SL affected: NO. No database operations, backup inspection, migrations, deployment, merge, Review submission or Meta permission/callback/subscription changes were performed. QA runtime remained stopped.
