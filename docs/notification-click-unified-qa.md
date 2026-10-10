# Development 12 — unified notification activation QA

Date: 2026-10-10. Branch: `feature/notification-events-phase3`.
Accepted Phase 3A base: `1e42e390f16e18c9d60e550a233ab4e69533f847`.
Worker/version confirmation: `notification-click-unified-1`.

This report supersedes the click-path readiness blocker in `notification-events-phase3-qa.md`. Implementation and isolated verification only. No Production deployment, configuration change, Production fixture creation or real push was performed. Phase 3B was not started.

## Exact root cause

| Layer before this fix | Working physical `push_test` | Automatic New Lead / New Task |
| --- | --- | --- |
| Server payload URL | `/notifications/open/{notificationId}` | Same resolver format |
| Payload diagnostics flag | `pilotDiagnostics=true` for a valid synthetic pilot record | `pilotDiagnostics=false` |
| Worker display branch | Adds absolute same-origin `NotificationOptions.navigate` | Omits `navigate` |
| Activation | WebKit can navigate natively without waking the click handler | Relies on worker `notificationclick` execution |
| Script fallback | `clients.matchAll`, same-origin window focus, page ACK, `client.navigate`, then `openWindow` | Same fallback, but it is the only navigation mechanism |
| Authenticated resolver | Session/access check, mark read, Dashboard | Session/access check, mark read, exact Lead/Task route |

The decisive code difference was `...(payload.pilotDiagnostics === true ? { navigate: ... } : {})` in `public/notification-sw.js`. A telemetry flag accidentally selected the navigation mechanism. Payload resolver URLs themselves were correct. The pilot iPhone previously failed background navigation through the script fallback without recording a click trace, while the native option worked physically for test pushes. This is consistent with failure to wake/execute the worker; the internal iOS cause cannot be established from those observations alone. Automatic entity pushes have not yet been tested physically.

WebKit describes optional native activation for legacy programmatic notifications in its [explainer](https://github.com/WebKit/explainers/blob/main/DeclarativeWebPush/README.md) and the [NotificationOptions.navigate standards discussion](https://webkit.org/blog/16535/meet-declarative-web-push/). This change extends the existing programmatic option; it does not change the push transport or migrate payloads to declarative Web Push.

## Unified navigation

Every push type now receives the same `navigate` option from `notificationNavigationTarget`. All script activations use `openNotification` and `navigateNotification`; there is no test-only navigation branch. The diagnostics flag continues to restrict existing synthetic telemetry only.

The target helper accepts only a bounded internal `/notifications/open/{id}` path. Absolute URLs (including own-origin absolute input), protocol-relative URLs, external origins, traversal, encoding, query strings, fragments and malformed/overlong IDs cannot become navigation destinations. Invalid input uses internal Dashboard. Both native and script strategies use the same normalized target.

The fallback enumerates own-origin top-level windows, prioritizes an exact resolver window, and focuses/reuses it. Otherwise it tries the existing page ACK handoff, then native client navigation. Rejection/null/suspended-client failure preserves the intended resolver URL for `openWindow`. Enumeration failure also falls through to `openWindow`. A successfully opened window is focused when possible; a final focus failure does not create another window. Concurrent/rapid repeated clicks on the same resolver share a bounded ephemeral navigation operation, with a two-second success cooldown and immediate retry after failure. This coalesces click navigation only and does not change notification generation/dedupe.

## Deep links, access and state

The existing resolver remains the authority; a push never supplies a trusted entity URL. It rechecks the current authenticated recipient, organization and current entity access, then derives the link from the authorized database record:

- Lead: `/leads/{id}`.
- Task: `/tasks?notificationTask={id}`. The existing Tasks page fetches `/api/tasks/{id}` with current authorization and opens that task in its existing editor.
- Expired session: Login with encoded `next=/notifications/open/{id}`. The existing `safeNotificationReturn` accepts only a bounded resolver path. After sign-in the resolver rechecks access and opens the intended entity.
- Missing/deleted/reassigned/inaccessible or foreign-user notification: Dashboard; no stale entity link is returned. The only resolver behavior change is this fallback destination (previously notification settings).
- Valid test notification: Dashboard by its existing explicit test policy.

Authorized opening marks read idempotently; push arrival alone does not mark read. Existing page status refresh updates the bell and app badge. Worker unread zero still clears the app badge. No badge/subscription mechanism was changed.

## Isolated QA evidence

Full test suite with real loopback PostgreSQL, `RUN_DB_TESTS=1`: **206 PASS, 0 FAIL, 0 skipped**. Worker tests execute the actual worker source in a VM with simulated browser clients and actual server payloads for all three types. Route/service tests execute actual code against local PostgreSQL with injected session, billing and provider boundaries. No real browser/iPhone execution is claimed for these simulations.

| Scenario | Result and evidence |
| --- | --- |
| Test, Lead and Task push click | PASS: identical native resolver option and shared script strategy |
| Foreground, existing window | PASS simulated: focus and accepted page handoff, no extra open |
| Background/suspended client | PASS simulated: focus/message/navigation failure preserves resolver to openWindow |
| Fully closed/no window | PASS simulated: exact resolver opened once, returned window focused |
| Exact resolver reuse | PASS simulated: focus without reload; failed focus retains fallback |
| Foreign/malformed/nested window; enumeration failure | PASS simulated: skipped safely, intended own-origin window opened |
| Duplicate click | PASS: concurrent/rapid clicks coalesced, later deliberate clicks work; unsuccessful open remains retryable |
| Expired session | PASS isolated: unauthenticated resolver → encoded Login next → actual safe return helper → authenticated resolver → exact Task |
| Lead deep link | PASS isolated: actual assigned Lead notification resolves to exact Lead |
| Task deep link | PASS isolated: actual Task notification resolves to exact Task editor URL |
| Inaccessible entity | PASS isolated: old restricted recipient after reassignment, deleted Task and foreign tenant/user rejected to Dashboard |
| Invalid URL | PASS: native, fallback, page handoff and Login return reject unsafe input |
| Read/badge | PASS isolated: push-only authorized opening marks read, duplicate does not rewrite readAt, authorized unread becomes zero, worker badge zero clears |
| Phase 2 / Phase 3A / security / tenant / dedupe / autosave | PASS: full notification, push pilot, event, DB/routing, auth and security regression suite |

Additional checks: TypeScript PASS; Prisma validate PASS; safe build with unreachable dummy loopback DB PASS; `git diff --check` PASS. Private VAPID/AES value and generated client asset scan PASS. No Prisma schema or migration change.

Scope checked against accepted Phase 3A base: event generation, event dedupe, routing/round-robin, preferences, privacy, transport/VAPID/AES, subscription model, scheduler, login and entity editor source are unchanged. Application edits are limited to the worker, its version constant and the resolver's inaccessible-target fallback.

Read-only Production confirmation: deployment `dpl_CKsWGmacQx9bqDbUdSLD4xR1Xk31`, READY, main commit `0c6582cd15a102582947fb9888664da4a92c0ffb`; project and domain pointers agree. Automatic events OFF; privacy OFF; one active device; pending deliveries zero; cron definitions/deployed crons empty. Feature-branch automatic deployment remains disabled.

## Controlled real iPhone QA plan — prepared, not executed

Readiness for this next QA stage: **YES**. Physical automatic Lead/Task activation remains **PENDING**, requiring separately authorized controlled deployment. Do not enable events or send anything during this implementation stage.

After separate approval, restrict the event gate to the existing test organization and pilot user only. Keep privacy OFF, scheduler/Phase 3B OFF. Verify worker version `notification-click-unified-1` on the iPhone before testing. Use new synthetic assignment operations through the existing Lead/Task routes, not manually inserted Notification rows, to exercise the accepted automatic event path. Use harmless QA titles and no real names, phone numbers, emails or client records.

Record each synthetic entity ID and notification ID before tapping. Assign a synthetic Lead to the pilot's linked Employee/User, and a synthetic Task to the pilot user. Confirm only the intended pilot receives the push and one record/delivery per operation. Open the PWA normally once before putting it in the relevant state.

| Physical step | Expected result | Status |
| --- | --- | --- |
| Lead, PWA foreground, tap push | Existing LegalHub reused; exact recorded Lead ID opens | PENDING |
| Task, PWA foreground, tap push | Existing LegalHub reused; exact recorded Task editor opens | PENDING |
| Background PWA; new synthetic Lead assignment; lock phone; tap | Exact Lead opens after unlock; no notification settings fallback | PENDING |
| Background PWA; new synthetic Task assignment; lock phone; tap | Exact Task editor opens after unlock | PENDING |
| Fully close LegalHub; fresh Lead assignment; tap lock-screen push | PWA/window opens and exact Lead survives startup | PENDING |
| Fully close LegalHub; fresh Task assignment; tap lock-screen push | PWA/window opens and exact Task editor survives startup | PENDING |
| Expire pilot session; fresh assignment; tap; sign in as pilot | Safe resolver return opens intended authorized entity | PENDING |
| Remove access/delete synthetic target before tap | Dashboard fallback, no foreign/stale entity data | PENDING |
| Each successful open; return to bell; repeated tap | Read state, expected unread decrement/badge and no duplicate record/window | PENDING |

Use a fresh synthetic entity/assignment per scenario or an explicitly tracked new operation so event dedupe is exercised correctly. Observe time from tap to usable entity separately; no real-device latency claim follows from VM tests. If navigation/session/tenant behavior fails, stop the pilot and preserve the IDs and non-sensitive observations for diagnosis. After testing, restore the pre-pilot event gate and safely remove only recorded synthetic fixtures after retaining QA evidence. Do not touch real customer data, keys or subscriptions.

## Changed files in this fix

- `public/notification-sw.js`
- `src/app/notifications/open/[id]/route.ts`
- `src/lib/pushPilotDiagnostics.ts`
- `tests/notification-click.test.mjs`
- `tests/notification-events-phase3.test.mjs`
- `tests/notifications-browser.mjs` (fallback expectation only; browser script not executed)
- `tests/push-pilot-api.test.mjs`
- `tests/push-pilot-diagnostics.test.mjs`
- `docs/notification-click-unified-qa.md`

Final commit hash, local/remote equality and clean Git status are reported in the final response. No PR, merge or deployment. STOP after the report.
