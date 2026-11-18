# Limited QA subscription operations

Use only after independent review and the owner's authorization. This helper
configures/reads/restores the replacement QA App `2523488421395251` and Page
`1449474971582722`, with Form `2046130655900851` pinned in the private runtime.
The only callback is
`https://unit-handsfree-carpentry.ngrok-free.dev/api/webhooks/meta/lead-ads`.
It never creates/deletes a lead, enables Live Mode, changes permissions, performs
App Review, starts infrastructure, or touches a database.

`runMetaOps({action, privateRoot, assertPrivateFile, artifacts:{root,paths}})`
accepts only `configure`, `verify`, or `restore`. The ACL callback has the same
explicit boolean-true owner/private-ACL/no-reparse contract as Graph preflight.
Inputs are the new root's `qa-owned.txt`, `runtime.json`, `meta-real-private.json`,
`meta-page-token.txt`, and `meta-app-secret.txt`. No old logs/configuration or token
discovery is allowed. The attested App/Page/Form and current Page-token hash must
match; all three provenance results must be PASS and original subscription lists
must be empty.

Configure/verify require a nonfuture provenance attestation no older than one hour.
Restore accepts an older attestation so the expiry does not obstruct turning off
the same integration; exact binding/hash/original-empty checks still apply. Both
mutating actions require `release:false`: close the real intake first. Neither
action writes or arms `meta-real-private.json`.

Both current subscription lists are read before mutation. Each must be empty or
contain solely the exact QA configuration: App object `page`, exact callback,
`active:true`, only `leadgen`; Page only this QA App and only `leadgen`. Any foreign
App/object/callback/field, multiple entries, inactive configuration or pagination
blocks all mutations. Only one operator may change the QA settings during this
short sequence; Graph does not provide an atomic transaction across these edges.

- Configure adds the App callback/`page:leadgen` first, verifies it, then subscribes
  the Page to `leadgen` and verifies it. Already matching state is not rewritten.
- Verify only reads and requires both configurations to match exactly.
- Restore removes the QA Page installation first, confirms it is empty, removes
  only App `object=page`, then confirms it is empty. Empty state is idempotent.

All credential values are in Authorization headers. Callback and verification
token are sent only as form-body parameters to the exact App POST; no credential
query parameters are constructed. DELETE uses form-body `object=page` for the App
and the Page token's own installation edge for the Page. A mutation requires
`success:true` and exact readback. Any failure is BLOCKED with no retry or automatic
rollback. `counts.accepted` counts provider-confirmed mutation responses, not a
guarantee that a request with an ambiguous outcome had no effect. Run read-only
verify/inspect before any authorized restoration attempt.

No redirects/paging/retries are followed, at most eight requests are allowed, the
Graph sequence is bounded to 120 seconds and responses to 64 KiB. The module never
logs provider bodies, messages, headers, URLs, contact data or exception text.
Only fixed status/count/timing and bounded HTTP/Graph numeric error codes return.

The caller must freeze artifact writers and provide the explicit new public files
to scan. `scanArtifacts` runs before and after, including failure paths, using
fresh private credential values as known-secret checks. The returned summary is
also checked. This is not a scan of historical logs or a guarantee about unknown
external artifacts. A scan failure after a mutation is BLOCKED and must not be
reported as unchanged Meta configuration.

`run-meta-ops.ps1 -PointerPath <existing QA pointer> -Action <enum>` is the root
wrapper: PowerShell 7, RemoteSigned, active isolated-runtime ownership checks,
sanitized environment, absolute Node executable and `assert-private.ps1` with
captured/discarded diagnostic output. Node creates an exclusive ignored report
placeholder under the approved `.qa/meta-recovery-YYYYMMDD` directory, scans it and
the existing safe `graph-preflight-result.json`, runs the action, verifies file
identity, then replaces placeholder content with safe telemetry. Credentials are
never arguments. No wrapper or real operation is run by the mock unit tests.

Meta's own [Leads Retrieval Set-up & Checker](https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md)
identifies the App `/subscriptions` and Page `/subscribed_apps` edges and the
`page`/`leadgen` configuration. Direct reference pages were unavailable during
preparation. API success and exact readback remain required; mocks establish local
safety behavior and do not establish real Meta compatibility or delivery.
