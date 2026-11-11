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

## Explicit closed refresh before a test

When the attestation ages out during setup repairs, the owner-authorized root may
use `run-preflight.ps1 -RefreshClosed` with the existing owner/App confirmation
arguments. The module flag is strictly boolean `refreshClosed:true`. This does
not generate credentials, run a test lead, change subscriptions or extend a
deadline on the strength of old evidence alone.

Refresh requires the same existing private User token, App Secret and Page token;
the old attestation must match the exact replacement tuple/current Page-token hash
and three provenance PASS results. It must be closed: `release:false`, null
approved Lead/time/Dashboard sample, and no create-attempt timestamp. The original
App/Page subscription lists must be empty. A future or malformed old verification
timestamp is rejected; an expired timestamp is allowed only to initiate the full
new checks.

All ten Graph checks are then repeated, including both actual App associations,
owner/scopes, exact sole selected QA Page, Page/Form identity and both currently
empty subscription edges. During refresh the User-token exact-Page request asks
only for `id`, not `access_token`. All subsequent Page-token probes use the
original stored Page token, whose current App/Page/Form access must pass again.
No returned alternate credential is adopted; the stored Page token is unchanged.
An expired User token yields numeric Meta error
codes and BLOCKED; there is no new-token or debugger fallback.

Only after all checks pass may the attestation receive a new `verifiedAt`. Its
private file identity must still match the initial snapshot. The Page-token file
is checked again and is not rewritten. A concurrent create-attempt/gate/state
change blocks the write. The prior technical test proof and check time are
preserved, `createAttemptAt` stays null, and `closedAt`/`earliestClosedAt` preserve
the earliest known closure rather than restarting cleanup deadlines. Unknown
private properties are not copied into the refreshed attestation.

The wrapper writes a new ignored `graph-preflight-refresh-<UUID>.json` report,
scans it together with the original `graph-preflight-result.json`, and leaves that
initial proof untouched. Nonempty outputs remain refused without the explicit
refresh path. This refresh is unavailable once a lead attempt has begun or any
callback/subscription is configured; it does not weaken the one-hour provenance
or ten-minute lead gate used by the actual supervisor.

`fetchImpl` and `timeoutMs` are dependency-injection hooks for unit tests. Production
must use native fetch and the default deadline. Tests use invented fixture strings,
temporary directories and in-memory HTTP responses; they call no Meta API or DB.

## Explicit closed credential renewal after expiry

If Meta confirms that the stored Page credential has expired, the owner may enter
a fresh User token for this same QA App and scope directly into the existing
private `meta-user-token.txt`. Only after that separately authorized owner action,
use `run-preflight.ps1 -RenewClosedCredentials`. This flag is mutually exclusive
with `-RefreshClosed`; the strict module option is
`renewClosedCredentials:true`. It requires explicit public `artifacts:{root,paths}`
for scans and all the same closed old-proof/current-hash/no-attempt/empty-original
checks. The old Page token is read only for its private hash and known-secret scan;
it is never used for an HTTP request in this mode.

The existing User token and App Secret inputs are not overwritten by the helper.
All ten native probes must pass using the newly supplied User token and a
prospective Page token retrieved from the exact QA Page. The prospective token
must prove the exact replacement App, QA Page and Form and currently empty Page
subscription edge before it can replace the expired credential. The existing
App Secret separately proves the empty original App subscription edge. Any
provenance/expiry error returns safe numeric diagnostics and leaves existing
Page/proof outputs unchanged; no automatic token grant or fallback is attempted.

Artifact scans include both the previous and prospective Page credentials, the
current User token and App Secret, before committing and afterward, including
failure paths. Root wrapper scans also include the other current QA runtime
secrets. File identities are rechecked before either output is replaced. Only
after all checks succeed is the Page-token file atomically replaced, followed by
an atomic attestation replacement. These are two separate filesystem commits:
if the second unexpectedly fails after the first, the old proof/current-token
hash mismatch blocks any gateway or worker use. That partial outcome requires
explicit safe recovery; it is never reported as PASS or retried automatically.

Renewal preserves closed gates, prior test metadata and the earliest closure T0.
It never resets a create-attempt marker or cleanup deadline. The wrapper writes a
unique ignored `graph-preflight-renewal-<UUID>.json`; it does not overwrite the
initial proof. Initial setup and same-token closed refresh retain their separate
behavior. Mock tests use invented expired/prospective tokens; they do not confirm
real token validity or run any Graph call.

Passing this preflight does not open the gateway, release a lead, configure a
callback, subscribe a Page, enable Live Mode, or establish a full Meta-to-CRM E2E.
