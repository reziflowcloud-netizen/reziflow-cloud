# Production Lead Ads App Review preparation

Prepared and updated **17 November 2026**. **DRAFT, NOT SUBMITTED; NOT READY TO SUBMIT YET.** Reuse this checkpoint; do not create another App, repeat Business Verification or activate SL to prepare the review.

### Final-preparation checkpoint

- Scoped **Draft PR [#19](https://github.com/reziflowcloud-netizen/reziflow-cloud/pull/19)** prepares replacements of the existing three public routes, not duplicate policies. [Complete exact approval texts](legal/meta-review-final-texts.md), [publication gate](legal/meta-review-publication-approval.md), [provider evidence](legal/meta-review-provider-facts.md), [cleanup/deletion runbook](legal/meta-review-deletion-runbook.md). No merge/publication performed.
- The owner now confirms both Vercel and Supabase accounts are used on behalf of LegalHub under accepted standard Terms/DPAs without an excluding agreement. This is account-specific evidence in addition to the official DPA/SCC text. Exhaustive remote-processing countries are still **UNKNOWN**; do not certify the regions alone as complete.
- Prepared a **new separate synthetic local review environment**, not the historical QA App. Its database has 54 migrations, drift 0; CRM build PASS. Three review-tenant users include two active linked staff members, three native routing channels and in-app assignment preferences; a separate synthetic tenant/canary is used for isolation checks.
- Actual HTTP and browser login PASS. Review credentials use tenant **admin**, not global **owner**: session reports canManageAll false. A foreign synthetic Lead is denied and the control account can read its own canary. Anonymous API access is denied; all three proposed legal pages render anonymously and their links/mobile layout pass. Native Lead Ads screen is closed/unconfigured; no binding exists.
- Source/native process protections remain in place: approved PowerShell 7/RemoteSigned, exact loopback/random DB, marked private root/ACL, cleared child environment and the unchanged reviewed kill-on-close Windows Job component. Thirty positive/negative profile tests and the exact PostgreSQL process-path tests PASS. Original PR #16 pins and Production feature guards were not weakened.
- Local runtime/tooling is preserved on **local-only** branch `codex/meta-review-local-runtime-20261117`; it is not part of PR #19 and was not pushed. The tested app copy's source head is recorded privately. Return to that branch before invoking its `scripts/meta-review` tools. Do not substitute the old QA supervisor, which pins other resources.
- Browser logout, owned App Job stop and exact synthetic PostgreSQL shutdown **VERIFIED**; no listeners remain. No public relay, Meta token/App Secret copy, original event, test Lead, recording, callback, subscription or global Production activation was created in this preparation. Local accounts are prepared; external reviewer access and a real recording are **NOT READY**.
- Three generated local credential/config copies are inventoried under the new private root. A conservative owned-marker creation anchor prevents retention renewal: credentials **18 November 2026 20:04:35 Warsaw**, data/copies **24 November 20:04:35**, deidentified outcome **17 December 20:04:35**. Old QA deadlines are unchanged; no policy-blocked deletion was attempted. Private paths/credentials remain outside Git.

**First required owner decision:** approve the concrete legal texts/publication gate before they replace the live pages. Do not collect an expiring Meta token while the notice/Form/runtime gates cannot yet use it. After approved publication, finish the owned Form, compatible public gateway/provenance procedure and one bounded fresh-credential recording session; exercise the actual new App instead of rerunning the old QA E2E.

## Exact application and verification

| Item | Observed state |
| --- | --- |
| App | **LegalHub CRM Lead Ads — 1627116975561049** |
| Owning Business Portfolio | **LegalHub CRM — 1499778915546174** |
| Use case | Capture/manage advertising leads through Marketing API, `MARKETING_API_LEADS_CAPTURE` |
| Publication | **Unpublished**; no client grants/tokens, callback/subscription or Production activation in this preparation |
| Operator/contact | **VALENTYN VERBELCHUK**, trading as LegalHub CRM, NIP 9512609364; **office@legalhubcrm.com** |
| Tech Provider | Owner personally accepted the declaration; this does not grant Advanced Access |
| Business Verification | **APPROVED / Подтверждено**, freshly observed on 17 November in both the exact App Verification screen and LegalHub CRM Security Center. The card identifies VALENTYN VERBELCHUK and initial verification Nov 17, 2026. The earlier In review checkpoint is superseded; this is not Advanced Access approval |
| Existing Review draft | **1627120612227352**, Not submitted. This is a submission ID, not another App |

Continue the [existing Review draft](https://developers.facebook.com/apps/1627116975561049/app-review/submissions/?submission_id=1627120612227352&business_id=1499778915546174). Business Verification stays in its [existing case](https://business.facebook.com/latest/settings/security_center?business_id=1499778915546174). The owner supplies any additional evidence directly to Meta if requested; no document resubmission or copies in chat.

Released CRM: main `5061e7dbef54f953b649081e880cc0766e2f557f`, Vercel `dpl_BY8MAkAJN2kaEQ2SY7GiGFu8Luch`, READY at release. The additive migration was applied once, ledger 54/0, drift 0. All Production Lead Ads UI/intake/worker/scheduler/allowlists remain OFF. No migration, deployment, Production DB operation or client-data read is part of this preparation.

## Minimum request selected in this App

The exact **leads_retrieval** modal states dependencies **pages_manage_ads, pages_read_engagement, pages_show_list**. Page leadgen subscription requires **pages_manage_metadata**, whose modal also requires **pages_show_list**. The unsubmitted Review request now contains exactly these five permissions:

| Permission | Implemented purpose | Remaining evidence shown by Meta |
| --- | --- | --- |
| `leads_retrieval` | Fetch id, form_id, platform, field_data and created_time for a signed, exactly authorised event; create one tenant Lead, staff assignment and internal notification | Final supported-use confirmation, working reviewer flow and retrieval evidence |
| `pages_manage_metadata` | Configure/verify dedicated Page `leadgen` subscription; no messaging subscription | End-to-end screencast, API test calls, permitted-use confirmation |
| `pages_show_list` | Identify/select only Pages authorised by the representative during administrator-assisted onboarding | Screencast and permitted-use confirmation |
| `pages_manage_ads` | Explicit Page-scoped prerequisite for lead retrieval in this App's validator | Screencast, API test calls, confirmation; no claim of campaign management or spend |
| `pages_read_engagement` | Explicit Page-authorisation prerequisite for the supported lead route | Screencast, API test calls, confirmation; no invented engagement analytics |

All five currently show **Ready for testing**, not approved Advanced Access. No fresh API calls were made for this Production App in this preparation.

Added `pages_manage_metadata` to the **Review request**, not a customer grant. Removed **only from the unsubmitted Review request**: `business_management`, `ads_read`, `ads_management`, Marketing API Access Tier and `public_profile`. This does not revoke existing App scopes or remove the normal default profile feature from the App. The runtime does not manage advertisements, request whole-business access or read conversations through Lead Ads. Do not add those scopes without a demonstrated endpoint/validator requirement.

Five purpose descriptions were saved in Meta's partial permission forms and are reproduced below. Their required consent/completion boxes remain unchecked, test-call completion was not claimed and no recording was uploaded.

Sources: [Meta permissions](https://developers.facebook.com/documentation/development/permissions), [App Review introduction](https://developers.facebook.com/docs/resp-plat-initiatives/app-review/introduction), plus the exact selected App's permission modals. The five-scope candidate is justified by that validator and implementation, not a claim of tested external access.

## Basic Settings — actual saved state

[Selected App Basic Settings](https://developers.facebook.com/apps/1627116975561049/settings/basic/?business_id=1499778915546174)

- App name and contact unchanged and verified.
- App domain **legalhubcrm.com** saved.
- Terms **https://legalhubcrm.com/regulamin** saved; anonymous HTTPS 200 observed. Its Article 28 reference is not a completed customer DPA.
- Category **Business and Pages / Бизнес и Страницы** saved.
- Existing LegalHub raster logo `public/favicon.png` uploaded, framed in Meta's official cropper, accepted and read back. No newly generated logo; resulting 1024px dimensions are not independently claimed.
- **Website** platform added and **https://legalhubcrm.com/** saved. Before this addition the Reviewer Instructions screen explicitly could not accept instructions without a platform.
- **Privacy and Data Deletion instructions URLs remain empty** pending an accurate approved public notice/procedure. Existing `/privacy` and `/data-deletion` are reachable, but their token-storage/location/role wording is not a truthful complete notice for this route. Existing QA pages concern another App and must not be substituted.
- No App Secret displayed, copied or rotated; no optional DPO identity invented.

[Final publication texts](legal/meta-review-final-texts.md) and PR #19 now make the targeted corrections to the existing routes. Their code is prepared and locally tested, not deployed. Account-specific DPA applicability is owner-confirmed; complete remote-access countries remain unverified. Earlier [general approval drafts](legal/legal-pages-approval-texts.md) remain historical working material, not a separate publication package.

## Own synthetic demonstration resources

The exact LegalHub CRM Business Suite Page inventory confirms **LegalHub CRM Page 1336008826271813**, owned by Business **1499778915546174**. No Page access grants were changed.

On that Page, saved **one unpublished draft** named **LegalHub Review Synthetic v1**, language `en_US`, visible in the Draft Forms library on 17 November at 18:54 Warsaw. Manual display mode, no phone OTP, introduction: internal synthetic review only; no real personal/client data or advertising. It is an incomplete draft, **not a published review Form or a usable Form ID**. No Lead or advertisement was created.

Continue the [draft forms on the exact owned Page](https://business.facebook.com/latest/instant_forms/draft_forms?asset_id=1336008826271813&business_id=1499778915546174). Complete the minimal field map, accurate privacy URL and completion screen before any separately approved publication. Do not create another duplicate draft simply because the published library is empty.

Do not reuse the forbidden historical QA IDs: App 1160353550276176 / 2523488421395251, Page 1449474971582722, Form 2046130655900851. The released Production guards intentionally reject them.

Owned resources and synthetic contacts can support a role-user review demonstration before third-party Advanced Access, subject to the App's effective testing permissions and real subscription/delivery proof. This is not approval to connect a non-role client or an assurance that Development Mode delivers every test. See [Meta's official testing guide](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/testing-troubleshooting). Do not delete an existing test Lead without exact authority.

## Reviewer flow and recording — prepared, not fabricated

The Website reviewer form now exists. Saved: **Facebook Login integrated: No**, plus the explicitly incomplete operator-assisted walkthrough reproduced below. No fake test account, access code or video is supplied.

The native adapter implements **administrator-assisted onboarding and server-side provenance attestation**. It does not implement a self-service Facebook Login for Business button/OAuth callback. Demonstrate the real supported workflow. Do not describe Graph Explorer as the CRM's login flow. Acceptance of that manual authorisation path by Meta has not been proved.

A working external reviewer URL and a true recording remain necessary. The public Production login URL alone cannot exercise a hidden OFF integration. The separate synthetic CRM/DB and local tenant-admin accounts are now prepared and tested. Exact owned App/Page/Form credentials, published Form and protected external review/gateway availability still require completion without enabling Production's global flags or exposing SL/RAM.

### Recording sequence and acceptance criteria

1. Show exact App, own Page/Form and synthetic review tenant; no credentials/token panels or real contacts.
2. Show actual administrator-assisted Page selection/authorisation and verified App/Page/Form/token/tenant provenance. New binding starts OFF.
3. Show dedicated App Page-leadgen and Page subscribed_apps evidence, signature verification and exact gates.
4. After proving safe test-ID ordering, use one official synthetic test Lead. Show original Meta POST, matching Graph retrieval, one CRM Lead, expected active linked staff recipient and one internal assignment Notification.
5. Replay the same synthetic event in a bounded authorised way; no duplicate Lead, assignment or Notification. Distinguish operator replay from original Meta delivery.
6. Show synthetic cross-tenant refusal and exact-binding OFF/STOP without affecting other integrations.

The pilot currently requires the exact Lead ID before acceptance, whereas Meta can deliver immediately after creation. Resolve that ordering with a verified supported operator procedure; never substitute a wildcard/live customer mode or race a manual allowlist update. Do not present sample POST or old QA video as the new App's original E2E.

The production scheduler intentionally rejects local/QA URLs. Preserve that canonical-Production guard. A new closed local review profile was prepared and tested, using its own loopback app/database and unchanged owned-Job component. All were stopped after inspection. It is not a completed public HMAC relay/worker launcher for the new published Form; do not present its structural profile tests as real Graph or webhook evidence. A recording becomes a final artifact only after the actual new-App demonstration succeeds.

## Data Handling — truthful saved answers

| Question | Saved / outstanding answer |
| --- | --- |
| Other processors/service providers have access | **Yes**; Vercel/Supabase are used. Processor entries not completed because Meta asks all processing countries, including remote access |
| Responsible entity | VALENTYN VERBELCHUK, operating LegalHub CRM, NIP 9512609364. Controller for own review/account/technical data; processor on future customer's documented lead instructions |
| Responsible country | **Poland**, saved |
| National-security government disclosure in preceding 12 months | **No**, expressly confirmed by owner |
| Measures already in effect for government requests | **None of the above**, expressly confirmed by owner; not changed to aspirational policies |
| Proposed procedure | [Approval draft](legal/government-data-requests-draft.md); not adopted and not evidence of existing practice |
| Completed Data Handling assessment | **No**; no final assessment or submission |

Country evidence: database Ireland and Vercel function region US are confirmed; these are not every provider's processing location. [Vercel's public subprocessor table](https://security.vercel.com/?itemName=legal&itemUid=e3fae2ca-94a9-416b-b577-5c90e382df57), last updated 21 August 2026, lists US, Spain and UK supplier locations. [Supabase's 12 October 2026 list](https://supabase.com/legal/subprocessor-list/October-12-2026.pdf) includes US, Singapore and Hungary supplier locations. The owner confirms accepted applicable DPAs, but those lists alone do not prove which optional services process this App's Platform Data or every remote-support location. Do not assert all listed AI/account suppliers receive lead answers, or select just Ireland/US and certify completeness.

No full processor entry was saved with an invented country list. Complete the exact provider/service/remote-access evidence before submitting. The limited own-review flow does not require a signed SL DPA; its personal administrator/technical data still need a truthful notice and applicable provider terms.

## Prepared operational package; activation not performed

- [OFF configuration inventory](meta-lead-ads-disabled-config.example.json): exact Production App, no credentials, all five switches false, every organisation/tuple list empty.
- [SL operator playbook](meta-lead-ads-sl-onboarding.md): private token provenance/storage/expiry, Staff Routing, notifications, STOP, customer legal schedules and single-writer Sheets cutover.
- [Russian remote-session checklist](meta-lead-ads-sl-remote-session.ru.md): minimum attended client actions after prerequisites.
- [Article 28 draft](legal/article-28-dpa-draft.md): preserved unsigned; customer schedules still incomplete.
- [Proposed government-request procedure](legal/government-data-requests-draft.md): available for actual owner adoption, no false historical claim.

Prepared secret destination is the existing server-side Sensitive environment facility after explicit configuration authority, never NEXT_PUBLIC, Git or Organisation.settings. No token/secret generated or stored by this preparation.

The released foreground worker script has serial requests, bounded cadence/deadline/ticks and fixed-category error signals. It is **not an installed persistent scheduler**. Managed host/service account/restart, alert recipient/sink and independent missed-heartbeat monitor are unassigned. Existing notification QStash remains separate and unchanged. No new paid or background infrastructure was created.

## What can proceed now and what must wait

| Gate | Can be prepared without Meta approval | Depends on |
| --- | --- | --- |
| Permission texts and five-scope draft | **DONE**, saved in Meta | Actual test-call/recording evidence and owner's permitted-use confirmation before submit |
| Basic settings | Domain, Terms, category, icon, Website **DONE**; exact replacement texts/scoped legal PR prepared | Owner approval/publication and complete applicable provider-country facts |
| Government questionnaire | Truthful No/None **DONE** | Owner adoption if implementing the draft procedure; do not imply adoption required merely to save No/None |
| Owned resources | Page confirmed; one Form draft **SAVED** | Accurate form notice and controlled publication; no SL required |
| Demo/access/video | Storyboard/access fields plus actual synthetic DB/build/tenant-admin login and isolation checks **PASS** | Public gateway/reviewer availability, owner-only fresh Meta grant, actual API calls and recording; no dependence on signed SL contract |
| Business Verification | **APPROVED**, read back in both Meta screens | No resubmission; handle any future Meta request only if one actually appears |
| Advanced Access / App Review | Unsubmitted draft prepared | Completed truthful evidence, relevant Meta business/access gate, separate owner submission approval |
| SL activation | OFF template, routing/token/alert/Sheets/DPA procedures prepared | Customer facts/instructions, exact grants/tuple, operational host/alerts and one-writer cutover; separate activation approval |

**BV approval has now arrived:** finish the outstanding legal/data-handling and real demonstration evidence, present the concrete final Review package to the owner, and only after separate approval submit the existing draft. Do not wait for a second verification decision. BV alone does not make missing video/access/legal fields complete.

**Current decision: BLOCKED for submission, not blocked merely by waiting for Meta.** Outstanding non-Meta work is accurate published Privacy/Deletion/provider-country answers and an actually exercised isolated reviewer access/recording. No final submission, consent declaration, global activation, SL/RAM change or Production modification was performed.

### Exact remaining work, without another general audit

1. **Provider evidence:** the owner has confirmed the existing Vercel/Supabase Terms and standard DPA applicability. Resolve only the remaining exhaustive processing/remote-access country answer through the existing contracts or an approved support channel. Do not create a ticket or transmit an account identifier without the owner's send authorisation:

   > For our configured CRM hosting/database service (Vercel functions in iad1 / Supabase PostgreSQL in Ireland), please identify the applicable contracting entity and DPA incorporation, the countries in which our service's Customer/Meta Platform Data may be processed or remotely accessed for operations and support, and the applicable international-transfer mechanism. Distinguish account/support data and optional products from database/form payloads. Supplier headquarters alone does not answer processing-country coverage. Please reference the current contractual schedule; we will not send credentials, lead records or database contents.

   Record the service-specific answer and source privately where account-specific. Do not send it automatically or infer accepted terms from the existence of a public DPA. Finish Meta's processor entries and the notice only with sufficient evidence.

2. **Legal approval/publication:** use the targeted existing notice drafts and actual deletion procedure, not a new blanket CRM audit. Resolve their explicit approval gates, obtain approval of the concrete accurate text, publish only under the required separate release permission, then save/read back the two public legal URLs in this App. The government procedure can be adopted separately; selecting None truthfully is not proof that Meta demands a fabricated policy or that a signed SL agreement is required for owned review.

3. **One isolated review operation:** reuse the completed, currently stopped local synthetic database and restricted review-tenant account recorded above; do not repeat their 54 migrations, build and native access/routing checks without a relevant change. The separate local runtime branch is preserved. The remaining public supervisor/gateway must be checked for App 1627116975561049 and owned Page 1336008826271813; the historical supervisor's pinned QA identifiers must not be reused. Prepare restricted HTTPS webhook/reviewer access using the approved free provider and no Production credentials. The reviewer needs a usable authenticated entry point; a webhook-only tunnel does not provide CRM access. Treat new exposure/account grants as concrete owner-confirmation gates, never expose the database or system-owner account or weaken tenant/HMAC checks. Public ingress, Graph transport and external reviewer availability remain unprovisioned and untested; the completed local checks do not prove them.

4. **Owner-only credential step, once prerequisites are ready:** prepare new private blank files and request one bounded input/grant for only this App and owned Page. Never retrieve old QA credentials, expand customer permissions or generate a client token to avoid a personal authorisation. Do not create expiring copies while legal/runtime gates remain unresolved. Confirm closure and exact cleanup deadlines before collection.

5. **Actual evidence:** complete/publish the owned form only after its truthful notice is available and approved; prove test-ID ordering and an exact owned tuple. Then perform only the newly needed own-App API calls and synthetic demonstration, record the actual UI without secrets, validate the prepared restricted review account and externally usable access, and set its bounded availability. Do not rerun the historical Meta QA or use SL as a reviewer resource.

6. **Final submission:** replace the explicit incomplete reviewer draft with the exercised exact instructions; upload the final recording and protected test access through Meta's intended fields; obtain the owner's permitted-use/final submission confirmation. Submit only the existing draft and only after that separate approval. Keep Production activation OFF even if Review is later approved.

## Exact permission texts saved in Meta


### leads_retrieval

LegalHub CRM is an advertiser-authorised CRM for business customers. We request leads_retrieval to retrieve the permitted contact answers for a Lead Ads form that the advertiser explicitly authorises for its own CRM organisation. Onboarding is currently administrator-assisted: the representative identifies the Page and Form, and the operator verifies the issuing App, Page identity, Form membership and effective Lead Access before enabling a binding. We do not present this as an implemented self-service Facebook Login flow.

For an original leadgen event, the dedicated endpoint verifies the raw-body Meta signature and the exact App/Page/Form/organisation binding. The server worker reads only id, form_id, platform, field_data and created_time for that event. It maps approved contact fields into one Lead in the authorised organisation, routes it to an authorised staff member and creates an internal assignment notification. Repeat delivery is deduplicated and must not create a second Lead or assignment notification. Lead answers are not stored in the delivery receipt. The permission is necessary because the webhook identifier alone does not provide the answers requested by the advertiser for follow-up.

We do not use this integration to create advertisements, read conversations, sell data or profile people. Page tokens remain in restricted server configuration, not the CRM settings UI. An authorised tenant Owner/Admin can disable its binding without changing other tenants. The App is currently unpublished and Production Lead Ads intake remains OFF pending the required approvals; no SL or real customer data is part of the planned synthetic review demonstration.


### pages_manage_metadata

We request pages_manage_metadata only to subscribe the dedicated Lead Ads App to leadgen events for a Page explicitly authorised by its business owner. Our administrator-assisted onboarding checks the exact App, Page, published Form and CRM organisation, effective Lead Access and the Page subscribed_apps entry. The permission is needed for that Page webhook subscription and delivery; this integration does not use it to change Page content or subscribe to messages/message_echoes.

The dedicated callback verifies the raw-body Meta signature and accepts only an enabled, verified App/Page/Form/organisation binding. An authorised Owner/Admin can disable the tenant binding without changing other organisations or the existing messaging integrations. This is separate from any customer Facebook account/password and from our older Messenger Apps. The review demonstration must use our own permitted resources and fabricated form answers, with no SL/customer data. The current App is unpublished and Production intake remains OFF pending approval.


### pages_show_list

We request pages_show_list to identify only the Pages that the authorising representative may connect during administrator-assisted Lead Ads onboarding. The representative selects the intended Page and published Form, and the operator records the exact numeric identifiers for that customer organisation only after verifying provenance and Lead Access. This is also a dependency of the requested leads_retrieval and Page webhook permissions.

The released CRM does not implement a self-service Facebook Login connection button. The review demonstration must show the actual supported representative-authorisation and operator-assisted selection procedure, followed by the tenant binding screen, rather than an invented OAuth user interface. We do not use this permission to browse unrelated businesses, read Page conversations or obtain an unrestricted list of client assets. A Page name alone is not authorisation; the issuing App, exact Page/Form and tenant must match before intake can be enabled.


### pages_manage_ads

We request pages_manage_ads as the Page-scoped dependency explicitly required by this App Dashboard for leads_retrieval. LegalHub CRM retrieves authorised Lead Ads form answers for an exact approved Page/Form/organisation binding so the advertiser can follow up the person who requested contact. The runtime fetches only the lead id, form_id, platform, field_data and created_time for a signed leadgen event.

This integration does not create, edit, purchase, pause or optimise advertisements, access unrelated ad accounts or change advertising budgets. Our demonstration and test calls must prove the actual Page-authorised lead retrieval use case; we do not claim an implemented ad-management user interface. pages_show_list is included as the dependency required by the current validator. All customer activation remains OFF until the required approvals, documented authorisation and exact tenant gates pass.


### pages_read_engagement

We request pages_read_engagement as a Page-authorisation dependency explicitly required by this App Dashboard for leads_retrieval. Its purpose in LegalHub CRM is limited to the permitted Page-scoped Lead Ads connection and retrieval route, together with pages_show_list and pages_manage_ads. We do not claim to provide Page-feed analytics, read follower profiles or read customer conversations through this integration.

An authorised representative identifies the Page and Form during administrator-assisted onboarding. The operator verifies the exact App/Page/Form/organisation provenance, Lead Access and token validity. A signed leadgen event then permits retrieval only for that approved binding and only while its tenant/mode gates are enabled. Retrieved form answers create one tenant Lead, assignment and internal notification, with replay deduplication. No unrelated Page or customer organisation is authorised. The required demonstration and test calls must show this real Page/lead use case using only our own permitted assets and synthetic contact answers.

## Exact incomplete reviewer walkthrough saved in Meta

The text below records the incomplete draft saved in Meta before the later local fixture checks. A local restricted reviewer account now exists and was exercised, but no external reviewer URL or actual recording is ready. Replace the saved Meta draft only after the real external walkthrough is verified; do not interpret the historical wording as an instruction to create a second local environment.

DRAFT — DO NOT SUBMIT UNTIL THE ISOLATED REVIEW ACCESS AND RECORDING ARE VERIFIED.

LegalHub CRM Lead Ads (App 1627116975561049) uses administrator-assisted onboarding, not a self-service Facebook Login flow. The public service URL alone does not expose this disabled integration. No reviewer account is provisioned yet; access credentials will be supplied only through the designated protected Meta fields after preparation.

Planned reviewer walkthrough, to be exercised before submission:
1. Sign in to the isolated synthetic review CRM with the supplied review-only account. Confirm its tenant contains no SL, RAM or customer records.
2. Inspect the operator-assisted authorisation evidence for our owned LegalHub CRM Page 1336008826271813 and the approved synthetic review Form. Show the permitted Page selection, exact form membership and a new OFF binding. Never display tokens or App Secret.
3. Verify the dedicated App/Page leadgen subscriptions and raw-body signature verification. Do not alter messaging subscriptions.
4. Use one official synthetic test submission after the exact test-ID ordering and single-writer procedure have been verified. Show the original signed Meta event, permitted Graph retrieval, one CRM Lead, the expected staff assignment and one internal notification. No advertisements or real contact data.
5. Demonstrate that a bounded replay creates no duplicate Lead/assignment notification, and another synthetic tenant cannot access this binding.
6. Disable the exact binding and show the readback OFF and stopped import without changing other integrations.

A screencast and working review access are still outstanding. The unpublished draft Form LegalHub Review Synthetic v1 exists on the owned Page; no real or synthetic Lead was created in preparing this request. All Production intake/UI/worker/scheduler/allowlists remain OFF. These notes will be replaced with the exercised exact URL, form identifier and step-by-step demonstration before the owner authorises submission.
