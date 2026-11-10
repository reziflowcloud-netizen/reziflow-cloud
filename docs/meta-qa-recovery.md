# Isolated Meta QA recovery

These helpers prepare a disposable internal environment from the preserved combined PR #9/#10 candidate. They do not release the integration, start a public relay, configure Meta, or authorise another organisation. Functional PRs remain Draft.

## Preconditions

- Use a reviewed checkout of this branch and the preserved, clean candidate at `51c560a5f0090b669ee4ffe48485ba4d6a3a873e`. Keep the original candidate, Git history, development documents and dependencies outside the disposable root.
- Use an owner-approved PowerShell execution environment. A refusal to load a script is a stop condition. Do not change execution policy, use `Bypass`, wrap the script inline, or switch hosts to evade that refusal.
- PostgreSQL 18 and Node.js must already be installed at the paths checked by the helpers. No installer, Production environment pull, cloud database or paid service is part of recovery.
- Create an empty evidence directory beneath the checkout's ignored `.qa/` directory. Check that Git actually ignores it before continuing. Keep the pointer private: it contains local paths, even though credentials are stored in the separate D-drive root.

## Local recovery sequence

Run each reviewed script with `-NoProfile -File` using the approved PowerShell executable. Do not paste script bodies into a terminal after a loading refusal.

1. Run `scripts/qa/meta-recovery/guard.test.ps1`. This uses synthetic URI/process metadata and malformed-input canaries; it neither starts PostgreSQL nor calls Meta/ngrok. It retains temporary test fixtures beneath `artifacts/qa-guard-unit-*` for inspection. A child script-loading denial is a blocked test, not PASS.
2. Run `scripts/qa/meta-recovery/bootstrap.ps1` with `-EvidenceDirectory` set to that existing ignored directory and `-SourceEvidence` set to the preserved candidate's evidence parent. It creates a fresh owner-restricted `D:\LegalHubStageA-<random hex>` tree, its ownership marker, a source copy and a new synthetic loopback PostgreSQL cluster. It checks the exact server PID, executable, owner, data directory, start time and listener before running QA migrations or seeding. Intake/worker/binding remain off, external notifications are off, and the new App binding is initially null. No old runtime or secret is imported.
3. Only after `QA_DB_READY`, use the private pointer with `build.ps1 -PointerPath <private pointer>`. Before a subsequent database operation, repeat `verify-running.ps1 -RuntimeFile <private runtime>`. Never print either file's contents. Failed preparation stops only the verified owned cluster and preserves data for review; it does not recursively delete anything.
4. The prepared ngrok configuration has an empty token, inspection/logging/remote management disabled. It is not an active endpoint. The owner must supply fresh credentials directly into the restricted local store following [credential safety](meta-qa-credential-safety.md). Do not copy the legacy supervisor, token-debug URL, seed or retired App binding into this runtime.
5. A reviewed launch/supervision and safe Graph preflight are still required before exposure. These bootstrap helpers alone are not a complete E2E runner. Do not start the historical supervisor against the replacement App.

## Gates before an external test

Confirm the replacement App, administrator role, supported Graph version, exact own Page/Form relationship, token provenance and minimal grants without serialising token screens. Confirm current Leads Access and both subscription layers: App `page/leadgen` and the exact Page's `subscribed_apps` entry for that App with only `leadgen`.

Before any relay launch, confirm the free account/hostname and capture settings; expose only the HMAC gateway's exact webhook route. The gateway requires an explicitly approved replacement App, exact QA Page/Form and a closed first-event gate. Original raw bytes/signature must reach the CRM unchanged. Its one-use Dashboard sample route returns a transport result without forwarding a fake Lead. A sample, local simulation or manual Graph retrieval cannot establish automatic E2E.

Fresh resource verification and public legal URL readback precede replacement-App publication. A separately reviewed three-page legal update must not include these functional helpers. Development is the default; Live is conditional on every requirement in the owner's bounded test authorisation. Do not infer that publication fixes Pending or submit Review/BV to get past a blocker.

## Stop and cleanup

Close the gate and tenant binding, stop the worker/CRM and relay, then run `stop-qa.ps1 -PointerPath <private pointer>`. It refuses to stop PostgreSQL while the QA HTTP ports listen and verifies the owned server before stopping it. It preserves `PG_VERSION` and the data directory. Full ingress/process STOP must also be tested when the new supervisor is prepared; the database helper is not that proof.

Follow the ownership, review, timing and verification requirements in [the adopted cleanup procedure](legal/stage-a-qa-cleanup.md). Its historical `qa-cleanup-inventory.ps1` helper is incompatible with this new D-drive root and `.qa/` pointer: it requires a different pointer filename, parent and evidence-root name. Do not run it with substituted paths, bypass its checks or widen its scope. Before deletion, prepare and independently review a metadata-only inventory for this exact new target, including canonical paths, ownership markers, reparse checks, stopped processes, file counts/sizes and external copies. The bootstrap/stop helpers do not provide that deletion inventory or authorisation.

Record closure/cancellation T0 even for BLOCKED. Remove transient credentials/config and the disposable private cluster by T0 + 24 hours, other QA artifacts/copies by T0 + 7 days, and the non-identifying result by T0 + 30 days. Account for editor, clipboard, export and synced copies separately. Do not erase development sources, Git or approved documents, and do not claim local deletion revokes Meta credentials or provider records. Earlier cycle deadlines remain unchanged. Every destructive operation still needs the applicable exact-target authorisation.

## Offline checks

`node --test scripts/qa/meta-recovery/secret-safety.test.mjs scripts/qa/meta-recovery/gateway.test.mjs` runs planted-secret and bounded local HTTP fixtures only. It requires no Meta/ngrok credentials or database. PowerShell parsing checks establish syntax only; they do not replace execution of `guard.test.ps1` or the isolated-runtime checks.
