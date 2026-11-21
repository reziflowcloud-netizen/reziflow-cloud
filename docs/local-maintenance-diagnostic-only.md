# Diagnostic-only candidate — REVIEW ONLY

Base: PR23, `0625185be5c0205303f31cd9bb18e2243b5270cc`.
This stacked Draft changes only maintenance tooling/tests/docs and its branch exclusion.
It does not authorize a Production connection. Production eligibility is **NO** until
independent review, completion of the private trust/identity prerequisites, and a new
explicit one-time owner approval of one exact execution envelope.

## Execution contract

Use an independently authenticated, protected, absolute Windows PowerShell **7 Core**
path with `-NoProfile -File scripts/local-maintenance/diagnostic-only.ps1`.
There is no BAT/PATH lookup, PS5 fallback, ExecutionPolicy option, policy mutation,
SQL argument, query-file argument, retry, ledger query, backup/restore, PREFLIGHT,
APPLY, migration seal, deployment, or application operation in this entrypoint.
An envelope is a diagnostic intent, **not a sealed migration plan**.

`Prepare` reads local protected files and writes an immutable private diagnostic
envelope with CreateNew. It does not start psql or contact a database. `Execute`
reconstructs the SQL, revalidates source/config/environment/client/runtime hashes,
target pins, Direct transport and ACLs, checks expiry and the reviewed envelope hash,
requires an external owner-approval reference and an interactive confirmation for
Production, and atomically spends a run-ID marker before starting the client.
A syntactically valid reference/confirmation is not proof of external authorization.
The owner decision and independent review must actually exist.

The production specification also binds the exact candidate Git SHA and absolute
trusted Git binary. Local HEAD, clean status and repository origin are checked
without hooks/fsmonitor/global config or network. Config, specification, envelope,
temporary SQL and reports must be ACL-protected, local, reparse-free and outside Git.
No credentials, PATH, policy or installed-tool permissions are changed.

One `psql.exe -w -X -q -A -t -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate
-v SHOW_CONTEXT=never -f <private generated file>` runs with a cleared child-only
environment. Its single host address is an independently pinned numeric IPv4 (v1)
or explicitly selected numeric IPv4/IPv6 (v2);
PGHOST retains the expected hostname for `verify-full`, PGSSLMODE is verify-full,
PGSSLROOTCERT is the hash-bound private CA file, and GSS encryption negotiation is
disabled. No DNS fallback, service file, startup rc or inherited PG override is used.
Only the existing v1/IPv4 loopback synthetic profile permits TLS disabled.
The protected v2 IPv6 loopback fixture requires verify-full TLS as well.

Maximum: **one database connection attempt, two read-only SELECT statements,
six SQL statements**. Nested SELECT expressions/CTEs belong to the same top-level
statement. Fixed psql control commands are client-side, not SQL statements:

1. BEGIN REPEATABLE READ READ ONLY.
2. SET LOCAL statement_timeout = 30s.
3. SET LOCAL search_path = pg_catalog,public.
4. Identity SELECT: exact database name/OID, current/session role, system identifier,
   server version, backend TLS and transaction/timeout settings. `\gset` captures
   only its boolean in the client, without printing identity values.
5. Only if that boolean is true: the original reviewed, role-bound structure-proof
   SELECT, sent once with `\g NUL`. Results are discarded, not captured or saved.
6. ROLLBACK. A mismatch skips statement5. On SQL/native failure psql exits and the
   read-only transaction ends with the connection; no retry or recovery command runs.

Connection timeout **5s**, lock timeout **5s**, each statement timeout **30s**,
child deadline **150,000ms**, unchanged bounded output drains/process-tree cleanup.
The existing cleanup waits can add up to30s after the child deadline; they do not
extend statement execution or start another connection. Envelope expiry is24h.
The run-ID marker is retained even on failure; renaming/copying an envelope cannot
reuse the ID. A different ID is a different operation requiring a new owner decision.

## Frozen SQL and private specification

The canonical LF UTF-8 structure-proof generator from reviewed PR23 has SHA256:

`0532f81930ead043012c1d88d65719577084a46980ce047c0c1c72062e844085`

The original generator must match this constant. The application role is validated
against the reviewed identifier alphabet before the original substitution. Prepare
freezes three further SHA256 values: role-bound original payload, identity SELECT
and complete six-statement script. Execute reconstructs and compares all three.
No user-supplied SQL field/file is accepted. Actual expected identity/role strings
and their concrete SQL remain private. Missing pins are not inferred from DNS,
the first connection, a client version or an old failed run.

Private specification schema (all paths absolute and local):

- version:1 or2; configPath; pwshPath; pins. v1 retains its original IPv4 semantics.
- pins: database, maintenanceRole, applicationRole, databaseOid,
  systemIdentifier, serverVersionNum. Every identity pin remains mandatory.
- v1 address pin: ipv4 only. v2-only address fields in v1 are rejected; IPv6 is
  never inferred from a v1 field or envelope.
- v2 address pins: addressFamily (exact IPv4 or IPv6) and address (one canonical
  numeric literal). ipv4/ipv6 aliases, lists, DNS names, brackets, scope IDs,
  mapped IPv4 and family mismatches are rejected. No fallback is added.
- Production additionally: caSha256, candidateCommit, gitPath,
  trustReviewReference (independent GitHub review comment), toolReferences.
- v2 Production additionally: addressAttestationFile and addressAttestationSha256.
  This private ACL-protected dossier must match version:1, addressFamily, address,
  hostname, providerReference (HTTPS) and reviewReference (the same independent
  trustReviewReference). Its hash is bound both in the specification and envelope.
  Syntax/matching values DO NOT authenticate a provider statement: source,
  project association, freshness and provenance require independent review.
- Each tool reference: path, independently established sha256 and independentSource.
  Required closure includes pwsh, Git, psql, all adjacent psql DLLs and all adjacent
  runtime DLLs. Protected installation ownership/write ACLs and ancestors are checked
  conservatively; unprivileged write/replacement capability blocks.

The reference manifest's provenance and installation/dependency coverage require
independent human assessment. A self-authored manifest of current hashes or a URL
string is not an authenticity proof. Do not turn unknown prerequisites into PASS by
populating them with local hashes. These checks are not a sandbox against an operator
who already controls credentials and can edit executable source or approval records.

## Minimal Direct IPv6 extension

This extension starts from independently reviewed PR24 HEAD
`1700f46d0496ac328ccd80811e78a7b0651720fa`. The original proof SELECT source,
identity criteria, read-only transaction, counts, deadlines, capture, safe-output,
owner approval and one-shot protections are unchanged. v1 generated SQL is checked
byte-for-byte against fixed synthetic/Production model hashes from that HEAD.

v2 adds a validated transport comment to the generated script and an explicit
transportSha256 binding of `addressFamily|address`. The SELECT payloads are not
modified. Envelope version must equal specification version; old source/script/
specification bindings cannot be reinterpreted as a new IPv6 target. A changed
family/address requires new hashes, offline Prepare and independent approval.

Production IPv6 admits only conservative native global-unicast destinations in
2000::/3, excluding IETF protocol assignments2001::/23, documentation2001:db8::/32
and3fff::/20,6to4 2002::/16 and AS112 2620:4f:8000::/48. Other non-global,
unspecified, loopback, link-local, multicast, translation and mapped/scoped forms
are excluded. This is an intentionally narrow eligibility filter, not a provider
ownership/routability attestation. Expansion needs separate review.
See [IANA's registry](https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml).

The one raw numeric IPv6 goes in PGHOSTADDR, without brackets or an address list.
PGHOST stays the attested hostname for verify-full, never the IP literal.
[libpq documents IPv6 hostaddr and hostname verification](https://www.postgresql.org/docs/17/libpq-connect.html#LIBPQ-CONNECT-HOSTADDR).
No DNS lookup is used to discover/fill an expected pin, and no IPv6-to-IPv4 or
Session fallback occurs. CA binding and all exact database/role/cluster/version
requirements remain mandatory.

Synthetic ::1 is limited to version2/targetKind synthetic, hostname localhost,
prefixed synthetic database, non5432 owned port, protected fixture root beneath
privateDirectory/isolated, the reviewed runner ownership marker, matching fixture
descriptor and postmaster startup metadata. It also requires a hash-bound test CA,
verify-full and backend TLS. Production paths never accept this exception. No core
Runner loopback/backup/restore/guard behavior is widened.

The disposable IPv6 suite creates an ephemeral CA and DNS-only localhost server
certificate, never installs a trust-store certificate, and exercises the actual
public entrypoint. Server traces prove ::1 peer, one backend and6/5/4 statements
for success/mismatch/first-query permission error. A same-CA wrong-host certificate
must fail before SQL. A separate phase leaves IPv4 available while ::1 is absent;
the IPv6 invocation must fail rather than fall back. Marker/hash/version negatives
and secret/fail-closed output checks remain mandatory on PG17.12 and18.7. An
unavailable real IPv6 fixture is a failed/blocked test, never a skipped PASS.

WARP is transport only. Its Split Tunnels/profile and network/UDP restrictions
must permit the pinned IPv6. Its egress/source IP may differ from the destination
pin and must satisfy provider restrictions. DNS/WARP success does not establish
pin/endpoint ownership, CA provenance, toolchain trust or current database identity.
No WARP/Supabase setting changes or Production checks are part of this extension.

## Current offline prerequisites

**TRUST BLOCKED.** The current absolute PowerShell runtime is7.6.9, in an
operator-writable cache. Offline WinVerifyTrust with cache-only URL retrieval passed
its embedded signature and four inspected runtime dependency signatures. Revocation
was not checked and no online retrieval was allowed. Inspected configured PostgreSQL
files had no embedded signature; catalog signing was not established. Configured
psql `--version` locally reports18.6; this is not the Production server version.
No independent known-good hash/package reference was available. Matching old local
hashes and version metadata does not close authenticity or replacement risk.

Fresh conservative raw-SID PATH inventory:36 entries,21 with operator/group Allow-write
ACEs,0 unverified entries,0 broad-group Allow-write matches,0 inspected executable
overrides in the candidate working directory. This is not an effective-access or
anti-tamper proof. No installation, permissions, PATH or Execution Policy was changed.

**EXPECTED OFFLINE:** one existing private Direct Production profile; configured
hostname/database/login/application role, verify-full/backend-TLS policy, CA path
and locally recorded CA fingerprint. Config/CA hashes are unchanged, private ACLs
rechecked. These are configured expectations, not independent ownership/identity
attestation. CA content is not proof of the live peer's chain/hostname.

**MISSING:** independently trusted project/cluster/database identity attestation,
database OID, system identifier, exact server-version expectation, approved IP pin,
independent CA/toolchain provenance, fully verified operator environment.
**ACTUAL: NOT YET VERIFIED.** No Production query, DNS inference, ledger or backup
was used. A Production envelope cannot be prepared from these incomplete inputs.

## Future command envelope — not permission to execute

The concrete private document is stored outside Git with the existing protected
local review artifacts. It records existing config and absolute runtime paths,
role-bound payload hash and draft expected target. Its Production command remains
**BLOCKED**, because the missing identity/trust pins prevent fixing an identity
SQL hash, complete script hash and approved envelope hash. No pins are guessed.

After independent prerequisite completion, the exact reviewed command shapes are:

```powershell
& '<independently trusted absolute pwsh.exe>' -NoProfile -File '<exact clean candidate>\scripts\local-maintenance\diagnostic-only.ps1' -Mode Prepare -Specification '<protected private specification.json>' -Envelope '<protected private one-shot envelope.json>'
```

Prepare is offline. Independent review must inspect the concrete local paths,
candidate SHA, expected pins, reference provenance, all bindings, exact SQL hashes,
limits and owner decision before the following command can be approved:

```powershell
& '<same independently trusted absolute pwsh.exe>' -NoProfile -File '<same exact clean candidate>\scripts\local-maintenance\diagnostic-only.ps1' -Mode Execute -Specification '<same specification.json>' -Envelope '<same envelope.json>' -ApprovedEnvelopeSha256 '<independently reviewed envelope SHA256>' -OwnerApprovalReference '<new explicit one-time diagnostic-only owner decision>'
```

The operator must additionally type `DIAGNOSTIC ONLY <same envelope SHA256>`.
Neither Prepare nor this development task authorizes Execute. No full PREFLIGHT,
ledger, backup, restore, APPLY or retry is part of that approval decision.

## Safe evidence and stops

The output/report schema is closed: status, stage, reason, nativeExitCode,
durationMs, sqlState, errorCategory, timeoutCategory, verifiedIdentity, cleanupFailed.
Early local failures emit only BLOCKED/LOCAL_GATE/allowlisted reason. No raw errors,
SQL, catalog contents, hostnames, role/database values or credentials are emitted.
Native stderr remains bounded transient memory and is discarded, never persisted.
Temporary input SQL is removed only if created by this invocation. Reports and
attempt markers use CreateNew in the protected private directory.
Known marker prefixes distinguish identity/proof from a later ROLLBACK failure;
malformed native output uses UNKNOWN stage rather than guessing an operation.

SQLSTATE is retained only from the reviewed exact one-line psql sqlstate frame for
the generated file, native exit3, complete untruncated stderr and the existing
allowlist. Exit2 permits only broad CONNECTION categorization; authentication/TLS
cause stays UNKNOWN without a trusted structured state. 57014 means QUERY_CANCELED;
55P03 means LOCK_UNAVAILABLE. Neither alone proves a specific timeout cause.

Stop immediately on missing/unreviewed pins/trust, dirty/wrong SHA, hash drift,
identity/role/TLS/version mismatch, wrong environment, ACL/reparse failure, expiry,
spent marker, native error, timeout, malformed output, unexpected stderr, truncated
capture or unverified cleanup. QUERY_COMPLETED means the diagnostic query completed;
it does **not** mean schema/release/backup/data integrity PASS. Do not repeat a failed
Production operation under the same approval.

## Verification scope

The new suite runs actual public Prepare/Execute on disposable PG17.12 and18.7,
uses private owned synthetic server logs to count backend/statement activity, and
covers mismatch/first-query permission failure (no second SELECT), native syntax,
missing-object/permission errors, real30s statement and5s lock timeout, bad auth,
stopped server, malformed output, secret/catalog canaries, source/spec hash binding,
one-shot reuse/rename refusal, child cleanup/deadline, policy/PATH preservation.
Fault SQL probes are internal test code; public entrypoints have no fault/SQL hook.
PS5 file launch may be refused by existing policy before its runtime fence; report
that observation explicitly, without changing/bypassing policy.

Existing62-assertion Direct/Session diagnostics, strict structure/restore matrix,
pending/seal/report/ACL/lock guards, actual BATs and guarded synthetic54+4 remain
mandatory in the three maintenance CI workflows. They include the stacked PR base
branch so exact-HEAD CI runs without modifying PR23 or reopening Stripe development.
No checks/guards/timeouts/optional-error policies were weakened.

Initial historical PG17.12 SYNTHETIC_FIXTURE_FAILED remains **UNKNOWN**.
Original Production STRUCTURE_PROOF_QUERY_FAILED remains **UNKNOWN**.
New-tool development fixture failures are separate, not a reproduction or explanation
of either historical failure. Final exact-HEAD results belong in the sanitized PR report.
