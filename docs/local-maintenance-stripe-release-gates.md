# Maintenance M1/M2 release gates

This maintenance candidate starts from main
`41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04`. It does not change Stripe PR #20,
its SQL or any RAM/Meta/SL integration. PR #10 runtime fingerprint corrections
already exist in main (2adabd2, 6122d3b), with subsequent stricter dependency proof.
This document grants no Production connection, PREFLIGHT, APPLY, merge or deployment.

## M1: internal attribute versions

PostgreSQL 17.12/18.7 backpatched attribute versioning. A `pg_attver` entry in
`pg_attribute.attoptions` records a WAL-based attribute version; newly restored
relations receive new values. Treating that internal value as portable schema
caused the reproduced Windows post-restore mismatch. Pre-backup equality passed;
17.12 failed with both PS7.6.9 and7.6.10. Individual old CI descriptors were not
retained, so this explains the reproduced mechanism rather than reconstructing
missing historical bytes.

Primary implementation/design references:

- [Attribute version generation and catalog storage](https://raw.githubusercontent.com/postgres/postgres/REL_17_12/src/backend/catalog/README.attver.md)
- [Implementation: GetNextAttributeVersion and new-relation stamping](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/catalog/heap.c)
- [Upstream implementation and backpatch rationale](https://www.postgresql.org/message-id/E1xQQFr-000000003OT-3txh@gemulon.postgresql.org)
- [pg_attribute options contract](https://www.postgresql.org/docs/17/catalog-pg-attribute.html)

Raw catalog evidence is retained. The portable digest projection removes only
the exact case-sensitive key `pg_attver`, once, with a positive decimal uint64
value, on 17.12+ or18.7+ within supported majors17/18. Unknown internal `pg_*`
keys, malformed/duplicate versions, unexpected older minors and wrong option
types fail closed with `STRUCTURE_COLUMN_OPTIONS_UNMODELED`.

All user column options remain, including `n_distinct` and
`n_distinct_inherited`, preserving values and order. An internal-only options
array becomes null, matching the pre-backpatch catalog. Column JSON is serialized
identically on both sides. Recursive dependencies, exact routine/trigger contract,
RLS/FORCE RLS, types/defaults, named constraints, indexes and sequence semantics
remain checked. No source catalog, archive SQL or restore command is altered;
PostgreSQL composite safety stays enabled. A real corrupt-archive restore still fails.

The descriptor serialization changes the digest contract. Plans from another
commit do not transfer: commit, target, backup checksum, HMAC, four-hour freshness
and one-use checks remain mandatory.

## M2: preserve an ordered string array

`Get-Expected` returned one string-array object with unary comma. The caller's
`@(...)` created an outer one-element array; typed downstream conversion produced
one compound string. Valid54-applied/4-pending input failed exact comparison,
although one-pending tests passed.

Invoke-Preflight now assigns directly to explicit `string[]`. A distinct validator
variable also avoids PowerShell's case-insensitive `$Names`/`$names` alias hiding
empty inputs. Empty, duplicate, malformed and non-ordinal lists are rejected.
Caller order must match filename order; Prisma's actual deployment order is
unchanged. APPLY validates sealed pending names again. Exact ledger comparison,
both final state rechecks, SHA256, role/target identity, locks, seal, freshness and
consumed-plan protections remain; no accept-any-pending fallback exists.

## Validation

With locked dependencies installed without lifecycle scripts:

```powershell
pwsh -NoProfile -File tests/local-maintenance/pending-migrations-tests.ps1
pwsh -NoProfile -File tests/local-maintenance/structure-proof-tests.ps1 -WithPostgres -PostgresBin <EXACT_BIN>
pwsh -NoProfile -File tests/local-maintenance/runner-tests.ps1 -PostgresBin <EXACT_BIN>
pwsh -NoProfile -File tests/local-maintenance/full-preflight.ps1 -PostgresBin <EXACT_BIN>
pwsh -NoProfile -File tests/local-maintenance/stripe-release-preflight.ps1 -PostgresBin <EXACT_BIN>
```

The synthetic-only Windows workflow tests same-version17.11/17.12/18.6/18.7.
Cross-version restores use target-version tools:17.11→17.12,17.11→18.6,
17.11→18.7,17.12→18.7,18.6→18.7. Native binary archives have exact version/SHA256
pins. Downgrades and newer backpatch metadata restored by unpatched older
tools/servers are not supported claims.

Structure negatives include real user options, type/default, named constraint,
index, RLS in both directions, FORCE RLS, function/trigger and sequence changes;
unknown internal metadata is tested without unsafe catalog writes. Pending tests
execute actual Runner functions/assignment AST, ledger checks, plan/report
serialization and final-recheck helper:0/1/2/4, duplicate/empty/missing/extra,
bad filename/order/checksum, failed/unresolved/duplicate ledger, set/SQL/target
drift and tampered seal. Existing complete suites retain actual no-migration,
ACL, transport, locks, corrupt archives, consumed plans and cleanup refusal.

### Real 54+4 fixture

The maintenance PR adds no Stripe migrations. The test constructs a separate
owned clean Git fixture with the candidate Runner and exact four SQL files from
`b623fd21b8fe21672a308f911b8adee9ba57768b`, asserting every approved Git-blob SHA256
before unchanged SQL audit. Its full synthetic commit is printed and pinned by
the actual Runner; the fixture is never pushed/deployed.

A fresh loopback cluster receives54 main migrations using exact approved bytes,
avoiding Windows archive/autocrlf conversion inside SQL literals. The old main
Prisma client seeds synthetic rows. Actual PREFLIGHT checks the manifest,
checksums, identities/roles/locks, snapshot backup, disposable restore, data and
structure, four-migration simulation and sealed plan. The test verifies the HMAC
and real persisted PREFLIGHT_ONLY report; wrapper exit0 alone is insufficient.
Four names must remain separate ordered strings; the source must retain54
ledger entries. Missing expected input must fail before backup.

A second disposable restore applies all four migrations, compares every value
in50 old application tables and the old Billing snapshot, and proves old Prisma
read/write behavior. This is module/Prisma compatibility, not deployed CRM HTTP or
provider smoke. No real tenant, Production config/archive or provider is used.
The synthetic combined commit does not replace review/CI of a future real release SHA.

## Release boundaries

Public-only/no-owner/no-ACL backup is not full DR: globals/roles, other schemas,
Auth/Storage, configuration and secrets need their own verified recovery strategy.
The old unverified backup is not promoted to DR evidence. The historical
Production **data** mismatch is not declared fixed or explained.

The Runner's six-table MD5 corruption detector remains representative; the
fixture's50-table SHA256 comparison does not expand runtime guard coverage.
Locale/collation and whole-service recovery remain separate constraints.
DDL can briefly lock Organization/new billing tables: retain bounded timeouts,
fresh lock samples, old-app/Stripe-OFF transition and application rollback
planning. Never automatically drop journals or restore over live writes.

New owner decisions are separately required for Production connection/PREFLIGHT,
APPLY and merge/deployment. The old one-time permission is consumed. RAM
Messenger/Instagram, Sheets, Routing and Notifications need approved pre/post
release smoke; financial-review, accounting and Live gates remain separate.

Before first push, the branch uses the existing
`git.deploymentEnabled["fix/maintenance-runner-stripe-release-gates"]=false`
mechanism, with no conflicting true rule:
[Vercel branch exclusions and precedence](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled).
