# Decisions

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
