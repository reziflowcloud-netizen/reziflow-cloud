# LegalHub CRM — Conference Campaign

Last updated: 2026-09-11

Status: complete campaign brief updated with approved conference language, mobile, flyer, and demo decisions; event identity and production details still require approval.

## 1. Campaign purpose

Turn a short offline encounter into one of two measurable digital actions:

1. A conference attendee scans the primary flyer QR, understands what LegalHub CRM is, and moves to free registration.
2. A higher-intent attendee scans the secondary QR and immediately opens the existing LegalHub CRM demo account through a safe access route.

The campaign is for companies and specialists that help foreigners with legalization processes in Poland. It is not aimed at foreigners seeking legal advice.

## 2. Source-of-truth note

This campaign follows:

- owner-approved audience, CTA, demo-data, contact, tone, and claim guardrails from OWNER_INPUTS.md as stored in repository history;
- PROJECT_BIBLE.md and PRODUCT_MAP.md for product facts;
- MARKETING_POSITIONING.md, CUSTOMER_PERSONAS.md, MESSAGING.md, and OFFERS.md for positioning and offer hierarchy;
- VISUAL_BRAND_GUIDE.md for all visual and screenshot rules;
- the approved conference decisions that the landing page reuses all four
  existing website languages and localization conventions, the page is
  mobile-first, the Ukrainian flyer is the preferred production version, and
  the existing shared demo account remains interactive;
- the current task instruction that no conference-only organization may be
  created.

The following are not claimed: pricing, plan limits, integrations, legal outcomes, legal advice, GDPR guarantees, automatic billing, AI/OCR, e-signature, government integrations, or a client portal.

## 3. Decisions required before production

| Decision | Options | Recommendation |
| --- | --- | --- |
| Conference landing languages | Same four languages as the main LegalHub CRM website | Approved. Reuse the existing website language set, locale/routing conventions, translation mechanism, and visible language switcher. The language names and codes are not documented in Marketing OS: reuse existing website languages. |
| Flyer production language | Ukrainian primary; Polish alternate | Approved direction. Produce the complete Ukrainian front/back flyer first. Use the identical Polish front/back variant only for a separate Polish print batch. Never put full Ukrainian on one side and full Polish on the other. |
| Optional bilingual flyer | Shortened mirrored UA/PL layout only | Fallback for a later owner decision. The current full copy does not fit a bilingual DL layout and must not be used for this option. |
| Conference identity | Official event name, date, city, venue | Needs event input. Keep these out of final artwork until confirmed. |
| Registration destination | Current free registration route or another approved conversion route | Use https://legalhubcrm.com/register?plan=free unless the owner specifies a different route. |
| Demo permissions | Interactive shared demo session | Approved. Visitors may click, edit, change statuses, and create or delete demo data. Development must reuse the existing shared demo account, keep all data fake, and implement safe session/reset/abuse controls without making the experience read-only. |
| Analytics provider | Existing product analytics or another provider | Needs implementation decision. This brief defines provider-neutral events only. |
| Contact at the event | Booth number, meeting point, or named host | Needs event input. Do not invent it. |

## 4. Audience priority

Primary decision-makers:

- owners of legalization and migration agencies;
- operations managers;
- owners of small legalization teams.

Primary daily users and product influencers:

- legalization consultants;
- case managers;
- sales/intake employees;
- administrators coordinating cases, documents, deadlines, and payments.

Conference relevance test:

> This campaign is relevant when the attendee manages active client cases in Poland and needs a clearer way to connect leads, clients, cases, documents, deadlines, payments, tasks, and responsibility.

## 5. Core message

### Positioning

LegalHub CRM is a specialized CRM and case-management workspace for companies and specialists that help foreigners with legalization processes in Poland.

### Core promise

Bring leads, clients, cases, documents, deadlines, payments, tasks, and team responsibility into one structured workspace.

### Differentiation

LegalHub CRM is built around the lead-to-case workflow of a legalization business, not only a generic contact list or sales pipeline.

### Message hierarchy

1. Category: CRM for legalization companies in Poland.
2. Outcome: one structured workflow instead of scattered Excel files, chats, folders, and calendars.
3. Proof through product: real LegalHub CRM screens with approved fake demo data.
4. Action: learn more and register, or open the demo immediately.

## 6. Campaign offer

Primary offer:

- Спробувати безкоштовно / Wypróbuj bezpłatnie.

Low-friction proof:

- Open the existing demo account instantly through the conference demo route.

Approved supporting explanation:

- The demo contains only fake demonstration data.
- The demo is interactive: visitors may click, edit, change statuses, and
  create or delete demo data.
- The visitor does not receive a login, password, or token in the QR code or URL.
- The route opens a safe session for the existing demo account.

Do not imply that a separate conference demo organization exists.

## 7. Recommended campaign structure

### Offline entry point

Physical, double-sided, full-color DL flyer, 99 × 210 mm.

Front:

- identify the product category in under three seconds;
- state one strong operational promise;
- show one large, real product screenshot composition;
- give four short benefits;
- direct the reader to the reverse.

Back:

- qualify the audience;
- contrast scattered tools with one connected workflow;
- make QR 1 the primary action: learn more;
- make QR 2 the fast route: open the demo;
- show website, Instagram, and email.

### Primary route: learn, then convert

Flyer QR 1 → conference landing page → product understanding → demo or free registration.

The landing page should make the two actions visible in the hero and repeat them only where intent rises: after the product proof, in the conference section, and near the final contact block.

The landing page is mobile-first because the main entry comes from physical QR
scans. The first mobile viewport must contain the product category and core
promise; both actions must appear very early. The top of the page must include
the existing website language switcher with all four current website
languages.

Development must inspect and reuse the main website localization mechanism.
Do not build separate locale routing, translation storage, or a conference-only
language model. Preserve the selected website language through conference
navigation where technically reasonable.

### Fast route: experience first

Flyer QR 2 → conference demo access route → safe session in the existing demo account → immediate product view.

The first demo view should orient the visitor without inventing new
conference-specific records. Recommended entry screen: the existing demo
dashboard or another approved overview screen. Visitors may interact with,
edit, create, and delete the fake demo data. Development owns safe shared-state
handling, recovery/reset, session isolation, and abuse protection.

### Follow-up route

After a registration is completed, preserve campaign attribution and let the existing product onboarding continue. Do not add unapproved price, trial, or integration claims.

## 8. Landing-page conversion strategy

The page follows this sequence:

1. Hero: category, audience, concise promise, two CTAs.
2. What LegalHub CRM is.
3. Who it is for.
4. Operational problems it helps solve.
5. Core modules and capabilities.
6. Real screenshot proof.
7. Specialized CRM versus Excel/chats/folders.
8. Conference-specific invitation to open the demo.
9. Final dual CTA.
10. FAQ and contact.

The copy is intentionally short. Pricing tables, long feature inventories, integrations, roadmap, testimonials, and unsupported proof are excluded.

Mobile implementation rules:

- primary target: a modern phone viewport reached from a QR scan;
- accessible website language switcher at the top;
- no full desktop navigation required on mobile;
- no full desktop CRM screenshot reduced to unreadable size;
- one large, readable real-CRM crop and one product idea per screenshot block;
- thumb-friendly buttons and compact sections;
- optimize image delivery, rendering, and interaction for mobile performance;
- desktop remains supported but is the secondary layout.

## 9. Flyer distribution and on-site use

- Give the flyer to attendees who manage an agency, team, intake, or active cases.
- A staff member can say: “The larger QR explains the system; the smaller one opens a ready demo immediately.”
- Do not verbally promise unapproved integrations, migration scope, pricing, or legal/compliance outcomes.
- Keep the primary QR unobstructed and visually dominant.
- Test both final printed QR placements on at least two iOS and two Android devices before the print run.
- Keep a non-QR short URL visible as fallback.

## 10. Success criteria

Primary conversion signals:

- scans or visits attributed to the flyer landing QR;
- demo opens attributed to the flyer demo QR;
- conference landing registration clicks;
- completed registrations attributed to the campaign.

Secondary diagnostic signals:

- landing-to-demo click-through rate;
- landing-to-register click-through rate;
- demo-to-register progression, if the product can preserve attribution;
- QR 1 versus QR 2 usage;
- device and language selection, if available with valid consent.

No target percentages or lead volumes are set because baseline traffic and event attendance are unknown.

## 11. Risks and safeguards

| Risk | Safeguard |
| --- | --- |
| Flyer is too dense | Produce the complete Ukrainian flyer or a separate identical Polish variant. A later bilingual version must use shortened mirrored UA/PL copy. |
| Product looks generic | Lead with legalization-agency category and real product UI. |
| Screenshot exposes data | Approved fake demo data only; final screenshot review by Valentyn. |
| Demo URL exposes access | No credentials, session token, or reusable secret in QR or URL. |
| Interactive shared demo is modified or abused | Keep the approved interactive behavior while Development adds reset/recovery, session, expiry, concurrency, and rate-limiting controls. Do not solve this by making the demo read-only. |
| Attribution is lost across registration/demo | Persist approved UTM fields server-side or first-party; provider is not assumed. |
| Campaign overpromises | Exclude pricing, integrations, guarantees, legal advice, and unconfirmed features. |
| Landing localization diverges from the website | Reuse the same four website languages and the same existing localization mechanism; Development inspects the current implementation rather than inventing locale codes. |

## 12. Approval gates

Before publishing or printing:

- all four existing website languages are available through the reused top
  language switcher;
- Ukrainian flyer is used for the primary print batch, with Polish retained as
  a separate alternate batch;
- event name/date/location confirmed if used;
- exact flyer copy approved;
- screenshot crops use fake data and are approved by Valentyn;
- both QR destinations implemented and tested;
- interactive shared demo session, reset/recovery, concurrency, expiry, and
  abuse controls reviewed by Development;
- UTM persistence and four events verified;
- analytics provider decision recorded;
- 100% print proof and physical scan test completed;
- website, Instagram handle, and office email verified.

## 13. Deliverable map

- CONFERENCE_CAMPAIGN.md — campaign logic, audience, funnel, offer, and approvals.
- LANDING_PAGE_COPY.md — mobile-first conference copy, Ukrainian and Polish
  approved copy variants, plus a localization contract for all four existing
  website languages.
- FLYER_COPY.md — exact Ukrainian primary and Polish alternate front/back print
  variants, with a future shortened mirrored UA/PL fallback.
- FLYER_VISUAL_BRIEF.md — DL layout, screenshot composition, QR reservations, print rules, and asset checklist.
- CONFERENCE_TRACKING.md — URLs, UTMs, event definitions, QA, and Development handoff.
