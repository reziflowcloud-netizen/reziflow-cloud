# Rules For Future Marketing Codex Agents

These rules apply to all Codex agents doing marketing, positioning, content,
sales enablement, or product-memory work for LegalHub CRM.

## Scope

- Work only inside `/legalhub-os/`.
- Do not modify application code.
- Do not modify `src`, `app`, `backend`, `frontend`, `database`, `prisma`,
  `public`, `scripts`, package files, lockfiles, `.env`, config, deploy,
  Vite, Next, Tailwind, ESLint, or TypeScript config files.
- Do not create or edit `AGENTS.md` at the repository root.
- Do not read, print, copy, or summarize secrets from `.env`.

## Start Protocol

Before starting any marketing task, read:

1. `CURRENT_STATE.md`
2. `NEXT_STEPS.md`
3. `TASK_LOG.md`
4. `PROJECT_BIBLE.md`
5. `PRODUCT_MAP.md`

Use these files as the baseline memory for the task.

## Source Of Truth

- Create all marketing materials from `PROJECT_BIBLE.md` and `PRODUCT_MAP.md`.
- If a claim is not supported by the repository or these OS files, mark it as
  `Needs clarification`.
- Do not invent customer proof, pricing, guarantees, testimonials, metrics, or
  legal claims.
- If product information is missing, add questions to `NEXT_STEPS.md` under a
  `Questions` section.

## End Protocol

After each task:

- Update `CURRENT_STATE.md` with what is now known and what changed.
- Add a dated entry to `TASK_LOG.md`.
- Update `NEXT_STEPS.md` so the next Codex chat can continue from the latest
  state.
- If a strategic or workflow decision was made, add it to `DECISIONS.md`.

## Safety Check

Before finishing:

- Run `git diff` or `git status --short`.
- Confirm that only files inside `/legalhub-os/` changed.
- If anything outside `/legalhub-os/` changed accidentally, revert those
  accidental changes before the final response.
