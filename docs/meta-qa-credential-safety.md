# Meta QA credential handling

This procedure applies to an isolated internal pilot and later client integrations. It does not authorise access to a client Page, Production, publication, new permissions or a test.

## Cause addressed

The earlier incident record identifies an unsanitized Graph API Explorer UI observation. The browser snapshot serialized a populated token textbox into tool output. This is a sufficient technical explanation without reopening the old token, raw session history or screenshots. Clearing a textbox or deleting a local file does not revoke an issued token.

## Obtain and store credentials

1. Confirm the exact App, authorised user and allowed Page/Form before credentials are issued. Keep each organisation's authorisation separate. App access credentials belong to that App; never reuse another App's secret or a shared client's token.
2. The owner enters new values directly into an ACL-restricted local store outside Git, cloud-sync exports and public reports. The assistant receives only a path and readiness flags. Never send values through chat, tool arguments, command-line arguments, clipboard-read output or environment dumps.
3. Do not obtain values through a browser DOM snapshot, whole-page text extraction or screenshot. At credential screens observe only known public labels and boolean readiness state. Do not access password managers or authentication dialogs automatically; the owner completes them.
4. Put Graph credentials in the Authorization header. Do not put a token or App Secret in a URL, query string, shell argument or debug message. Do not copy the legacy GET debug_token/input_token pattern. If a required provenance check has no documented safe route, stop that operation instead of weakening the rule.
5. Do not enable cloud Full Capture, local inspection, replay or remote agent management. Capture only bounded method/status/count/timing diagnostics; no request/response bodies, contact fields, signature values or complete URLs/query strings.

## Generate and check artifacts

- Import `publicTelemetry()` from `scripts/qa/meta-recovery/secret-safety.mjs` for public diagnostics and anonymous JSON results. Its fixed schema accepts only approved phase/status labels, HTTP/numeric Graph codes, bounded durations and named aggregate counts. Unknown fields, free text and identifiers are rejected.
- Use `errorTelemetry(error, phase)` for failures. It never reads `error.message`, stack, cause, response body, headers or URL. Do not call console.error(error), serialize provider errors, or append a raw error to a safe diagnostic.
- The module itself has no stdout/stderr output or implicit credential loading. Each CLI driver must catch its top-level failure and print only the result of `errorTelemetry`; a safe helper does not make an unrelated raw exception handler safe.
- Run `assertPublishableText(text, {knownSecrets})` before writing a result. Supply current QA secret values privately from the restricted store; do not print that array. Detection includes known values and common encodings, Meta-token patterns, authorization headers, credential URLs, identifying keys, contact patterns and private Windows paths.
- Run `scanArtifacts({root, paths, knownSecrets})` on the exact newly created publishable text files before and after each external test. It returns aggregate counts only. It refuses paths outside the explicit root, symlink/junction ancestors, hardlinks, non-files, oversized files, invalid UTF-8, binary controls and files that change during inspection. Freeze writers first.
- The scanner is an additional safeguard, not a proof that arbitrary prose contains no personal data: an unlabelled person's name cannot be exhaustively recognized by a regular expression. Generate result content from the strict schema; manually review any necessary static prose. Do not submit binary/oversized artifacts as though a skipped scan passed.
- Do not point the scanner at credential stores, historical session logs, backups, source trees or unrelated projects. Its job is to validate explicitly selected new publishable artifacts, not search for or copy secrets.

Example using no credential values:

```js
const safe = publicTelemetry({
  phase: 'webhook', status: 'PASS', httpStatus: 200,
  durationMs: 20, counts: {requests: 1, leads: 1},
})
const text = JSON.stringify(safe)
assertPublishableText(text, {knownSecrets: currentPrivateValues})
// Write only this text to the chosen result file, then scan that exact file.
```

## Closure and incident response

Close intake, worker, binding and ingress before shutdown. Remove temporary local copies using the adopted ownership/path/runbook controls. Track editor, clipboard, export and operator copies separately; do not claim that local removal erases provider or tool-history records.

If any credential is exposed, immediately stop the test and QA ingress. Do not continue using it. Record only a non-identifying incident status and arrange separately authorised revocation for the exact App/user grant. App Secret rotation alone is not proof that the user grant was revoked. Verify the official outcome without replaying the compromised token when the approved procedure forbids its use.

Keep the adopted per-cycle cleanup deadlines. New work does not reset obligations for earlier artifacts. Before SL or another organisation, confirm the client's explicit Page/Form/Leads Access scope, required Meta access level/review, processing instructions and approved credential owner; internal QA approval does not authorise a client connection.

Local verification: `node --test scripts/qa/meta-recovery/secret-safety.test.mjs`. Tests use planted values, temporary fixtures and no Meta, ngrok, database or other external calls.
