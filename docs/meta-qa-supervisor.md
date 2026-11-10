# Replacement-App QA supervisor contract

This is a genuine-event launcher for the isolated Stage A candidate. It does not create a Meta lead, change Meta settings, publish an App, restore PostgreSQL, deploy anything or grant permission. Review and the owner's current bounded authorisation remain prerequisites. Do not launch the historical supervisor. Synthetic regression uses separate fixtures; there is no synthetic bypass in this CLI.

## Inputs and checks

Start with `node scripts/qa/meta-recovery/supervisor.mjs --pointer <private pointer>` in an attached session with stdin kept open. The pointer must resolve to the new guarded D-drive root. Existing bootstrap/runtime/state and secret fields are used; the source is the fresh copied combined candidate. The supervisor requires active QA PostgreSQL ownership verification using the exact approved `runtime.qaPwshExecutable`, major 7 under the existing RemoteSigned policy. No policy change, Bypass or fallback host is used.

The guardian alone receives the additional installed Git directory `C:\Program Files\Git\cmd` in its otherwise minimal PATH and `PATHEXT=.EXE`, because the unchanged source guard invokes bare `git` for metadata checks. It verifies that the resolved Git is exactly the regular non-reparse `C:\Program Files\Git\cmd\git.exe`. App and ngrok environments stay unchanged. Startup failures emit only finite `QA_LAUNCH_*` stage codes (for example `QA_LAUNCH_GUARDIAN_RUNTIME`); raw exception text, private config, provider responses and child stderr remain suppressed.

The runtime must contain exact App `2523488421395251`, Page `1449474971582722`, Form `2046130655900851`, and the same `approvedMetaAppId`. It rejects the retired App. Existing intake/worker switches, tuple and pilot-ID lists must be closed/empty. Set `graphVersion` only after a current supported-version check. A fresh `meta-real-private.json` from `graph-preflight.mjs` must match those IDs, the Page token fingerprint and all three PASS checks (`tokenApp`, `tokenPage`, `formOwnership`); provenance must be at most one hour old. The initial lead gate must be strictly false with null Lead ID, creation time and Dashboard arm.

Fresh private inputs are `meta-app-secret.txt`, `meta-page-token.txt`, `meta-real-private.json` and the minimal reviewed `ngrok.yml`. Before credential files are opened, `supervisor-process.ps1 -CheckOnly` verifies the guarded runtime and their owner/ACL/path controls. No legacy credential file or service history is read. An empty ngrok token fails before an agent is launched. The agent config admits only the reviewed eight lines: version 3, agent, quoted non-empty authtoken, console_ui false, inspect_db_size -1, web_addr false, log false and remote_management false. No global config is merged.

Add this private metadata object as `runtime.supervisorApproval`, using freshly verified facts, not invented readiness flags:

- `appId`, `pageId`, `formId`: exact three IDs above.
- `approvedPwshExecutable`: exactly `runtime.qaPwshExecutable` recorded by bootstrap.
- `approvedAt`: current ISO UTC approval-record time; at most one hour old.
- `deadlineAt`: absolute ISO UTC deadline in the future and no more than 35 minutes away.
- `allowEnable`, `allowTunnel`: explicit booleans; default false. Set true only within the owner's bounded test authorisation.
- `hostname`: `unit-handsfree-carpentry.ngrok-free.dev`, matching runtime hostname.
- `ngrokExe`: exact regular non-reparse Store package executable, also stored in `runtime.ngrokExe`.
- `ngrokSha256`: independently checked executable SHA-256.
- `freePlanVerified`, `fullCaptureDisabled`, `hostnameVerified`: true only after the account's current settings were checked.
- `ngrokVerifiedAt`: current ISO UTC account-settings check time; at most one hour old.

The currently inspected Store binary is version 3.39.11-msix-stable at `C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe`, SHA-256 `6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16`. Re-check the actual file before launch; a Store update changes the approved hash and needs review.

## Attached-session commands

Tenant isolation expects exactly the synthetic QA organization and the configuration-only `org_default` inserted by migration `20260110000000_organizations`. The known default must match that migration's metadata and contain zero operational users, clients, cases, tasks, leads, employees, bindings, notifications, receipts, notification preferences/deliveries and routing records. Additional organizations or default operational records block startup. Both supervisor and QA result collection use this same read-only invariant; do not delete the migration organization to force a count to pass.

Startup launches only loopback Next and the exact-route HMAC gateway, with intake and worker off. It does not launch ngrok. Only the gateway is ever passed to ngrok; CRM admin and PostgreSQL are not published.

The actual guardian requires both HTTP ports to be empty initially. Each app launch refuses an occupied app port. Readiness accepts `/login` only after the guardian confirms the loopback listener belongs to the retained owned App PID, and confirms it again after the response. Relay launch requires the gateway's sole loopback listener to belong to the Node supervisor. Repeated CheckOnly validations remain usable while those owned services are active.

- `ENABLE`: separately authorised local intake preparation. Enables only the exact synthetic tenant binding in pilot mode with an empty pilot list, then restarts the owned Next process with the exact approved tuple. External notifications and retention remain off. The HMAC gateway still rejects unapproved lead IDs.
- `TUNNEL`: separately authorised relay launch using the exact Store executable/hash, fixed hostname, loopback gateway and explicit private config with `--inspect=false`. A live agent process is not proof of public reachability or webhook delivery; test that separately.
- `RELEASE`: after the one approved synthetic Meta lead has been created and independently identified, record only its exact ID and genuine creation time in private `meta-real-private.json`, keeping `release:false`. This command adds that ID to the exact pilot binding before changing `release` to strict boolean true. Do not open the flag manually. The allowed event window is ten minutes, with no future timestamp accepted.
- `STATUS`: emits a bounded status object, without identifiers or secret values.
- `STOP`: closes the on-disk lead gate, seals the gateway, aborts the worker request, terminates the owned Job, disables the exact tenant binding, and disconnects Prisma. The command is idempotent. Unknown commands also stop the supervisor.

A Dashboard arm remains separate: only the gateway's signed, exact, one-use, short-lived placeholder sample is acknowledged and never forwarded to CRM. It cannot establish automatic E2E. The genuine path preserves raw webhook bytes/signature, and the Next fetch preload permits only an exact approved Lead GET with matching header authorization and proof. It never fabricates or rewrites Graph responses. That preload narrows application fetch; it is not a host firewall.

## Ownership, termination and limits

The PowerShell guardian creates a fresh unnamed Windows Job with kill-on-close for each kind/generation. It creates each exact executable suspended, with a cleared/whitelisted environment and NUL stdout/stderr, assigns it to that empty Job, verifies its executable and retained native process handle, and only then resumes it. Descendants inherit membership. No process is killed by name, port or an unverified PID list. App restart drains its whole Job including descendants, closes that generation's handles, and uses a fresh empty Job; the relay's Job remains separate. STOP attempts termination of every owned Job and waits for zero active processes and signalled owned handles across all of them.

The guardian holds the actual Node parent's process handle and checks it independently of JavaScript. stdin EOF, parent death, deadline, unexpected child exit or malformed command closes all owned Jobs. If the guardian itself dies, kernel kill-on-close terminates those Jobs. The JavaScript supervisor independently closes its gateway on stdin EOF, termination signals, unhandled failure, guardian failure or deadline. Raw child output and provider exceptions are never copied into reports. STOP is PASS only when its cleanup steps succeed; uncertainty remains BLOCKED.

PostgreSQL was not launched by this supervisor and is not a Job member. After ingress/Next stop, use the separately reviewed `stop-qa.ps1` for the exact QA cluster. Meta callback/subscription restoration is a separate, explicitly scoped Meta operation. This launcher neither changes nor restores those settings. No files are deleted. Follow existing cleanup clocks; new launcher work does not extend earlier deadlines.

An owner-authorized retry after a failed closed launch may use `prepare-supervisor.ps1 -RearmClosedLaunch` with the existing private pointer and the required fresh account/capture check. It refuses a missing or foreign STOP marker, active/ambiguous QA launcher, occupied HTTP port, open binding, runtime gate, Lead ID or Dashboard arm. Only the exact regular owned marker containing `closed` can be removed, after a final unchanged-file/process/port check; no database record, credential, source or other artifact is deleted. The normal preparation path refuses an existing STOP marker. Repeated STOP and rearm retain the earliest of `real.closedAt`, `real.earliestClosedAt` and `runtime.cleanupClosedAt`; refreshing a 30-minute launch approval does not reset cleanup T0.

## Offline verification

The previous shared-Job design returned Win32 5 when assigning Store ngrok after a dummy Node child, while assignment to an empty Job succeeded. This was an API composition conflict, not evidence of a Work policy denial: Microsoft documents that an already-associated process requires an empty target or a compatible existing hierarchy. The reviewed correction gives each kind/generation a fresh empty Job, with the same parent, environment, ACLs, creation flags and kill-on-close protection. It requests no breakaway, UI or security-limit change. [AssignProcessToJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject)

Existing job associations are retained and nesting remains subject to Windows' validity and inherited-limit rules; the additional owned Jobs do not detach processes from prior restrictions. No claim is made that all host policy settings were independently inspected. Unexpected assignment failure remains fail-closed, before ResumeThread, without another host, flags or uncontained fallback. [Nested Jobs](https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs), [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)

The corrected concurrent local version fixture passed. A subsequent actual relay attempt was denied earlier, at `CreateProcessW` with Win32 5, before assignment or public ingress. This is the current native launch blocker; attribution to Work policy, Defender, AppLocker, package rights or another cause is not established. Further real launch attempts are stopped. Do not infer tunnel/E2E readiness from the fixture or weaken policy, flags, privileges or interpreter checks to proceed.

`qa-stopped-proof.ps1` is a metadata-only private inventory helper for owner execution after review. It uses `Read-QaGuardedRuntime -AllowStopped`, inspects the exact root's file counts/sizes without following reparse points, and checks scoped process/listener/PID-file absence. It reads no database and explicitly does not verify stored binding state or external copies. Cleanup epochs come from the earliest existing closure, not a new clock. Its optional event query is limited to the exact inspected Store executable, selected Defender/AppLocker/CodeIntegrity Event IDs and the last ten minutes; only category, Event ID and numeric time are returned. No match or unavailable/denied logs means UNKNOWN, not proof that no security event occurred. The output includes a private absolute root and belongs in the private inventory, not an anonymous published result. It has no execute/delete operation.

`node --test scripts/qa/meta-recovery/supervisor.test.mjs` exercises planted config/provenance, closed gates, worker/release ordering, STOP races and the fake guardian protocol. It starts no real services and calls no providers.

`supervisor-port.test.ps1`, run with the approved pwsh7 using `-NoProfile -NonInteractive -File`, exercises the guardian's actual ownership function against synthetic listener snapshots. It accepts only an exact loopback/PID match, distinguishes absent/not-ready from an error, and refuses foreign, wildcard, IPv6 and multiple listeners without querying network state or starting a service.

`supervisor-git.test.ps1 -SourcePath <preserved clean candidate>`, using that same approved host, demonstrates that the original minimal PATH cannot resolve Git; with Git in PATH but no PATHEXT, explicit `git.exe` resolves while bare `git` still fails. The guardian's PATH plus `PATHEXT=.EXE` passes the unchanged preserved-source guard. It reads only source/Git metadata and starts no services or provider calls.

Run `supervisor-native.test.ps1` with the already approved pwsh7 using `-NoProfile -NonInteractive -File`. It extracts the helper's constant C# implementation and uses networkless dummy children to verify separate Jobs, descendants, app-only restart, fresh generations, STOP of both Jobs and kernel kill-on-close. A test-only copy injects failure after a second suspended process is created, before assignment, to verify cleanup of that process and unpublished Job without disturbing the existing app. Production code contains no fault flag. It does not use a QA runtime, database, Next, ngrok or Meta. PASS does not establish a public endpoint or full Meta E2E.

The separately authorised `supervisor-ngrok-version.test.ps1` passes only `version` to the exact Store binary with the baseline environment, no config argument and no token environment. With the corrected separate Jobs, it passes while a networkless dummy Node child remains active, then verifies STOP. This is a local compatibility probe, not a tunnel/E2E test. `supervisor-tunnel-shape.test.ps1` checks private-plan shape with a synthetic owner snapshot and a fake Job that throws before native launch; its output does not establish real ownership or an endpoint.
