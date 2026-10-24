Historical corrected checkpoint; superseded by the final evidence in [admin-fallback-qa.md](admin-fallback-qa.md).

# Corrected admin fallback lock-order checkpoint

Interim review checkpoint. Full final-source API/browser/build evidence is being
rerun; do not treat historical reports as validation of this correction yet.
Typecheck and 88 regressions passed (0 failures, 2 optional DB skips).

Work identified an Organization→Case / Case→Organization inversion. Real API
trigger-barrier tests reproduced next-cycle DocUpdate/Case Task INSERT FK deadlocks
and checklist readiness deadlocks against Employee deactivation on local source
8bef7c5 (same conflicting lock order as remote checkpoint 40ae832).
The identity route also returned 500 in the reproduction; its generic error response
hid the SQL detail, so it is not counted as an independently observed deadlock.

Corrected source: local HEAD dc17974d7a0b1b79b12e394cae67dfddb9b21b2e;
src tree 515003364b1d29d3bc5137c2b1aab22e48772ece;
SHA-256 4567429ecc7ff67c26eff7d81c48b41138534d653360afcd92b5f354dc20c3f5.
All four real API races now return [200,200] with no deadlock:
DocUpdate vs deactivation, DocUpdate vs identity unlink, Case date vs deactivation,
and checklist readiness vs deactivation. Real next-cycle IDs advance correctly;
inactive/completed Tasks and their stored notifications remain intact.

Case/DocUpdate/checklist writes and new-Case creation take Organization SHARE before
Case; identity changes take Organization NO KEY UPDATE then sorted ledgered Case
locks. NO KEY UPDATE still excludes scheduler/delivery SHARE but is compatible
with ordinary FK KEY SHARE. Read-only checklist GET remains lock/activation-free.
No access filters, schema, cadence, historical activation, merge or deployment change.

Run using the existing isolated runtime and local PostgreSQL:
`node scripts/document-actualization-local.cjs node scripts/qa-admin-fallback-lock-order.mjs`.
The runner installs scoped test-only trigger barriers in the synthetic database and
removes them in finally; it must never run on a shared/Production database.
See qa/admin-fallback/lock-order.json and checkpoint-lock-reproduction.json.

Managed fallback desktop month chips now use a bounded single line with top-aligned
title and compact truncated badge; aria-label/title preserve the complete label.
Day detail and mobile keep the full label. Ordinary event chips are unchanged.
The browser runner measures chip height, top alignment and label containment at
1024px, across all 3 languages × 3 themes, plus full-label mobile coverage.
