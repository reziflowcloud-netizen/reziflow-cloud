# Exact observed Dashboard sample arm

This helper prepares one short-lived transport sample allowance. It does not
emit an event, send HTTP/Graph requests, start a service, change Meta settings,
create/retrieve a real Lead or release the CRM gate. READY means metadata is armed;
it is not a Dashboard delivery result or an automatic Meta-to-CRM E2E result.

Before use, independently inspect the actual Page `leadgen` sample JSON shown for
QA App `2523488421395251` in the Meta Developer Dashboard. Save the exact observed
HTTP body as `dashboard-sample-public.json` outside the private D-drive root,
preferably in the ignored `.qa/meta-recovery-YYYYMMDD/` evidence directory. Do not
invent an envelope, add fields, unwrap an unexplained UI object or reconstruct a
body from a fragment. If the full body is unavailable or differs from the strict
schema, stop and review that evidence. This file must contain no real contacts.

Only `object:page`, one entry with ID `0` or `444444444444`, and one `leadgen`
change are accepted. The Page, Form and Lead IDs must all be the placeholder
`444444444444`. Optional ad/adgroup IDs must use that same placeholder. Only
numeric timestamps and an optional boolean `is_organic` are admitted beyond those
fields. `field_data`, real QA IDs, unknown fields and contact data are refused.
JSON value types are preserved when computing the gateway's canonical body.

After independent code review and only within the owner's test authorisation,
use the approved PowerShell 7 host and existing RemoteSigned policy:

```powershell
run-dashboard-arm.ps1 -PointerPath <private-pointer> -SampleJsonPath <public-sample-file> -ObservedInQaDashboard
```

The caller must first have the reviewed gateway running and public callback ready,
keep unrelated metadata writers frozen, and avoid an imminent shutdown/deadline.
The wrapper repeats the strict active QA database/process/source guard. The arm
module independently checks the exact replacement App/Page/Form, synthetic local
database, closed switches/allowlists, null Lead/attempt/sample gates, and a fresh
preflight whose Page token hash matches the current private credential. An existing
STOP marker blocks arming. It does not inspect or transmit the App Secret.

The only private change is `meta-real-private.json.dashboardSample`, written by
stable-identity checked private staging/rename. It contains the exact canonical
observed body and an expiry **55 seconds** ahead, below the gateway's 60-second
maximum. Existing proof, previous test information, closure timestamps and cleanup
T0 are preserved; neither this operation nor another sample extends cleanup clocks.
The gateway consumes that exact signed sample once, clears the arm and returns a
sample-only response without forwarding it to CRM. It rejects expired/mismatched
samples through its usual closed gate. The helper does not clear or rearm an
existing allowance automatically. On an unexpected concurrent shutdown or write
failure, treat the result as BLOCKED and inspect safe metadata before any retry.

Public output is a fixed readiness/error object with zero emitted requests/tests.
The new result file alone plus the existing anonymous preflight result are scanned
before and after finalisation. The public input sample and private metadata are
not scanned as anonymous output artifacts. No token, body, resource ID, canonical
sample, hash or private path is returned. Both the public input and private arm are
QA artifacts covered by the existing cleanup procedure.

`node --test scripts/qa/meta-recovery/dashboard-arm.test.mjs` uses planted strings
and temporary files only. It does not open ports, call providers, start processes
or connect to a database. No actual sample request should be sent until this helper
and the observed UI body have been independently reviewed.
