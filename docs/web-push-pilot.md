# Phase 2 — Real Web Push Pilot: pre-pilot preparation

Prepared 2026-10-10 from `origin/main` `cb8b3ce94e0f2ea5804ff497f1b4a708210d2ad2`, branch `feature/web-push-production-pilot`.

**Production deployment, environment changes and real sends require separate approval under section 19 of the user request. No Phase 3 work.**

## Production baseline — read-only

`legalhubcrm.com` serves the base commit. Flags: `NOTIFICATIONS_ENABLED=true`, `NOTIFICATION_EVENTS_ENABLED=false`, `WEB_PUSH_ENABLED=false`. Project cron definitions and deployed crons are empty. Notification, NotificationPreference, PushSubscription and NotificationPushDelivery each have zero rows; active subscriptions and pending deliveries are zero. No VAPID/push encryption/environment/allowlist variables exist in Vercel in any target. Recheck before an approved rollout.

## Implementation and safeguards

Existing SW, explicit permission handler, subscription API/AES-GCM encryption, VAPID sender/outbox, click/auth resolver, optional badges and unsubscribe/404/410 cleanup are reused. No migration or schema change.

`WEB_PUSH_PILOT_USER_IDS`: comma-separated positive safe integer User IDs, maximum 50. Missing/blank/malformed configuration denies everyone. `PUSH_TEST_USER_ID` is a legacy fallback only when the new variable is absent; blank/invalid new values never fall back. No hardcoded email. Other Users have no active enable/test controls or usable public-key config and retain Phase 1. Valid matching VAPID/AES values, runtime environment, center/push flags and allowlist are required.

The authenticated subscription GET lists only own active device ID/coarse label/creation time (maximum ten), without endpoints or keys. Settings offers an own-device selector. A desktop browser signed into the **same own QA account** can select its iOS subscription and send while the iPhone is backgrounded/closed, without subscribing the desktop.

`POST /api/notifications/test-push` accepts only subscription ID, UUID-v4 request ID and optional RU/UK/PL language. User/tenant come from the session. Foreign Origin, unauthenticated/non-pilot calls, foreign/disabled devices and arbitrary recipient/body fields are rejected. Master push must be enabled. Transaction locks enforce one new test per 30 seconds and twenty per rolling 24 hours. Repeated IDs reuse one record/outbox; changing its device is rejected.

Each test creates one own in-app synthetic record, without real entities. Visibility requires its own recipient/tenant and strict synthetic marker. Fixed localized title/body never include identity, including privacy ON. Push title is `LegalHub CRM`; tag is the record ID. `/notifications/open/<id>` rechecks auth, marks read and redirects to Dashboard. Expired sessions return through login to this resolver. Normal entity access rules remain enforced.

The existing worker handles only the exact manual delivery/User/tenant. One provider attempt per request, even with concurrent retry or expired lease. 404/410 disable the own device and erase encrypted endpoint/keys. Other manual failures become terminal. A crash around provider acceptance can leave status pending: a repeated ID checks state and **cannot resend**. Inspect the device before deliberately starting a new test. Normal worker calls exclude pilot rows and cannot drain automatic deliveries while events are OFF. Events and scheduler stay OFF.

UI reports provider acceptance, never OS delivery. Permission stays behind the explicit enable click. The SW keeps its existing push/click-only behavior, without fetch/cache storage. Optional badges do not block push.

## Secrets prepared, not installed

Production pair/AES key are in a Windows user-only ACL folder **outside Git**:
`C:\Users\verbe\Documents\LegalHub Private Backups\web-push-pilot-20261010\production.env`.
Public-key fingerprint: `7deca26fea29ca21`. Do not put file contents into chat, logs, screenshots or browser. Nothing was installed in Vercel.

| Production variable | Source/value | Handling |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | Prepared matching pair | Authenticated pilot config; public key may be client-visible |
| `VAPID_PRIVATE_KEY` | Private file | Sensitive server-only Production target |
| `VAPID_SUBJECT` | `https://legalhubcrm.com/contact` | Server contact URI |
| `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` | Prepared 64-hex AES key | Sensitive server-only Production target |
| `PUSH_ENVIRONMENT` | `production` | Must match runtime |
| `WEB_PUSH_PILOT_USER_IDS` | One confirmed own QA User ID | Resolve identity before enabling |
| `NOTIFICATIONS_ENABLED` | `true` | Preserve Phase 1 |
| `NOTIFICATION_EVENTS_ENABLED` | `false` | Preserve |
| `WEB_PUSH_ENABLED` | `false` until approved release, then `true` | Server rollback switch |

Private values have no `NEXT_PUBLIC_` prefix. QA generates fresh in-memory VAPID/AES keys and never reads the Production private file. Preview push variables are absent; a later Preview/Test deployment must have an isolated DB, different VAPID/AES/cron values and `PUSH_ENVIRONMENT=preview`. Never inherit Production secrets. This is initial provisioning with zero subscriptions; if that changes before rollout, stop and check existing keys instead of rotating them.

## Exact rollout — only after separate approval

1. Record approved feature commit and current deployment/env metadata. Fetch main, check divergence and rebase/revalidate if needed. Recheck flags, empty scheduler, migrations and subscription counts. Existing notification schema is installed; **no new migration**.
2. Resolve the User ID/tenant from the user's own authenticated QA/Admin session. Confirm iPhone and desktop operator use that same account. Do not guess an ID from someone else's session. Stop before env changes if identity is ambiguous. No private key, endpoint or auth token is requested through chat.
3. Install prepared keys/subject/AES/environment and exactly one confirmed allowlisted ID through authenticated server-side Vercel tooling, **Production target only**, with push OFF during provisioning and events false. Read values in memory; never echo them or pass secret values as command-line arguments. Verify matching pair and target separation with safe boolean/fingerprint output.
4. Set push true only as part of the approved release. Merge/promote the reviewed feature commit through the approved release procedure. Verify exact commit, READY deployment and `legalhubcrm.com` alias. Automatic deployment of the feature branch is disabled; pushing it does not release it.
5. Verify runtime flags `true/false/true`, empty cron definitions/deployed crons, single confirmed allowlisted ID, and non-pilot config `pushAvailable=false`, `publicKey=null`. Confirm non-pilot subscribe/test reject without writes. Do not invoke notification jobs or create real-entity events.
6. Follow the iPhone checklist below. Confirm one own active iOS subscription; send one test per state. Background/closed sends come from the same account's desktop selector, with iOS explicitly selected. Wait at least 30 seconds between distinct tests. Never target another User/device.
7. Record actual outcomes. **Background system notification PASS plus one real iPhone subscribe/delivery/click are mandatory before real pilot PASS.** Provider acceptance alone is insufficient. Record foreground banner suppression and optional badge limitations. A second physical device can be a later gate.
8. Restore captured initial privacy preferences. Keep events/scheduler OFF after success. Stop and report; widening onboarding or enabling Phase 3 requires separate approval.

Rollback: set `WEB_PUSH_ENABLED=false`, clear the allowlist and redeploy approved code with those values, or restore the previous deployment with push OFF. Preserve center=true, events=false and empty scheduler configuration. Verify onboarding/sending fail closed. Keep keys/additive tables; no destructive migration or rekey. Own-account master-off/unsubscribe is an extra user-level stop.

## Short iPhone checklist — pending approved deployment

Use real HTTPS and iOS/iPadOS 16.4+ Home Screen standalone. Permission follows direct user interaction; feature detection and optional badges are used. [WebKit's platform requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). Record version, standalone vs Safari, SW active, PushManager and actual OS behavior without endpoints/keys.

1. Open LegalHub from Home Screen, confirm standalone and own QA account.
2. Settings → Notifications.
3. Press Enable; no prompt should appear on login/load.
4. Allow the system prompt, record granted or denied UI.
5. Confirm this device active, own iOS selected, SW active and PushManager available.
6. Receive one foreground test; fixed text, one center record/unread increase, duplicate handling. Record actual banner behavior.
7. Background app; send once from same account's desktop selector. **System notification must arrive.**
8. Close/remove app from foreground; send after cooldown. Record SW/system delivery.
9. Tap push: focus/reuse where supported or standalone window; authenticated Dashboard resolver. Separately check expired-session login/return.
10. Check read/unread and actual icon badge increase then clear on read; unsupported badge is a recorded platform limitation.
11. Disable on iPhone.
12. Verify device absent/inactive; old target rejects and receives no subsequent test.
13. Enable again; test the new/current active device. Restore original privacy preference.

Pilot payload stays identity-free even with privacy ON. Optional richer synthetic-entity privacy QA belongs to an isolated fixture; it does not authorize Production automatic events.

## Isolated verification

Final regression result: **177 PASS, 0 FAIL, 4 unrelated fixture-dependent SKIP**. TypeScript, Prisma schema validation and optimized production build PASS. Production private values and private config names are absent from the client build; prepared private values are absent from repository files. Production read-only audit repeated with unchanged commit/flags/zero counts.

- PG16 loopback `legalhub_notifications_qa_phase1`, injected sender: recipient/device isolation, concurrent dedupe, malformed gates/markers, master/flags OFF, request language, cooldown/daily cap, crash ambiguity, privacy/read, unsubscribe/re-enable and 404/410 erasure.
- Actual Next handlers with isolated auth/provider dependencies. Actual localhost HTTP also checks middleware auth, non-pilot config/onboarding/test rejection, foreign Origin for test/subscription/preferences, arbitrary-body denial and SSRF.
- Existing SW VM execution: stable tags, push body, optional set/clear badge, safe click/navigate/focus/openWindow, unsafe URL fallback, no fetch/cache behavior.
- Actual enable handler execution covers default/granted/denied/unsupported and click-before-await. Chrome localhost UI uses temporary mocked permission/PushManager and intercepted test responses; subscription POST/DELETE hit the actual isolated API. Retry retained request ID; re-enable requested no second permission. Reload removed mocks; actual OS permission default, zero local subscriptions, master/privacy false afterwards. No real provider call.
- RU/light 390px, UA/dark 414px, PL/slate 430px and desktop controls: no horizontal overflow; console errors zero.
- Real iPhone HTTPS standalone, Apple transport, background/closed system notification, click and physical badge: **PENDING**. Production unchanged.

Reproduce with `NOTIFICATIONS_TEST_DATABASE_URL` pointing only to a loopback database named with `notifications_qa`: `npm run test:notifications`; `node --test tests/*.test.mjs tests/security/*.test.mjs`; `npx tsc --noEmit`; `npx prisma validate`; `npm run build`. Build uses an unreachable synthetic DB and runs no migration. Four unrelated staff-routing DB tests require their own fixture and are not counted as passed.

## Changed files

### Native pilot navigation after real-device diagnostics

On the pilot iPhone running iOS 26.6.2, the fresh `pilot-click-diag-1` worker logged receipt of the background test, but no click/navigation trace arrived and the user reported Settings opening again. With the app fully closed, receipt, `click-start`, `clients-found` and `open-window` were recorded; the user reached Dashboard and the own resolver marked the synthetic record read. The interval between click and openWindow resolution was about 11 seconds, and the user reported slow loading. This confirms the closed-app path, but does not prove the cause of the separate background failure.

Worker `pilot-click-navigate-2` sets the standard `NotificationOptions.navigate` only for marked synthetic pilot pushes, using the validated same-origin notification resolver (or Dashboard for invalid paths). Modern WebKit handles activation through that URL without a worker click event; older browsers ignore the option and retain the existing authenticated click fallback. This does not change the push transport format, subscription or allowlist. Native activation therefore need not produce `click-start`; acceptance requires physical Dashboard navigation and the own resolver/read evidence. [Notification creation and activation semantics](https://notifications.spec.whatwg.org/#activating-a-notification). A fresh worker check and a controlled real background repeat are still required before claiming the fix passes. Icon badge, unsubscribe and re-enable remain pending; automatic events and scheduler remain OFF.

### Activation diagnostics after the failed repeat

The background repeat after the first activation fix again restored Settings with the new synthetic notification unread. System-click activation remains **FAIL**; no real-device success is inferred from VM tests. Request logs show worker script requests before the repeat but cannot prove which worker executed on iPhone.

The single allowlisted pilot can expand the device check in Notifications Settings and confirm the active worker version through a MessageChannel. This check does not prompt for permission, subscribe, mark a notification read or send a provider push. The read-only authenticated diagnostics API exposes only the expected version and an own synthetic test ID. Its POST accepts fixed stages/version and opaque notification/runtime IDs only, rechecks own tenant/user and a recent valid synthetic marker, and logs those bounded fields for diagnosis. It denies foreign origins, non-pilot users, arbitrary fields, client payloads, endpoints and real records; it performs no database writes. The worker reports receipt and click stages only for marked synthetic tests. Trace requests are bounded, do not precede navigation with a network wait, and failures cannot stop the normal click fallback. No worker storage/cache is introduced. Normal notification settings for non-pilot users have no diagnostic controls.

Absence of a click trace is not by itself proof of a WebKit bug: failed authentication/network delivery can also hide a trace. Calibrate an accepted worker-check/receipt trace, record actual worker versions, then correlate click stages, HTTP requests and own read state. Do not infer a clicked notification from removal/dismissal or auto-mark unread records on app resume. Further real pushes require the user to confirm the chosen device state. Background delivery remains PASS; closed-app delivery, successful system activation, icon badge, unsubscribe and re-enable remain pending.

### iPhone notification activation follow-up

The first controlled Production test reached the pilot iPhone while the app was in the background. The user confirmed a lock-screen system notification with the synthetic Ukrainian copy. Opening its Notification Center record reached Dashboard, marked it read and cleared the in-app bell count. Tapping the system notification initially restored the Settings page instead of following the resolver; this activation check remains failed until a real-device repeat passes. Closed-app delivery, Home Screen icon badge, unsubscribe and re-enable remain pending.

Notification activation now first wakes an existing same-origin window and requests a bounded resolver navigation from the page over a one-use MessageChannel. Only the same-origin notification worker and a Dashboard or strict notification resolver path are accepted. Page acknowledgement prevents duplicate native navigation. If the page cannot acknowledge within one second, native navigation uses the returned WindowClient; null/rejection falls through to another window or openWindow. Failed focus cannot abort navigation. Existing registrations check for worker updates on app load without permission prompts or new subscriptions. No notification payload, pending click or CRM data is persisted in the worker.

The fallback addresses unhandled client navigation failures; the exact iPhone failure cause is not proven without device diagnostics. [WebKit reports similar Home Screen notification activation failures](https://bugs.webkit.org/show_bug.cgi?id=263687). Automated regression covers suspended-client handoff, native navigation null/rejection, focus rejection, missing listeners, transport failure, foreign clients and unsafe paths. Automatic events and scheduler stay OFF throughout.

- `src/lib/pushSecurity.ts` — fail-closed pilot allowlist.
- `src/lib/pushPilotPolicy.ts` — fixed localized text and strict synthetic marker.
- `src/lib/pushPilot.ts` — scoped/manual/idempotent/rate-limited creation and delivery.
- `src/lib/notificationPush.ts` — reuse sender with exact scope, one manual attempt and events-OFF protection.
- `src/lib/notifications.ts` — own synthetic record visibility.
- `src/app/api/notifications/test-push/route.ts` — authenticated, same-origin manual endpoint.
- `src/app/api/notifications/subscriptions/route.ts` — safe own device list/ID.
- `src/app/notifications/open/[id]/route.ts` — authenticated synthetic Dashboard resolution.
- `src/app/settings/notifications/page.tsx` — restricted onboarding, device selector, manual test and pending state.
- `src/components/NotificationCenter.tsx` — immediate manual-test refresh.
- `src/components/Notifications.module.css` — responsive pilot controls.
- `tests/push-pilot.test.mjs` — policy, SW and isolated PG/provider-stub verification.
- `tests/push-pilot-api.test.mjs` — actual handlers and permission-handler execution.
- `package.json` — include pilot tests in notification QA command.
- `vercel.json` — disable feature-branch automatic deployment.
- `docs/notifications-architecture.md` — align Phase 2/physical gates.
- `docs/web-push-pilot.md` — rollout, secrets handling, rollback, QA and manual checklist.
