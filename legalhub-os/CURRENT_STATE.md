# Current State

Last updated: 2026-09-15

## Marketing OS status

The LegalHub Marketing OS exists in `/legalhub-os/` and is used as a documentation-only memory layer for marketing, positioning, content, and product understanding.

Core OS files:

- `README.md`
- `AGENTS.md`
- `PROJECT_BIBLE.md`
- `PRODUCT_MAP.md`
- `CURRENT_STATE.md`
- `TASK_LOG.md`
- `DECISIONS.md`
- `NEXT_STEPS.md`
- `CONTENT_BACKLOG.md`

Marketing foundation files:

- `MARKETING_POSITIONING.md`
- `CUSTOMER_PERSONAS.md`
- `PAIN_POINTS.md`
- `MESSAGING.md`
- `OFFERS.md`
- `OBJECTIONS.md`
- `VISUAL_BRAND_GUIDE.md`

## Latest completed work

A complete Development specification for the approved LegalHub CRM mobile UX
was created on 2026-09-15:

- Added `MOBILE_UX_SPEC.md` as the single implementation reference for the
  eleven approved mobile patterns: Dashboard, Leads, Cases, Clients, their
  three Detail screens, Tasks, Stages, Calendar, and the More bottom sheet.
- Confirmed that mobile is a responsive presentation layer over current APIs,
  permissions, CRUD, statuses, Employees, filters, and side effects; desktop
  remains visually unchanged.
- Aligned the mobile implementation boundary with the existing project at
  `<= 768px`, with primary QA at 390 px, 414 px, and 430 px.
- Fixed the permanent five-item bottom navigation as `Пульт`, `Ліди`,
  `Справи`, `Клієнти`, `Ще`; Tasks, Stages, Calendar, and Settings map to the
  active `Ще` state.
- Replaced the discarded standalone More page with the approved 60–70% overlay
  bottom sheet containing Tasks, Stages, Calendar, Settings, account context,
  and logout.
- Documented dynamic one-line swipe rails for organization-configured
  priorities, stages, statuses, and filter tabs.
- Documented full-access and restricted-employee presentation rules without
  creating a second visual style or duplicating backend scope.
- Defined phased implementation, desktop regression safeguards, manual phone
  QA, and the approved mockup map.

No application code or configuration was changed for this documentation task.

A complete offline-conference campaign was created on 2026-09-11:

- Added a dual-route conference funnel: a primary flyer QR to a concise
  conference landing page and a secondary fast route to the existing LegalHub
  CRM demo account.
- Created complete Ukrainian and Polish copy variants for the DL flyer and
  conference landing page without choosing the final conference language.
- Kept the flyer single-language by default; bilingual remains a separate
  owner decision because the DL format cannot carry both full copy variants.
- Defined an exact 99 × 210 mm double-sided print layout, separate QR
  hierarchy, reserved QR areas, screenshot specifications, brand treatment,
  and print/digital QA.
- Defined trackable conference URLs, UTM values, four required events,
  attribution behavior, reporting, and Development handoff.
- Specified that the demo route must use the existing shared demo account and
  approved fake data, without creating a conference organization or embedding
  login credentials/session tokens in the QR or URL.
- Marked analytics provider, language, event identity, and demo-session safety
  model as implementation or owner decisions.

Conference deliverables:

- conference/CONFERENCE_CAMPAIGN.md
- conference/LANDING_PAGE_COPY.md
- conference/FLYER_COPY.md
- conference/FLYER_VISUAL_BRIEF.md
- conference/CONFERENCE_TRACKING.md

Source note:

- OWNER_INPUTS.md remains absent from the active checkout. Its owner-approved
  content was read from repository history at commit 9f7eda2 without changing
  branches or application code.

A production-ready visual brand system was created on 2026-07-24:

- `VISUAL_BRAND_GUIDE.md` is now the single visual production guide for
  ChatGPT Image Generation, Canva, CapCut, and human designers.
- The guide uses real LegalHub CRM UI and logo colors rather than the earlier
  provisional Instagram palette.
- The real UI audit confirmed cyan `#06B6D4`, deep navy UI/logo anchors,
  `#F4F5F7` workspace backgrounds, white surfaces, neutral borders, restrained
  shadows, compact semantic badges, and a system/Segoe UI typography stack
  with Inter as the closest cross-tool production font.
- The guide defines Story, Reel, feed, square, and carousel formats; conservative
  safe zones; screenshot treatment; five Story templates; five feed templates;
  three Reel-cover systems; text hierarchy; UI highlights; brand elements;
  image-generation rules; a master prompt; and example requests.
- The critical screenshot rule is documented: an approved CRM screenshot is
  the source of truth, its UI/content may not be regenerated or altered, and
  one important UI fragment must be shown large rather than shrinking a full
  desktop screen.
- The production workflow prefers generating the surrounding composition and
  placing the original screenshot as a locked Canva layer when pixel-perfect
  UI preservation cannot be guaranteed by an image model.
- Launch content remains Ukrainian-first. Approved CTAs are `Спробувати
  безкоштовно`, `DEMO`, and `AUDIT` as defined in owner inputs.
- Only approved fake demo data may appear in public CRM visuals, with final
  screenshot approval by Valentyn.

Source note:

- The requested launch files (`OWNER_INPUTS.md`, `INSTAGRAM_STRATEGY.md`,
  `content-batches/batch-001/VISUAL_DIRECTION.md`, and
  `publish-ready/week-001/*`) are present in repository history at commit
  `9f7eda2` but are not present in the current `main` checkout. They were read
  directly from that commit without switching branches or modifying
  application code.

Previous completed work:

A marketing foundation v1 was created on 2026-07-08 from the repository-audited `PROJECT_BIBLE.md` and `PRODUCT_MAP.md`.

New deliverables:

- `MARKETING_POSITIONING.md`: positioning, differentiation from ordinary CRMs, target and non-target audiences, slogan options, and one-sentence product descriptions.
- `CUSTOMER_PERSONAS.md`: five target personas covering agency owners, consultants, case managers, small agency owners, and operations managers.
- `PAIN_POINTS.md`: categorized customer pains across operational chaos, communication, documents, deadlines, team management, analytics, and sales/leads.
- `MESSAGING.md`: marketing message library for Instagram, website, LinkedIn, YouTube, CTAs, short descriptions, and comparisons against Excel, WhatsApp, and generic CRMs.
- `OFFERS.md`: launch offer concepts including free demo, workflow audit, early access, onboarding, migration, and launch access.
- `OBJECTIONS.md`: objection-handling matrix with safe answers, proof points, follow-up questions, and clarification flags.

All claims were kept within the guardrails from `PROJECT_BIBLE.md` and `PRODUCT_MAP.md`; uncertain claims are marked `Assumption` or `Needs clarification`.

A read-only repository audit was completed on 2026-07-07 to expand:

- `PROJECT_BIBLE.md`
- `PRODUCT_MAP.md`

The audit reviewed app routes, Prisma models, product-state docs, marketing/pricing copy, billing logic, access control, lead/client/case APIs, document/template flows, integrations, import/export, referral partner flows, and settings modules.

No application code was intentionally changed.

## Known product context

- LegalHub CRM is a SaaS CRM/case-management product for legalization agencies in Poland.
- The app combines a public marketing site, registration/login, and an internal multi-organization CRM.
- Core workflow: public/request lead -> lead qualification -> client -> case -> documents -> deadlines/tasks -> payments/debt -> responsible person -> reporting.
- Main modules confirmed from the repository: public site, auth/signup, dashboard, leads, clients, cases, stages, tasks, calendar, employees, settings, users/access, billing, referrals, partner portal, document templates, import/export, integrations, storage.
- Important access distinction: app `User` roles and restricted access are not the same as the business `Employee` responsible person used on leads/cases.
- Confirmed user/access concepts: owner, admin, employee, restricted employee, system admin, business employee, referral partner, website visitor.
- No end-client portal was found in the current route map.
- Billing plans/limits exist in code, but external payment processor/subscription automation is not confirmed.
- Integrations exist, but Meta/Instagram/Facebook/Telegram/Google Sheets/Dropbox claims need setup and production-readiness qualification.

## What still needs confirmation

- Conference material language: Polish, Ukrainian, or a bilingual landing
  experience. Do not produce a full bilingual DL flyer by default.
- Official conference name, date, city, venue, and booth/meeting location.
- Final approval of the Ukrainian or Polish conference copy.
- Development choice for safe public demo sessions: read-only or
  controlled/resettable, including TTL, concurrency, abuse protection, and
  cleanup.
- Analytics provider, attribution expiry, consent behavior, and event
  implementation.
- Final QR generation only after the landing and demo routes pass QA.

- Approval or adjustment of the drafted ICP, buyer personas, positioning, and brand voice.
- Approved public pricing, plan packaging, VAT/tax language, and trial terms.
- Production readiness of each integration.
- Meta App Review / Advanced Access status.
- Customer proof, testimonials, metrics, and case studies.
- Approved security/compliance/privacy claims.
- Approved document-template claims.
- Channel strategy and campaign language priorities.
- Public proof points to support the new messaging foundation.
- Which launch offers are commercially approved and how they are delivered.
- Whether the unmerged Instagram Marketing OS files should be restored or
  merged into the active branch so future chats can use their paths directly.
- Final Canva/CapCut master templates and the approved screenshot crop library.

## Safety notes

- This OS is documentation only.
- Future marketing-memory work should stay inside `/legalhub-os/`.
- Application code and configuration must not be changed for marketing-memory tasks.
- Do not read or print `.env` secrets.
