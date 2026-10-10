# Development 12 — Lead system click, second controlled attempt

Date: 2026-10-10. Branch: `feature/notification-events-phase3`.
Baseline implementation: `53acd199340e55ee21e6dd5ad1a9f31f46d69fa2`.
First Lead pilot Production merge: `1852d5fb6ee1758927ca1a77caf745cfd1a22d67` (same tree).
New active-worker confirmation version: `notification-click-existing-window-2`.

This report updates the readiness assumptions in `notification-click-unified-qa.md`: the first physical automatic Lead click FAILED although its payload and resolver were canonical. Delivery, Center click and read state passed. Task physical pilot remains blocked until Lead system click passes. This implementation does not establish real-iPhone success.

## Trace of the existing synthetic Lead

Read-only Production queries confirmed:

| Field | Value |
| --- | --- |
| Notification ID | `cmv28qrib0003q57q6ztq58wv` |
| Entity type | `lead` |
| Entity ID | `cmv28qqm40002q57qpjccxxu7` |
| Database deepLink | `/leads/cmv28qqm40002q57qpjccxxu7` |
| Canonical resolver | `/notifications/open/cmv28qrib0003q57q6ztq58wv` |
| Delivery ID | `cmv28qru60004q57qh9emd7jm` |
| Attempts / accepted UTC | `1` / `2026-10-10T10:18:04.535Z` |
| Read UTC, after manual Center click | `2026-10-10T10:21:32.782Z` |

The outbox stores notification/subscription references and acceptance state, not a serialized packet. The deployed `pushPayload` builder produces the following deterministic reconstruction from this record and the unchanged privacy preference:

```json
{
  "title": "LegalHub CRM",
  "body": "Вам назначен новый лид\nОткройте CRM для деталей",
  "tag": "cmv28qrib0003q57q6ztq58wv",
  "url": "/notifications/open/cmv28qrib0003q57q6ztq58wv",
  "unread": 1,
  "pilotDiagnostics": false
}
```

`unread=1` is reconstructed using the pre-tap unread/bell evidence. An encrypted APNs packet or on-device Notification object was not captured; this is not a claim of packet inspection. Actual provider acceptance is persisted and the user confirmed receipt.

Executing the actual baseline worker source with this payload yields:

- `notification.data.url`: `/notifications/open/cmv28qrib0003q57q6ztq58wv`.
- `notification.data.workerVersion`: `notification-click-unified-1`.
- Native `navigate`: `https://legalhubcrm.com/notifications/open/cmv28qrib0003q57q6ztq58wv`.
- JS notificationclick, client.navigate, page handoff and openWindow target: the same canonical resolver.
- Raw entity `deepLink` is not supplied as a trusted system-push target.

**The exact URL used internally by the iPhone at the failed tap is unknown.** It was not recorded. The user reported the visible notification Settings screen. Before the later Center click the record remained unread; the scoped request-log query found no rows for the notification. Neither observation identifies an internal WebKit activation branch or proves that no OS navigation was attempted. No subscription endpoints, keys, UA, IP or credentials are recorded here.

## Three paths before this correction

| Layer | A: Center Lead click, physical PASS | B: Phase 2 push_test, physical PASS | C: automatic Lead, system click FAIL |
| --- | --- | --- | --- |
| Entry | Actual `<a>` and page `location.assign` | System notification | System notification |
| Canonical URL | `/notifications/open/cmv28qrib0003q57q6ztq58wv` | `/notifications/open/b6ecd87a-537e-469c-90a4-374b7e9c61ec` | Same URL as A |
| Payload | Center response exposes ID; link uses ID | Safe test copy, UUID tag, diagnostics true | Safe generic Lead copy, CUID tag, diagnostics false |
| Worker | Bypassed | `pilot-click-navigate-2` | `notification-click-unified-1` |
| Native option | Not used | Absolute resolver URL | Absolute resolver URL |
| JS fallback | Not needed | Worker handler if dispatched | Same common worker handler if dispatched |
| Resolver result when reached | Exact Lead | Dashboard by explicit synthetic-test policy | Exact Lead, demonstrated by A |
| Login | Encoded safe canonical `next`, current auth/access recheck | Same canonical return | Same canonical return |

Phase 2 had a diagnostics-selected native option; the accepted unified baseline already removed that type/flag difference. At the failing Lead baseline, the diagnostics flag only selects fixed synthetic telemetry. UUID/CUID both pass the bounded resolver validator. Therefore there is no evidence that the Lead received a Settings URL or a different resolver implementation. The earlier physical push_test success is not evidence that native activation always applies an arbitrary entity resolver when restoring a suspended window.

## Established application defect and limits of the device diagnosis

The baseline always supplies a native action URL. WebKit explicitly describes that action URLs can skip notificationclick even for programmatic `showNotification` notifications ([primary explainer](https://github.com/WebKit/explainers/blob/main/DeclarativeWebPush/README.md)). Consequently, native navigation and JS fallback were alternatives, not a reliable failover chain: if native activation restores the previous page without navigating, the JS code may never run.

The fallback also focused the old page before navigation, accepted a page ACK sent before `location.assign`, and accepted any non-null openWindow result, including a restored Settings window. These are reproduced application-level failures of navigation assurance; they do not prove which one occurred on the earlier device tap.

The official [WebKit tracker, comment 37](https://bugs.webkit.org/show_bug.cgi?id=268797#c37) contains a firsthand iOS 26.6.1 report of native notification activation restoring a suspended existing PWA without applying its navigate URL. That report concerns immutable declarative push; LegalHub uses legacy programmatic push. It corroborates the restoration failure pattern, but is not an engineer-confirmed diagnosis of this LegalHub tap. No precise OS-internal root cause is claimed.

Settings is consistent with the prior screen being restored, rather than the resolver redirecting there. This explanation remains an inference until the second device test. Exact historic device tap URL cannot be recovered retroactively.

## Settings fallback and startup audit

No Settings fallback exists in the deployed worker, payload builder, canonical resolver, bounded login return or auth middleware. Invalid URLs, missing/inaccessible/deleted/reassigned entities and foreign-recipient records use Dashboard. Unsupported notification types do not authorize an entity navigation. Valid Lead resolves to `/leads/{id}`; valid Task resolves to the existing `/tasks?notificationTask={id}` editor.

The manifest `id` and `start_url` are `/dashboard`. PWA focus/pageshow/visibility handlers refresh the current route; they do not replace it with Settings. Subscription UI does not navigate on permission/subscription changes. Notification arrival only refreshes unread state. The Center Settings toolbar is an explicit user action. Other Settings links and unrelated conference/OAuth redirects do not participate in this resolver. **No startup Settings redirect race was found in application source.** OS scene restoration is a different boundary and cannot be ruled out by source inspection.

## Common strategy after the correction

All push_test, Lead and Task payloads retain the unchanged server canonical URL and go through the same window-state strategy:

1. At display, enumerate own-origin top-level windows, with a 500 ms maximum lookup wait. Existing windows, including hidden/suspended ones, omit `navigate` to retain the programmatic click handler. No suitable window uses native cold-launch `navigate` with the exact absolute resolver. Enumeration rejection/timeout does not prevent visible notification display.
2. On an actual JS click, select a suitable window and call `client.navigate(canonicalURL)` before focus. An exact resolver window can be focused/reused. No type or diagnostics flag selects navigation.
3. Native client navigation failure/null or a result still at Settings triggers the same canonical page handoff. The page verifies the worker origin/script and bounded path, issues `location.assign`, then ACKs. A thrown assignment does not ACK. ACK means a request was issued, not that a network navigation completed.
4. If no window accepts the request, `openWindow` gets the exact same absolute resolver. A returned Settings window is repaired through the helper instead of counted as success. No foreign/nested window is selected.
5. Existing ephemeral duplicate-click coalescing, idempotent authorized read state and unread badge behavior remain intact. Arrival, ordinary app resume and notification dismissal never open or mark a notification read.

Native and JS target equality is preserved wherever native is enabled. There is intentionally no native option for an existing suitable window. The snapshot can change between notification arrival and tap; no-window native activation and WebKit event dispatch still require physical verification. The fix does not manufacture click intent from the latest unread item or a dismissed notification.

## Isolated QA

Actual worker source is executed in a VM with simulated WindowClients. Actual notification routes/services run against disposable loopback PostgreSQL with injected session/provider boundaries. **212 PASS, 0 FAIL, 0 skipped.**

| Check | Result |
| --- | --- |
| All three types: existing foreground and hidden/background client | PASS simulated: JS retained; exact resolver navigation before focus |
| No active window; native and openWindow equality | PASS simulated |
| Inert client; rejected/null navigate/focus; absent page listener | PASS simulated: same resolver retained through fallback |
| Restored Settings returned by navigate/openWindow | PASS simulated: not accepted as completed navigation |
| Exact Lead | PASS isolated: actual assigned Lead resolver |
| Expired Lead session | PASS isolated: Login canonical next → authenticated resolver → exact Lead |
| Missing Lead, reassigned/inaccessible Lead, foreign user/tenant | PASS isolated: safe Dashboard fallback |
| Invalid/external/traversal/encoded/query/fragment paths | PASS |
| Duplicate click, read state and badge | PASS |
| Phase 2 push_test, Phase 3A assignment/dedupe, security, tenant isolation, routing and autosave regressions | PASS |

TypeScript PASS; Prisma validate PASS; safe build with unreachable dummy loopback DB PASS; `git diff --check` PASS. Private VAPID/AES values absent from tracked repository and generated client bundles; feature automatic deployment stays disabled. No DB/schema/migration, event generation, dedupe, preferences, privacy, transport, subscription, scheduler or entity editor source changed.

## Controlled second real-iPhone Lead test

User authorized this correction's controlled deployment after isolated QA. Keep the current safe event pilot restricted to TestRezidents organization `cmott4vng0001jkndkto53ji9` and User16. Read-only precheck confirms 22 other organizations denied, one active iOS device, unchanged privacy/preferences, pending delivery zero, scheduler and Phase 3B OFF, no crons.

Confirm actual active worker `notification-click-existing-window-2` on the iPhone after deployment. The user must confirm the PWA is in background before one new synthetic Lead assignment is created through the normal logged-in UI. Use a fresh harmless QA name without real contact/client data; retain previous fixture evidence. Record the new entity, notification, acceptance and read state. A system tap must open that exact Lead ID, rather than Settings. Physical result remains PENDING until the user reports it; do not send Task or claim full Phase 3A completion.

Changed files: `public/notification-sw.js`, `src/lib/notificationBrowser.ts`, `src/lib/pushPilotDiagnostics.ts`, `tests/notification-click.test.mjs`, `tests/notification-events-phase3.test.mjs`, `tests/push-pilot.test.mjs`, and this report.
