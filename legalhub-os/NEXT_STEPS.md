# Next Steps

Last updated: 2026-09-11

## Immediate conference-campaign tasks

1. Choose the conference material language: Polish, Ukrainian, or bilingual
   landing page. Produce only one full-language DL flyer version.
2. Confirm the official conference name, date, city, venue, and booth or
   meeting location if these should appear.
3. Approve one exact flyer copy variant and the corresponding landing-page
   copy.
4. Capture the required dashboard, leads, case, documents, tasks/calendar, and
   payments screenshots from the existing demo account using fake data only.
5. Send every screenshot and screenshot-based composition to Valentyn for
   final public-use approval.
6. Ask Development to implement the conference landing page and the safe
   /conference/demo route for the existing demo account.
7. Decide the demo session model, TTL, allowed actions, concurrent-use
   behavior, reset/cleanup, rate limiting, and demo-to-registration transition.
8. Choose the analytics provider and implement the four conference events and
   UTM persistence defined in conference/CONFERENCE_TRACKING.md.
9. Generate final QR artwork only after both routes and UTM redirects pass QA.
10. Produce and scan-test the final imposed print PDF and a 100% physical
    proof on multiple iOS and Android devices.

## Immediate visual-production tasks

1. Decide whether to restore/merge the Instagram Marketing OS files from commit
   `9f7eda2` into the active branch so future chats can read their documented
   paths directly.
2. Approve `VISUAL_BRAND_GUIDE.md` as the production standard.
3. Build Canva masters for the five Story types, five feed-post types, and
   three Reel-cover types defined in the guide.
4. Build CapCut presets for 9:16 screenshot crops, subtitles, cursor focus,
   one-feature zooms, and the approved CTA end card.
5. Create an approved screenshot crop library using fake demo data: dashboard,
   leads/next contact, case header, documents, deadlines/tasks, payments/debt,
   and calendar.
6. Validate every master at phone size and inside the Instagram publishing
   preview, especially Reel cover crops and bottom UI overlays.
7. Produce the Day 1 Reel cover and Story sequence with the exact Ukrainian
   copy from the publish-ready brief.
8. Send all screenshot-based launch assets to Valentyn for final approval.

## Recommended next tasks

1. Review and approve or edit `MARKETING_POSITIONING.md`, especially the main positioning, slogan options, and one-sentence product descriptions.
2. Choose the primary ICP for the next campaign from the drafted personas in `CUSTOMER_PERSONAS.md`: migration agency owner, small agency owner, operations manager, legal consultant, or case manager.
3. Validate public pricing and packaging: Free, Starter, Pro, Agency, VAT/tax wording, trial length, limits, and included features.
4. Approve the first launch offers from `OFFERS.md`, including what is free, what is manual, what is plan-specific, and what support is included.
5. Build an approved integration-claims matrix: webhooks, Meta/Facebook/Instagram, Telegram, Google Sheets Apps Script, Cloudinary, Dropbox.
6. Approve security, privacy, storage, GDPR, data-deletion, and document-template wording before public campaigns.
7. Turn the approved positioning and messaging into a landing-page copy brief or `LANDING_PAGE_COPY.md`.
8. Create a sales discovery script from `CUSTOMER_PERSONAS.md`, `PAIN_POINTS.md`, `OFFERS.md`, and `OBJECTIONS.md`.
9. Define the onboarding and migration service scope for agencies moving from Excel/WhatsApp.
10. Add proof points when available: testimonials, customer quotes, active agency count, usage metrics, screenshots, demo video, case studies, or founder credibility.

## Confirmed launch inputs

- Primary launch language: Ukrainian.
- Russian may be added later as a secondary language.
- Primary CTA: `Спробувати безкоштовно`.
- Fallback CTA: `DEMO` in Direct.
- Diagnostic CTA: free workflow audit / `AUDIT`.
- Public product screenshots may use only approved fake demo data.
- Public pricing is not used during launch.
- Integrations are not mentioned unless separately confirmed.

## Questions still requiring approval

- Which conference language option is approved?
- What official conference identity and on-site location may be printed?
- Should the public demo be read-only or controlled/resettable?
- What analytics provider, consent approach, and attribution expiry should be
  used?
- Is the existing free registration route the final conference conversion
  destination?

- Which ICP matters first for revenue and testimonials?
- Are the current Free, Starter, Pro, and Agency prices/limits approved for public marketing?
- Is VAT included in displayed pricing?
- Is billing self-serve or contact-sales/manual today?
- How long is the production trial for paid plans?
- Which integrations are production-ready and supported by the team?
- Has Meta App Review / Advanced Access been completed for lead and message workflows?
- Should Google Sheets be described as Apps Script/webhook rather than native integration?
- Is Telegram intake officially supported or an advanced/manual setup?
- What proof is available now: customer quotes, screenshots, demo video, usage data, case studies, founder credibility, before/after migration examples?
- Which claims about storage, privacy, security, GDPR, and data deletion are approved?
- Are document templates legally reviewed?
- Is a client portal planned or intentionally out of scope?
- Are automatic billing, automatic partner commissions, departments/branches, AI/OCR, e-signature, or government integrations on the roadmap?

## Best next deliverable

Recommended next deliverable:

- Development implementation of the conference landing/demo routes and
  production of the approved single-language DL flyer, followed by physical QR
  testing.

Suggested sections:

- Language and event-data approval.
- Landing-page implementation from conference/LANDING_PAGE_COPY.md.
- Safe existing-demo-account access route.
- UTM and event QA.
- Locked screenshot assets.
- Print proof and physical scan test.
