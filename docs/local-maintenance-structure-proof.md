# Closed public-schema restore proof

PR #18 candidate preparation only. A changed HEAD needs a new owner decision;
the earlier approval for `450a94c3f2401d81704c0f8ee167b6a18a990d40` is not reusable.
No Production preflight, Apply, merge, deployment or Meta activation is authorized
by this document. The later separately approved preflight uses the original
Supabase Direct hostname over owner-connected WARP IPv6 and the existing encrypted
VHD. No endpoint substitution or SSL downgrade is needed.

## Why the old check blocked

The old test combined any extension outside `public` with any public routine.
That was conservative but overbroad. Read-only catalog analysis found one public
routine, `staff_routing_v2_seed_legacy_member()`, whose exact body matches the
unchanged `20260922140000_staff_routing_v2` migration, with one ordinary AFTER
INSERT row trigger. The recursive catalog closure found no external references.
This alone is not proof for a string-body PL/pgSQL routine: PostgreSQL does not
track its body dependencies in `pg_depend`.

Observed external extensions were pg_stat_statements 1.11, pgcrypto 1.3,
uuid-ossp 1.1 and supabase_vault 0.3.1; they are not required by this closed
contract. Built-in plpgsql 1.0 remains required. Definitions and configuration
evidence remain private; no function bodies, credentials or client records are
included in this report.

## What is proved, and what still blocks

- Recursively traverse all public catalog roots, including column subobjects,
  defaults, constraints, triggers, rules and policies. Reject external schemas,
  required nonbuilt-in extensions, unknown root/object classes and user-created
  objects in `pg_catalog`; namespace alone is not builtin provenance.
- Accept zero public routines/triggers, or only the exact reviewed routing pair.
  Zero is accepted only when neither routing table exists; dropping the pair
  from an already routed database is a block, not a new valid baseline.
  Require the fixed SHA256 of prosrc (CRLF to LF only), full semantic attributes,
  signature, language, return type, no routine-local configuration and exact
  trigger binding. A new name, overload, changed body, dynamic/indirect call,
  SECURITY DEFINER or changed search_path fails closed.
- Prove the routing operand/target column types and builtin md5(text), text
  concatenation and integer-to-text I/O bindings. Reject a custom int4-to-text
  cast, a shadowing user namespace and unreviewed caller search paths. Only the
  supported caller defaults are considered; this is not a claim about arbitrary
  future SQL sessions with deliberately changed search paths or temp objects.
- Require UTF8 server encoding on both sides: the exact routing md5 hashes
  text bytes, including non-ASCII identifiers. Synthetic INSERT tests use Unicode.
- Supported observed scope is PostgreSQL 17/18, ordinary public tables/indexes/
  sequences and their row/array types. Inheritance, partitioned/foreign tables,
  views, standalone types/domains/enums, policies and other unmodeled kinds block.
  RLS/FORCE RLS flags are preserved, not disabled. Abnormal internal FK trigger
  states block. Expanding this scope requires its own proof and tests.
- Required/public nonbuilt-in extensions now block even when versions match.
  The prior hstore version-fingerprint test did not establish an atomic extension
  restore contract for `--schema=public`. This intentional tightening is tested
  at different versions; the existing extension version fingerprint remains.
  No extension is installed into Production or silently added to the dump.
- The portable fingerprint additionally covers routine definitions/attributes,
  trigger bindings, table/column flags, qualified collations, rowtypes, sequence
  parameters and rules.
  Losing both routine and trigger after restore therefore changes the digest.
  Catalog proof and data/structure fingerprint queries retain the same exported
  snapshot used by pg_dump. Existing ledger, dump hash/TOC, restore, migration,
  sequence-role, data-integrity and target/TLS guards are unchanged.
  The closed proof digest is also bound into the sealed target fingerprint and
  repeated by the existing final Apply checks; a later routine/trigger change
  cannot reuse that plan. This does not authorize an Apply.

## Validation and release boundary

`tests/local-maintenance/structure-proof-tests.ps1` runs targeted model negatives.
`-WithPostgres` uses fresh, randomly named localhost-only synthetic clusters,
tests actual catalog dependencies, creates a snapshot-consistent archive,
restores it and performs a fresh INSERT through the restored trigger. The
expected member ID is calculated independently in the test process; all five
output fields are checked. Missing routines/triggers, changed RLS and sequence
semantics are also rejected. The test uses its own ACL-protected roots and
verified cleanup; it never reads a Production configuration.

CI repeats models and real isolated PostgreSQL restoration on the new HEAD.
Independent security review and the final immutable SHA/CI evidence belong in
the PR approval request. A restore test is not a full deployed-CRM HTTP smoke;
the existing `PASS_SCHEMA_ONLY` limitation and public/no-owner/no-ACL backup
scope remain explicit. Provider Auth/Storage and other schemas are not a full
service recovery package. A qualified `pg_catalog.default` collation name does
not establish identical database locale behavior across Linux/Windows; no such
general CRM compatibility claim is made. Production APPLY is still separately gated.

No cleanup deadline changes: temporary Production credential/config copies must
be handled by 16 November 2026 18:00:10 Europe/Warsaw, legacy QA artifacts by
23:11:32. An unresolved approval or preflight does not extend retention. No
existing backup/source archive or credential copy is deleted by these changes.
