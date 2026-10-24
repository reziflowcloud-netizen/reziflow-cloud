# Existing-Case inventory and future activation gate

**Production inventory: completed by trusted operator, user-provided evidence (2026-10-24).**
Reported aggregates: total **278**, dated **56**, overdue **33**, invalid/unlinked
responsible **54**, automation ledger **0**. Codex did not execute or independently
verify this inventory and did not access Production credentials/data. Do not rerun.
No activation/backfill is authorized. Inventory completion does not authorize rollout.
The SQL remains a historical reference only; local synthetic validation is separate.

Deployment, GET and scheduler do not activate historical Cases. New Cases and
subsequent confirmed relevant user changes use the transaction path. Unrelated
patches, unchanged dates/receipt values, service records, exact POST replays and
historical description-only corrections do not enable old controls.

If existing-case activation is later wanted, obtain explicit approval for the
selected tenants/Cases and window. Keep the selection privately outside Git.
Prepare a dry-run aggregate using this same business-date/ownership policy; resolve
unlinked ownership explicitly, without guessing users. Review stopped/no-date and
completed current-cycle exclusions. No blanket deployment or scheduler backfill.

A future separately reviewed maintenance operation should process bounded approved
Case IDs, verify tenant scope, take **Case FOR UPDATE**, reread dates/receipt/owner,
and call the same `syncDocumentActualization(tx, record, true)` in that transaction.
Retained cycle IDs preserve completed Tasks and existing notification dedupe history.
Past-due Cases get at most one current unfinished control; historical cycles are not
walked or emitted. Original trigger/watermark/recovery gates still apply. No event
or assignment emitter should be called during activation. Report aggregate results,
retain a private operation manifest, and verify no duplicate active controls/outbox.

That activation operation is **not implemented as an endpoint or scheduler hook**
and is **not authorized for execution by this development task**. Ordinary confirmed
relevant Case/DocUpdate changes already provide the requested gradual activation.
