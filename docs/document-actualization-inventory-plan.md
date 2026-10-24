# Existing-Case inventory and future activation gate

**Production inventory: NOT EXECUTED.** No production credentials were accessed or
copied to Cloud. No existing-case activation/backfill was executed.

Trusted operator gate, before a separately approved rollout:

- Verify the intended production project/database privately using existing trusted
  access, preferably a read-only role. No new Cloud access or secret transfer.
- Run `scripts/inventory/document-actualization.sql` through the trusted connection:
  `psql -X --set=ON_ERROR_STOP=1 --file=scripts/inventory/document-actualization.sql`.
  Connection selection stays private; do not put credentials in command arguments.
- The script begins a **REPEATABLE READ READ ONLY** transaction, sets a 30-second
  statement timeout and fixed search path, emits one aggregate count row, then
  rolls back. It reports total/stopped/genuine-date/fallback/no-date/managed-cycle/
  unactivated-with-date/overdue/unlinked-owner counts. No Case IDs, names, documents,
  credentials or customer rows are selected for output.
- SQL syntax/execution was validated only on the isolated synthetic local DB.
  This is not an inventory of Production and must not be described as one.

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
