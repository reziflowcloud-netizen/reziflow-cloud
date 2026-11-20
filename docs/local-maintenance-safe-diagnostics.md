# Safe native PostgreSQL diagnostics

The original diagnostic patch `03a79a8340bd21727f08012dd1289bfa0e8c658c`
starts from main `41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04`.
This candidate integrates that reviewed diagnostic diff onto combined PR22 head
`1d1d292222d6181c0fc096119ccdbc21921ef01b`, retaining M1/M2 and the four Stripe
migrations. Its branch `qa/stripe-maintenance-diagnostics-20261120` is explicitly
excluded from Vercel deployment. All runtime diagnostic code is unchanged from
the original patch; only integration documentation and branch exclusions differ.
It addresses loss of diagnostic information, not the unproven cause of failed
Production run `c99b5f3e3b6b`. No Production interaction or retry is authorized.
No application, Stripe, migration, structure SQL or identity ordering changes.

## Capture and privacy boundary

`core.ps1` loads `process-diagnostics.ps1` and its small C# process reader.
Direct psql and the existing bounded Session tool use the same implementation.
Both output streams drain concurrently. Retention is capped at 4 Mi characters
for stdout (the existing Session ceiling) and 8192 characters for stderr; excess
input is discarded while draining. Raw stderr never enters an exception,
console, file, report or sealed plan. It exists only in bounded process memory.
Success returns no failure diagnostic; errors are attached to that exception,
not stored in a global last-error slot. Query-file cleanup cannot replace an
earlier native error; its failure is represented by a boolean.

The private ACL-protected blocked report receives a copied, closed schema:

| Field | Meaning |
| --- | --- |
| stage | Closed operation enum, including STRUCTURE_PROOF |
| connectionMode | Direct or Session process path |
| nativeExitCode | Actual int32 process exit, or null if unavailable |
| durationMs | Stopwatch elapsed time for the native operation, including startup/connection/drain; not server-only execution time |
| sqlState | Strictly validated supported structured SQLSTATE, otherwise null |
| timeoutCategory | PROCESS_DEADLINE only when this process deadline was enforced; otherwise UNKNOWN |
| errorCategory | Closed conservative classification, otherwise UNKNOWN |
| runnerFailureCode | Actual unchanged symbolic refusal code |
| operationFailureCode | Original operation's existing symbolic failure code |
| cleanupFailed | Boolean; no exception text or path |

No host/user/object names, SQL text, connection strings, messages, detail, hint,
context or raw stdout/stderr are copied into this diagnostic. The public Runner
console remains the existing symbolic refusal only. Existing report fields and
private ACL/atomic report writing remain in force.

## SQLSTATE provenance and uncertainty

psql receives `VERBOSITY=sqlstate` and `SHOW_CONTEXT=never`; `-X`, `-w` and
`ON_ERROR_STOP=1` remain. The parser accepts only an entire single error frame,
native exit3, this invocation's exact input filename (including Windows forward
slash normalization), a positive line number, a verified severity token and a
supported SQLSTATE. It never searches arbitrary error text for five characters.
ERROR and the observed Russian severity are supported. Unknown/localized formats,
additional messages, foreign paths, unknown states and truncation stay UNKNOWN.

PostgreSQL documents that [psql verbosity](https://www.postgresql.org/docs/17/app-psql.html#APP-PSQL-VARIABLES)
can emit SQLSTATE. The [libpq implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/interfaces/libpq/fe-protocol3.c)
retains localized severity and can fall back to message text when structured
fields are absent; that fallback is not accepted by this parser.

Exit1 is UNKNOWN. Exit2 supports the broad CONNECTION category, including an
authentication refusal, but cannot by itself distinguish TLS or authentication.
57014 means QUERY_CANCELED, not proof of statement_timeout; 55P03 means
LOCK_UNAVAILABLE, not proof of lock_timeout rather than NOWAIT. See the official
[error-code appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html).
No timeout is raised and no permission is widened to improve diagnostics.

## Safety and regression scope

The Session deadline remains150s, drain and termination waits10s, stdout ceiling
unchanged. Direct psql gains the same finite deadline/ceiling. Connection5s,
lock5s, initial statement120s and read-only-query statement30s remain unchanged.
Read-only transactions, snapshot behavior, TLS/role/ACL/identity, migration/SHA,
backup, structure, seal and cleanup gates remain. Cheap early identity/version
verification is a separate finding, not included in this diagnostic change.

Main does not contain PR21's M1/M2 fixes. Do not import those fixes into this
minimal patch, weaken restore equality, or label a baseline failure PASS.
Compatibility is tested separately on a local synthetic checkout of reviewed
combined head `1d1d292222d6181c0fc096119ccdbc21921ef01b` plus this runtime patch.
That local fixture does not modify PR22 and cannot authorize Production.

## Synthetic execution

`pwsh -NoProfile -File tests/local-maintenance/process-diagnostics-tests.ps1`
runs parser/canary/buffer/deadline/reset models without a database.
Add `-WithPostgres -PostgresBin <verified local native bin>` for real syntax,
permission, missing-object, statement/lock timeout, wrong-password, stopped-server
and success cases through both process paths. Initial-query fault injection uses
the real Invoke-Preflight/Get-CheckedState/report control flow and a real local
permission failure; it changes neither the production query nor system catalog
privileges. Owned clusters stop with existing guards. Synthetic private reports
are retained locally; no client raw stderr file is created.

Any blocked report now requires `INDEPENDENT_DIAGNOSIS_AND_NEW_OWNER_AUTHORIZATION`.
That field grants no permission. A newly reviewed binary still requires a new
explicit owner authorization before any Production connection.
