# Exact new private QA tree cleanup

`cleanup-new-root.ps1` supplements the adopted [cleanup runbook](legal/stage-a-qa-cleanup.md)
for the new pointer under the checkout's ignored `.qa/meta-recovery-20261110/`.
It accepts the owner's exact authorised `-ExpectedPrivateRoot` as a private CLI
argument; the random directory name is not embedded in source or this document.
It cannot delete the pointer, manifest, preserved combined source/Git, working
projects, Meta resources or any other path. It performs no SQL/database connection.

Root must first confirm the applicable owner authorisation, closed test, stopped
services and preserved changes. Run on the same approved PowerShell 7 executable,
without changing its existing RemoteSigned policy. Freeze QA writers throughout.

1. Invoke with `-PointerPath`, `-ExpectedPrivateRoot`, and `-Manifest` pointing to
   `new-root-cleanup-manifest.json` beside the private pointer, plus **`-WhatIf`**.
   This preview writes only that new metadata manifest outside the deletion root,
   protects its ACL before writing any inventory and invokes native deletion
   preview. Its explicit ACL operation applies to the empty manifest even under
   WhatIf; the two read-only `GetOwnerSid` checks also run explicitly under
   WhatIf so ownership is actually verified. No QA target data is changed or
   removed. An existing manifest blocks.
2. Independently review the canonical target, counts/bytes/categories, earliest
   closure T0/deadlines and preserved-source proof. The private manifest contains
   relative paths, type/size/timestamps/attributes and their fingerprint, not file
   contents, credentials or a data archive. Keep it private and remove it within
   the existing seven-day evidence deadline.
3. Only after that review and within the owner's exact cleanup authorisation,
   invoke the same paths with **`-Execute`**, omitting WhatIf. The helper repeats
   ownership, source, tree, process, port, T0 and complete metadata fingerprint
   checks before deleting solely `-LiteralPath $ExpectedPrivateRoot` in that same
   PowerShell process. Changed/uncertain conditions block. It verifies absence.

Root/ancestor/descendant links, `.git` or `combined-source` inside the target,
active/ambiguous QA processes, any listener on the three QA ports, a PID file,
unreadable metadata or a provider/query error all block. A listener-query error
can never be treated as an empty result. The manifest is not authority to widen
scope, reset cleanup clocks, or automatically regenerate approval after changes.

Local tree absence does not prove revocation, remote provider erasure, forensic
destruction or removal of editor/clipboard/synchronised copies. The helper does
not remove external copies or the manifest/pointer. Those obligations remain
separately tracked; it reports external copies as unverified.

The pure `cleanup-new-root.test.ps1` extracts only validation functions and uses
invented metadata/provider substitutes. It neither inventories the actual target
nor calls process/port APIs, reads private runtime inputs or deletes anything.
