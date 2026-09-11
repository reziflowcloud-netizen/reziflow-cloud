# Decisions

## 2026-09-11 - Conference campaign uses a dual-route funnel

Decision:

- The physical flyer has two distinct actions: the primary QR explains the
  product on a conference landing page, while the smaller secondary QR opens
  the existing demo account through a safe route.
- The demo route uses the existing shared demo organization and approved fake
  data. It does not create a conference organization or put login credentials
  or session tokens in the QR/URL.
- Complete Ukrainian and Polish copy variants exist, but the production
  language remains an owner decision.
- A full bilingual DL flyer is not the default because it would compromise
  legibility and QR hierarchy.
- Campaign tracking is provider-neutral until an analytics provider is chosen.

Rationale:

- Conference visitors differ in intent: some need context, while others want
  to see the product immediately.
- A larger information route and a faster demo route support both behaviors
  without crowding the flyer.
- Reusing the approved demo account avoids unnecessary data and setup while
  keeping the experience consistent.
- A single-language flyer protects readability at 99 × 210 mm.

Implications:

- QR artwork is generated only after landing/demo route QA.
- Development must define safe demo permissions, session expiry, concurrency,
  reset/cleanup, and abuse protection.
- The chosen language must be applied consistently to flyer, landing, demo
  orientation, alt text, and CTA labels.
- The exact UTM parameters and four required conference events are defined in
  conference/CONFERENCE_TRACKING.md.

## 2026-07-24 - Instagram visuals follow the real LegalHub CRM interface

Decision:

- Instagram production uses the real LegalHub CRM UI and logo tokens as its
  visual foundation.
- Primary visual anchors are cyan `#06B6D4`, logo/sidebar navy, light workspace
  backgrounds, white surfaces, restrained borders/shadows, Inter/system sans,
  and semantic status colors.
- An approved CRM screenshot is the source of truth and may not be regenerated,
  rewritten, or altered.
- One important UI fragment must be shown large; a full desktop screenshot must
  not be reduced to an unreadable background.
- If generative editing cannot preserve UI pixel-for-pixel, the model creates
  only the surrounding composition and the original screenshot is added as a
  locked Canva layer.

Rationale:

- The real interface makes the content recognizable, credible, and specific to
  LegalHub CRM.
- Pixel-preserving screenshot treatment prevents fake UI, misleading product
  claims, and accidental changes to visible data.
- A restrained product-led system is more readable on mobile and better aligned
  with the premium B2B SaaS positioning.

Implications:

- `VISUAL_BRAND_GUIDE.md` is the production standard for ChatGPT Image
  Generation, Canva, CapCut, and human designers.
- Earlier provisional visual colors should not override real UI/logo tokens.
- Screenshot-based content uses approved fake demo data only and requires final
  approval by Valentyn.

## 2026-07-07 - Marketing OS lives in `/legalhub-os/`

Decision:

- LegalHub Marketing OS lives only in `/legalhub-os/`.
- Marketing-memory work must not modify application code or application
  configuration.

Rationale:

- The OS should help future Codex marketing chats preserve context without
  interfering with LegalHub CRM development, deployment, database schema, or
  production behavior.

Implications:

- Future marketing agents should create and update marketing strategy, content
  drafts, campaign notes, and memory only inside `/legalhub-os/`.
- Before final responses, agents should verify the diff and confirm that no
  non-OS files changed.
