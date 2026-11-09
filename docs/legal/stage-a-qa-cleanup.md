# Stage A QA manual cleanup

**Procedure prepared; no deletion authorised or performed.** This runbook covers the existing disposable local PostgreSQL cluster, temporary credentials, earlier pilot evidence, current logs, generated application caches and operator-held cloud copies. It does not use SQL or connect to Production.

## Clocks and responsibility

Record owner adoption time **A** and test closure/cancellation time **T0** in UTC. T0 occurs whether the result is PASS, FAILED or Pending. A paused test must be explicitly closed/cancelled to start its clock; do not claim that the earlier service-stop timestamp already adopted this policy.

| Deadline | Scope | Completion proof |
| --- | --- | --- |
| T0 + 24 hours | Transient local credentials, config and process environments. Default: remove the **whole disposable private QA tree**, including its PostgreSQL cluster, which can contain authentication material | QA processes stopped; exact private root absent; all declared credential copies accounted for; no credential values in proof |
| T0 + 7 calendar days | Remaining QA leads/receipts/dedupe/notifications/outbox, evidence files, logs, screenshots, database dumps/copies and generated QA caches | Each registered target and cloud copy independently verified absent; source/dependencies/Production untouched |
| A + 7 calendar days | Artifacts from all earlier Stage A attempts and their operator-held copies | Earlier reports, event/digest files and diagnostics are in the manifest, not exempt because they predate adoption |
| T0 + 30 calendar days | One genuinely non-identifying result summary, including completion date/count/status entries and its copies | Summary and retained result entries removed; no open-ended result-retention exception |

Earlier credential copies receive the same **A + 24-hour** ceiling unless removed sooner at test closure. Existing QA data must not be kept indefinitely while waiting for a new test. Assign one responsible person and one verifier (the owner may perform both, documenting separate execution/check times). Escalate a failure before its deadline, stop further testing, record the unresolved category and remediation; do not mark complete.

Seven and thirty days are adopted maximums, not a minimum waiting period. Removing the private cluster at 24 hours satisfies its data deadline early. No extra QA snapshot is created just for cleanup.

## Existing locations already accounted for

The existing local pointer is artifacts/meta-lead-ads-resume-20261108/stage-a-private-pointer.json. It contains paths, not the runtime secret values. Its private directory is a dedicated %LOCALAPPDATA%\LegalHubStageA-<32 hex> tree.

Metadata-only inspection confirmed these categories without opening secret files or database contents:

- runtime.json, qa.env, cluster-state.json, checkpoint files and private execution/configuration material;
- isolated/stagea<32 hex>/cluster, containing the existing disposable PostgreSQL cluster; its parent has a runner ownership marker and lifecycle metadata;
- ingress, delivery-audit, delivery-audit-final-20261109, diagnostic digests, PostgreSQL/app/tunnel logs and supervisor output;
- evidence root reports and JSON artifacts from the initial pilot, Development attempts, final diagnostics, legal reviews and this approval preparation;
- generated .next / tooling caches in the dedicated QA checkout, where present.

Only metadata was inspected. The database is not queried and .env, runtime JSON, dumps and backup contents are not read. Do not publish the local manifest: filenames/paths can themselves carry identifiers.

The combined-source tracked code, .git and dependencies are preserved. Its generated caches are separately registered. A clean Git status does not prove that ignored caches contain no data.

## Read-only inventory now

From the project workspace, invoke scripts/qa/qa-cleanup-inventory.ps1 with:
- PointerPath: absolute local path to stage-a-private-pointer.json;
- EvidenceRoot: absolute local path to meta-lead-ads-resume-20261108;
- OutputPath: a new private local inventory JSON path.

The helper does not stop anything, read credentials, connect to a database or delete files. It rejects an unexpected private-root parent/name and evidence-root name, does not follow reparse points, and excludes source/dependencies from evidence traversal. A blocked junction/symlink must be resolved and separately approved, not followed or removed through a recursive parent.

Add to the private manifest before execution:

- actual current absolute targets, category, deadline, ownership/isolation evidence, actor and verifier;
- every manually exported file, screenshot, clipboard export, email attachment or other chat/system copy;
- OneDrive, Dropbox, Google Drive, Windows File History, backup jobs and any synced folder affecting the workspace, AppData or exports;
- local/cloud trash, version history, offline replicas and retention-locked backups; note the provider and control available, without claiming that emptying a local folder erases those copies;
- T0/A, earlier credentials needing the 24-hour clock, explicit approval for the reviewed manifest and expected source/main revisions.

Do not create a new online upload of the inventory. If an unknown copy or retention-locked backup cannot be erased on time, record it as unresolved and adjust the public claim before publication; do not silently approve an impossible deadline.

## Execute only after separate QA cleanup authorisation

1. Close the existing QA gate release and binding, stop intake/worker and tunnel. Meta callback/subscription removal and token revocation remain separately scoped owner actions. No new Meta lead or Graph test is needed.
2. Stop **only the dedicated QA PostgreSQL cluster** with the installed PostgreSQL tool, using the verified cluster data path. The path must be below the exact private QA root from the approved manifest and its runner ownership marker must match the saved QA metadata. Do not use a process name or port alone. Do not start a database to perform deletion.
3. Verify that the QA cluster, app, gate and tunnel processes are stopped. Inspect process metadata locally without printing command lines or environments. Compare PID **and creation time/executable/verified QA target**, not an old PID alone. If process ownership is unclear, STOP.
4. Export only the allowed result summary (date, aggregate counts, PASS/BLOCKED, non-identifying errors) outside all removal targets. Exclude person/contact/account/lead/user/device IDs, request bodies, tokens, screenshots, body digests and private absolute paths.
5. Review all absolute removal targets. For the private cluster tree choose its **exact dedicated QA root**, not AppData, TEMP, the workspace, a drive, a shared backup parent, or Production. For evidence choose explicit QA files/folders from the manifest, never a broad parent containing source or unrelated work.
6. Reject root/ancestor/descendant reparse points and paths outside the approved root. Freeze writers before the final comparison; compare item type, size and modification time with the inventory. If changed, regenerate/review it. Preview using native PowerShell Remove-Item with -LiteralPath and -WhatIf; do not pipe computed names to another shell.
7. After explicit QA-only deletion approval and a final displayed absolute-path check, the operator executes Remove-Item -LiteralPath $approvedExactTarget -Recurse -Force for an approved directory, or without -Recurse for a file, in the **same PowerShell session**. The variable must contain the reviewed canonical path, never a wildcard or unvalidated interpolation. This runbook is not permission to execute that command now.
8. Verify each target is absent using Test-Path -LiteralPath $approvedExactTarget. For a cloud copy, separately verify trash, version history, replicas and provider-managed backup status. Local absence is not proof of remote erasure or forensic destruction.
9. Complete the private manifest with execution/check UTC times and category counts, without secret values or record identifiers. No backup restore may reintroduce deleted QA data; erase/filter a restored copy before use.
10. At day 30 remove the non-identifying summary and its copies. If cancelled without running, use cancellation T0 rather than retain a “pending test” summary indefinitely.

The detailed manifest is itself identifying QA evidence and has the **7-day** limit: replace it with a non-identifying category/count/deadline result in the 30-day summary once deletion is verified, then erase the detailed manifest and its copies. Do not retain it as an exception or substitute a complete raw report/PR conversation for the anonymised summary.

## Provider and published materials

Local cleanup does not erase Meta administrator/platform records or Cloudflare/Vercel's independently controlled service records. Review resource need by day 7; deletion/revocation of QA App/Page/Form or provider records requires the appropriate separate owner action. Document these limits in rights responses.

Public source legal documents, test-independent code and business contact information are not QA lead evidence. They are not deleted under this runbook. Production policies, database, Supabase and customer backups are never cleanup targets.

## Acceptance record

Use a private record before execution and anonymise it on completion:

- Owner/contact/location/copy declarations confirmed: date / person.
- A and T0, deadline timestamps and named actor/verifier.
- Approved canonical target list and isolation/ownership checks.
- Cloud copy/trash/version/backup review complete or explicitly unresolved.
- 24-hour, 7-day and 30-day execution and verification results.
- Production/RAM/SL affected: NO.

A failed or incomplete copy check is **BLOCKED**, not an erasure PASS.

