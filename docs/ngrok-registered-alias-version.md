# Proposed single registered-alias version diagnostic

Status: **PREPARED AND SOURCE-REVIEWED; NOT EXECUTED. Separate owner permission required.**

The authorised two-call comparison completed on 10 November 2026. Both direct-image calls returned `CreateProcessW / 5`; adding the registered alias directory to the caller PATH was insufficient. Both stopped with zero active owned processes. The two-call exception is exhausted. The exact original cause and any specific Windows/Work restriction remain **UNKNOWN**. Fresh selected Windows logs contain no matching event; Security is unavailable.

The next hypothesis changes the **launch entry point**, rather than adding another PATH variant. [Microsoft documents App Execution Aliases as the supported shortcut/command-line entry point for packaged applications](https://learn.microsoft.com/en-us/windows/msix/psf/create-shortcut-with-script-package-support-framework). [ngrok's Store instructions use the registered CLI command](https://ngrok.com/download/windows?tab=install). A Microsoft maintainer also describes an identity lookup/retry when a raw package image initially returns ACCESS_DENIED; that explanation does not prove the cause here. [Microsoft explanation](https://github.com/microsoft/terminal/discussions/20060)

## Exact proposed operation

`node scripts/qa/meta-recovery/registered-alias-version.mjs --expected-owner-authorized-one-alias-version`

The default command or `--plan` creates zero child processes. The sole execution flag permits **at most one attempted `version` call**, using the existing protected diagnostic scratch `ngrok-caller-pair-903102b5eed94e98afd0c7d49d10fd56`. There are no path, command, config, token or target arguments. The existing alias-PATH caller environment, eight-entry child environment and working directory are reused.

The launch entry point is exactly the current user's registered `Microsoft\WindowsApps\ngrok.exe` AppExecLink. Live metadata checks must bind its family, application ID and image to the installed `ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc` package. Its signature and raw image SHA-256 must validate; the expected raw image SHA-256 remains `6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16`.

A test-only native fixture separates the launch alias from the verified process image. The retained child handle must still resolve to that exact pinned **raw image**, with verified parent/lifetime, suspended creation, assignment to its own empty kill-on-close Job, image/birth checks before resume and a clean STOP with zero active owned processes. Native creation flags and inherited restrictions are retained. There is no shell, alternate executable, generic reparse exception, privilege change, breakaway or uncontained fallback.

The fixture also requires `ResumeThread` to report previous suspend count **1**. A zero or greater-than-one result blocks the probe; it cannot be labelled a protected-launch PASS. [Microsoft return-value contract](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-resumethread)

The operation uses no ngrok config or credentials, opens no listener, starts no tunnel, database or CRM, and makes no Meta operation. Output is restricted to typed phases, attempted-call accounting, native operation/code and cleanup metadata. Timeout, changed provenance, uncertain cleanup or an unexpected scratch entry blocks continuation. No automatic retry follows failure.

## Interpretation

An alias version PASS would demonstrate that this official entry point works in the controlled surrogate, supporting a reviewed change to the actual supervisor. It would not establish public HTTPS, exact parity with the removed D-drive environment, or Meta E2E delivery. Another error 5 would leave the original cause unresolved and require a different evidence-based investigation, rather than more unsanctioned attempts.

Completed preparation: eleven pure Node tests, eight pure native-fixture target checks, two canonical line-ending hash checks, the nonexecuting plan and independent source review all PASS. No native fixture constructor or alias version call was executed. The actual supervisor's native launch implementation remains unchanged; the new fixture is test-only. The owner decision is limited to this one diagnostic call. Existing restrictions on infrastructure, credentials, Meta, Live Mode, Production, RAM and SL remain in force.
