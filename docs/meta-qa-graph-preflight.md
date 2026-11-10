# Fresh QA Graph provenance preflight

`scripts/qa/meta-recovery/graph-preflight.mjs` is an import-only helper. It does
not acquire an authorization grant, run a CLI, print credentials, call a mutation
endpoint, start infrastructure, or read historical logs. It is pinned to the
replacement App `2523488421395251`, Page `1449474971582722`, Form
`2046130655900851`, and the Graph version `v27.0` selected in the current QA UI.

## Private inputs and caller obligations

The root caller must first verify the new isolated runtime, freeze other writers,
and obtain the owner's fresh credentials directly into its private files. Never
pass credential values in command arguments, environment dumps, URLs, tool
outputs, or a chat message. Do not reuse credentials or configuration from the
retired App/runtime.

Call `runGraphPreflight({privateRoot, assertPrivateFile, uiConfirmedAppId,
uiConfirmedProfile})`. The two UI attestations must be the exact replacement App
ID and boolean `true`, after checking the current profile and selected App.
`assertPrivateFile(path)` is mandatory: it must verify current owner, an ACL that
permits only the owner/SYSTEM/Administrators, and no reparse points, then return
boolean `true`. It is also called on the private root and empty staging files.
The Node helper independently refuses symlinks/junctions in ancestors, hardlinked
files, noncanonical paths, malformed inputs and changed file identities.

Required files directly inside the new `LegalHubStageA-<32 lowercase hex>` root:

| File | Content before preflight |
| --- | --- |
| `qa-owned.txt` | `LegalHub Stage A synthetic QA` |
| `meta-user-token.txt` | Fresh QA User token entered privately by owner |
| `meta-app-secret.txt` | Replacement QA App Secret entered privately by owner |
| `meta-page-token.txt` | Precreated, owner-only, empty |
| `meta-real-private.json` | Precreated, owner-only, empty |

The user must be the confirmed `Valentin Xtremalist` profile. The helper verifies
that exact profile name and a nonempty app-scoped ID privately. A matching name
alone does not establish token provenance: the exact issuing-App response is also
required. No User ID or name is returned publicly.

## Read-only probes and limitations

At most ten GET requests are made, without retries or paging. Native `fetch` uses
only `https://graph.facebook.com/v27.0/`, rejects redirects, sends credentials
solely in `Authorization: Bearer ...`, and bounds each response to 64 KiB. The
whole Graph sequence has a 120-second deadline. Provider response bodies and
exception text never enter the returned diagnostic object.

1. User-token `/app?fields=id,name`: exact replacement App.
2. User-token `/me?fields=id,name`: confirmed owner profile.
3. User-token `/me/permissions?fields=permission,status`: five QA permissions;
   no extra granted permission except `public_profile`.
4. User-token `/me/accounts?fields=id`: exactly the QA Page, no pagination.
5. User-token exact QA Page `?fields=id,access_token`: derive its Page token.
6. Page-token `/app?fields=id`: exact replacement App.
7. Page-token `/me?fields=id`: exact QA Page.
8. Page-token exact Form `?fields=id,name,page`: exact QA Form/Page ownership.
9. App authorization header on exact QA App `/subscriptions`: empty originals.
10. Page-token exact QA Page `/subscribed_apps?fields=id,subscribed_fields`:
    empty originals.

`access_token` in item 5 is a requested field name, never a token value in a URL.
No `debug_token`, `input_token`, `appsecret_proof`, credential query parameter,
Page discovery beyond exact selected QA membership, or token-debug fallback is
used. An API error is a blocker; security settings are not weakened.

**The `/app` alias remains an unconfirmed capability probe.** Available official
documentation could not establish its issuing-App semantics during preparation.
The helper therefore requires its actual response to match the exact replacement
App for both token types and fails closed on unsupported/error/different results.
The owner/UI evidence and returned App association must be independently assessed
before enabling a real event. This module must not be described as a documented
token debugger. It does not establish App roles, Advanced/Standard Access, Business
Verification, Page Lead Access Manager eligibility, or real lead retrieval.

## Outputs and gates

On success only the Page token and private attestation are persisted. Each file
is atomically replaced from an exclusively created staging file whose owner/ACL
is checked while still empty, before any secret is written. The attestation is
committed last. A partial write failure returns `BLOCKED`; inspect only safe
metadata, and use the approved QA cleanup procedure before retrying. An existing
nonempty output is never overwritten automatically.

`meta-real-private.json` contains only private binding metadata:
`appId`, `pageId`, `formId`, `verifiedAt`, the Page `tokenSha256`, three provenance
results, empty `originalAppSubscriptions`/`originalPageSubscriptions`, and these
closed controls: `release:false`, `approvedLeadId:null`, `leadCreatedAt:null`,
`dashboardSample:null`. Its IDs/hash must not be copied into an anonymous report.
The supervisor must separately require a fresh tuple (at most one hour old), exact
approved App and current token hash, then separately arm the permitted operation.

The return value contains fixed `PASS`/`BLOCKED`, phase, duration and request count,
plus fixed diagnostic code and bounded numeric HTTP/Graph error codes on failure.
Graph codes and subcodes preserve exact nonnegative signed-32-bit values
(`0` through `2147483647`); malformed or out-of-range values are omitted rather
than converted into a different code. HTTP status has its separate `100..599` bound.
It never contains the Page token, App Secret, User token, User ID, profile name,
provider messages, payloads, private paths, hashes or resource IDs. The root caller
must likewise suppress raw exceptions and child-process output.

`fetchImpl` and `timeoutMs` are dependency-injection hooks for unit tests. Production
must use native fetch and the default deadline. Tests use invented fixture strings,
temporary directories and in-memory HTTP responses; they call no Meta API or DB.

Passing this preflight does not open the gateway, release a lead, configure a
callback, subscribe a Page, enable Live Mode, or establish a full Meta-to-CRM E2E.
