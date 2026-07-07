# Decisions

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
