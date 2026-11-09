# Stage A QA approval and one test plan

**READY FOR OWNER REVIEW — NOT APPROVED OR PUBLISHED.** This package replaces the publication proposal for the general CRM pages in PR #14 with three standalone static QA documents. It does not authorise merge, deployment, Meta settings, Live, callbacks, subscriptions, permissions or Review submission.

## The proposed decision

Approve the three QA texts and adopt the operating conditions and manual cleanup procedure below for the owner's one synthetic test only. Confirm the operator/contact, the QA computer/copies location in Poland and authority to use the provider processing/transfer terms for these services. Authorise a named operator (the owner, or a specifically designated internal operator) to execute the manual deadlines. These are proposed operating commitments; they are not represented as already implemented automated retention.

This decision is about documents and operating conditions. Publication and the later QA Live experiment require separately scoped authorisation. It is not a signed SL DPA or an acceptance of third-party terms by this PR.

## Proposed public URLs

- Privacy: https://legalhubcrm.com/assets/legalhub/qa/privacy.html
- Data deletion instructions: https://legalhubcrm.com/assets/legalhub/qa/data-deletion.html
- Terms: https://legalhubcrm.com/assets/legalhub/qa/terms.html

These URLs are **planned, not deployed or verified live**. Files are static HTML under the existing public assets path; no authentication exemption, CRM feature, API or middleware change is added. They contain no forms, trackers, external scripts, credentials or lead data. Their scope is explicitly App 1160353550276176 / Page 1449474971582722 / Form 2046130655900851.

Public QA notices are app-specific. Meta Basic Settings defines the Privacy URL as the policy applying to that App's users; it does not require every App of the operator to use the same policy URL. This is a scope-based reading of the documentation, not a guarantee of Meta crawler acceptance. After authorised publication, verify anonymous HTTPS 200, actual text, links, content type, redirects and actual Dashboard acceptance. Do not point Meta to a GitHub source viewer or an unpublished URL.

The previous broad Privacy/Deletion proposals remain only in [the general-page drafts](legal-pages-approval-texts.md). The executable /privacy and /data-deletion pages are restored to main in this PR, so this QA publication does not also release the unapproved general rewrite. The [Article 28 DPA](article-28-dpa-draft.md) stays an unexecuted Stage B draft.

## Only the remaining Stage A owner facts

1. **Operator/contact:** reuse the existing public operator LegalHub CRM JDG Valentyn Verbelchuk, NIP 9512609364, Warsaw address and office@legalhubcrm.com; owner confirms current accuracy and access to the mailbox.
2. **Local location/copies:** the proposed notice commits to an operator-managed QA computer in Poland and cleanup of operator-held QA copies. Physical location and any automatic cloud-sync copies were not proved by the timezone or code. Owner confirms this narrow scope; otherwise revise the location/copy description before publication.
3. **Actual provider coverage:** Meta supplies its own platform; Cloudflare carries the temporary webhook; Vercel serves the static notice. Public Vercel Pro DPA includes SCCs. Cloudflare Self-Serve terms section 6.1 incorporates its DPA for covered personal-data services, but accountless Quick Tunnel coverage is not independently established by the existence of that DPA. Owner's applicable account/agreement records or provider confirmation must support the proposed concrete transfer paragraph before publication/use; do not assert signed coverage from a generic link. This narrow QA provider fact is not a demand for SL contracts or a full CRM provider audit.
4. **Adopt the deadline and responsibility:** owner adopts the procedure, names who will actually perform it and signs off the limited legitimate-interest assessment below. Preparation alone does not turn it into an existing policy.

No Production database binding, paid backup plan, SL contract, complete customer retention schedule or client-data inventory is needed merely to approve this own-QA scope.

## Limited legitimate interest assessment for adoption

- Purpose: verify reliability/security of the owner's own Meta-to-isolated-CRM integration before considering client use.
- Necessary information: synthetic contact fields plus minimum App/Page/Form/Lead identifiers, status/time and administrator connection/authorisation metadata. Unnecessary public-profile, ad-account, message and contact data is neither requested nor retained for this test.
- Alternatives: local simulation already passed but cannot establish original Meta webhook delivery. One controlled real platform test is justified by that distinction.
- People and expectations: only the adult owner/app-role administrator and authorised internal operators; no employees compelled to supply personal lead contacts and no clients.
- Impact and safeguards: no marketing, automated decisions, external push/email notification or real contacts; exact resource/lead allowlist, local-only dataset, restricted access, no raw contact bodies in diagnostics, 7-day manual cleanup.
- Residual matters: account/network metadata is personal; international relay/hosting processing remains subject to applicable provider agreements and transfer safeguards. Synthetic fields do not exempt it.
- Adoption: owner confirms necessity, balance and the safeguards. If objection or unplanned real information appears, stop processing and handle it before continuing. This draft is not a completed owner assessment until adopted.

## Manual cleanup procedure for approval

**T0** is closure or cancellation of the one controlled test, regardless of PASS/BLOCKED. Do not postpone T0 because Pending persists. If the test is not authorised, close/cancel preparation explicitly rather than retain earlier QA evidence indefinitely.

1. **At T0:** close gate release, binding enabled=false/mode=off and test Lead allowlist; stop intake/worker and temporary relay. A later authorised shutdown also removes only the QA leadgen subscription/callback. No Meta mutation is authorised now.
2. **By T0 + 24 hours:** remove transient local QA Page-token/secret copies and test process environments from the approved QA locations; do not rotate shared credentials, reveal values or delete unrelated application configuration. Owner separately controls Meta-side authorisations and App resources.
3. **By T0 + 7 calendar days:** inventory only the isolated QA dataset and operator-held QA copies. Remove QA Leads/assignments, receipts including pending/tombstone/dedupe, Notifications/outbox, QA logs, screenshots and QA DB dumps/snapshots, with no reliance on Lead DELETE cascades or the 30/366-day maintenance job. Include earlier pilot files within 7 days of adoption of this procedure. Do not sweep a shared backup directory or modify Production.
4. **Execute and verify:** before any destruction, verify absolute QA targets and isolation, stop writers, identify copies/cloud-sync locations, and apply the separately authorised QA-only deletion. If practical, reset/delete the disposable isolated QA database after evidence extraction rather than claim selective cascade completeness. Verify absence of targeted records/files and check each copy separately; record category, date, actor and counts without personal/lead/account IDs. No deletion is performed in this preparation task.
5. **Provider/platform records:** review the continued need for the QA App/Page/Form by T0 + 7 days. Do not remove these resources, revoke Meta grants or demand deletion of provider records without appropriate separate authorisation. Identify independently retained provider information and direct rights requests appropriately. Do not claim local erasure removes it.
6. **By T0 + 30 days:** manually remove the remaining QA result summary. Until then it may contain only test date, aggregate counts, PASS/BLOCKED and non-identifying errors; no names, contacts, credentials, account/lead/user/device IDs, body digests that can be linked to people or raw screenshots. Legal obligations require a documented category-specific exception, not indefinite generic retention.

This is a deliberately shorter QA policy. Stage B retention is not borrowed from these periods. Automation is not added. The 7/30-day values are proposed operator choices, not statutory or Meta deadlines.

## Meta Basic Settings prepared values

| Field | Proposed value / next action |
| --- | --- |
| App | 1160353550276176; keep LegalHub Internal QA Lead Ads |
| Privacy URL | Planned QA privacy URL above, after authorised publication and anonymous readback |
| User data deletion | Keep **Data deletion instructions URL**, enter planned QA deletion URL; do not select callback |
| Terms URL | Planned QA Terms URL; Meta Basic Settings documentation expressly lists Terms as needed for Live |
| Category | **Business and Pages / Бизнес и Страницы**; this exact choice was observed in this App's category menu; not selected |
| Icon | Existing own-brand public/assets/legalhub/legalhub-mark-tight-transparent-512.png, visually reviewed, actual 512×497 PNG (190,419 bytes); no Meta mark. Meta's current upload UI allows square cropping; crop there if requested, not assumed square from its filename. Not uploaded |
| Display name/contact | Name populated; contact email populated; owner verifies existing contact. No need to disclose it or App Secret |
| App purpose | Own business/internal testing only; no client organisation. Basic Settings docs list purpose, but this current Basic UI did not expose a separate purpose field; follow the current use-case validator |
| Domain | legalhubcrm.com if requested by the applicable validator; not invented as an unconditional extra requirement |
| Namespace/DPO/platform | Do not invent values or add an unused platform. DPO requirement depends on applicable law; blank optional DPO fields are not proof that a DPO is required |

Read-only check 9 November 2026: App remains Unpublished; Privacy/Deletion/Terms URLs, category and icon empty. Publish is disabled and names Privacy URL as the current blocker. leads_retrieval shows **Ready for testing**, 37 calls; Advanced Access approval is not confirmed. No token was read. Current permissions/settings are unchanged.

## Stage A versus Stage B

**Confirmed before Stage A:** correct app-specific public Privacy/Deletion notices and required Basic fields; a lawful and transparent basis for actual personal metadata; applicable QA provider/transfer arrangements; exact own App/Page/Form and role-user authorisation; isolated runtime, resource guards and manual shutdown/cleanup. The latter guard/deadline choices are our controlled-test requirements, not all statutory numbers.

**Not established as a Stage A blocker:** SL DPA, SL personal-data retention, paid Production backups, SL onboarding or client-access review. The own internal tenant is not another legal person, so no intercompany DPA with “LegalHub Internal QA” is required.

**Review/BV nuance:** Meta Lead Ads docs state the general Review path for leads_retrieval/pages_manage_ads and BV, and expressly allow Development role-user lead retrieval. Access Levels docs allow own-role Standard use but expressly limit their scope to App Type apps. This newer use-case App shows Ready for testing, not proof of Advanced or an unconditional Live exemption. Basic Settings docs distinguish BV for others' data from going Live itself. No separate Review requirement for this exact own-role QA experiment was confirmed. Read the dynamic validator after authorised field completion; if it requires Review/BV, stop and report that actual blocker. Do not submit Review, add tester roles or work around it.

**Before Stage B SL:** executed Article 28 DPA and processing instructions, roles/notices/bases, real data retention/deletion/recovery and provider/transfer schedule; required Review/Advanced/BV for external access; separate owner consent for exact SL Page/forms/Lead Access; separate tenant binding, staff routing and several test leads with the old process in parallel. None is performed now.

## One later QA Live experiment

This is a plan only. The new hypothesis is whether publication changes automatic webhook dispatch for this exact App; Live is not a guaranteed Pending fix.

1. Obtain separate authorisations for publication, QA Basic fields and then the bounded Live test, including restoration and removal of only QA callback/leadgen subscription. All current prohibitions continue until those actions are authorised.
2. Publish only the QA static notices after the four narrow confirmations above; leave general production legal drafts and Stage B DPA unpublished. Read back all three URLs anonymously over HTTPS, inspect redirects/content and the icon file.
3. Fill verified QA Basic fields, then inspect the actual validator. No permissions expansion, ads, Review submission or new resources. Stop for an actual Review/BV requirement.
4. Before any test, verify the isolated local DB, QA tenant, private current token issued by this App for this Page, no Production settings, appsecret/HMAC checks, existing local gates/switches and original App/Page/Form tuple. No secrets in logs. Leave email, external push, document storage and production QStash off.
5. With separately authorised Live/callback actions, start the existing local QA gateway/CRM/worker/PG and temporary HTTPS relay for one bounded session. Expose only the existing webhook gateway; no broad CRM/admin route. Verify challenge/HMAC and read back only QA Page leadgen subscriptions. No messages/message_echoes.
6. Create exactly one synthetic lead with the official Lead Ads Testing Tool. If an earlier own test blocks creation, record its safe technical result and remove only that test when separately authorised. Do not call test_leads repeatedly as another Development test.
7. Handle the unknown-first-ID race with the existing closed first-event gate/503 retry behaviour: approve only the newly observed exact Lead ID privately, then permit original Meta bytes/HMAC. Do not release a broad Page/Form-only intake or invent a local signature.
8. Observe for at most 10 minutes after creation. Record Meta Track Status and original HTTP receipt/status/HMAC, Graph form/id match, automatic receipt/Lead in QA tenant, staff assignment and one in-app notification. Deduplication was already tested; inspect counts or natural retries, no repeated synthetic test is required.
9. PASS only for original Meta → webhook → QA receipt → Graph → Lead → Staff → Notification. If no Meta event arrives, report Pending/no HTTP and stop; if it arrives and fails, classify the actual endpoint/worker error. Do not infer the cause from mode alone.
10. Close binding/gate/worker, remove only the authorised QA subscriptions/callback, stop tunnel and runtime, dispose transient local credentials and execute the adopted manual schedule. App-mode rollback or deletion/revocation of Meta resources is included only if separately authorised; local OFF remains the immediate kill switch.

## Evidence and sources

No new Development test, Meta mutation, Production operation, credential inspection or deployment is part of this PR. Prepared static pages are not evidence of live HTTP availability. Local validation covers parsing/content/links/public path and icon, not Meta crawler acceptance.

- [Meta Basic Settings](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings)
- [Meta Data Deletion FAQ](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback)
- [Meta Lead Ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads)
- [Meta Access Levels and its App Type scope](https://developers.facebook.com/docs/graph-api/overview/access-levels)
- [EDPB legal bases](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)
- [Vercel DPA](https://vercel.com/legal/dpa)
- [Cloudflare Self-Serve terms](https://www.cloudflare.com/terms/) section 6.1; [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) scope and restricted transfers
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) for testing, temporary URL and no uptime guarantee

Production changed: NO. Meta App mode changed: NO. RAM Company affected: NO. SL affected: NO.
