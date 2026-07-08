# Decisions

## 2026-07-08 - Instagram launch starts from buyer pain, not CRM category

Decision:

- The first Instagram launch sequence should open with concrete agency pain rather than a broad "LegalHub is a CRM" or category-introduction post.
- Priority launch assets should lead with Excel case-tracking gaps, missing lead next contact, owner visibility, active-case checklist, documents in chat, deadlines in memory, and unpaid balance visibility.
- Broad category/context assets should be used after specific pains have established recognition.

Rationale:

- Migration/legalization agency owners are more likely to recognize their own chaos through specific operational questions: who owns the case, what is due, where is the document, what is unpaid, and did anyone follow up with the lead.
- Generic CRM language is safe but less effective for launch hooks.
- The product should appear as the answer to a visible workflow gap, not as a feature list.

Implications:

- `content-batches/batch-001/PUBLISHING_PLAN.md` now starts with Reel 02, Carousel 01, Reel 04, Carousel 02, and Reel 05 as the first priority assets.
- Future Instagram launch batches should keep hooks diagnostic and pain-led before introducing LegalHub CRM screens or workflow language.
- Unsupported claims about integrations, security, legal template review, automatic migration, automatic billing, or guaranteed outcomes remain excluded or marked as `Needs clarification`.

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
