# Development 12 — Phase 3A pre-pilot report

Date: 2026-10-10. Base: `0c6582cd15a102582947fb9888664da4a92c0ffb`, fresh `origin/main`.
Branch: `feature/notification-events-phase3`. Implementation and isolated QA only; no deployment, merge, Production writes, synthetic Production records or new scheduler.

## Implementation

Only `lead_assigned` and `task_assigned` can run with the Phase 3A gate. Generation requires `NOTIFICATIONS_ENABLED=true`, `NOTIFICATION_EVENTS_ENABLED=true`, a valid nonempty `NOTIFICATION_EVENTS_PILOT_ORG_IDS` and a valid nonempty `NOTIFICATION_EVENTS_PILOT_USER_IDS`. Both tenant and recipient must match. One malformed item closes the whole corresponding allowlist. No real tenant or User identifiers are hardcoded in application source. Future Production configuration is restricted to the existing TestRezidents/User16 pilot and requires separate approval.

`NOTIFICATION_SCHEDULED_EVENTS_ENABLED` defaults OFF. Existing scheduled evaluator and scheduled outbox delivery require this additional flag. No cron configuration was added, and none was enabled. Phase 3B was not started.

Assignment Notification and outbox rows are persisted inside the entity transaction. Dispatch runs after commit through the existing VAPID/encryption/provider sender. It scopes pending deliveries to the allowed tenant, allowed recipient and affected entities, and rechecks current preferences, entity access and Employee linkage. Provider failures do not undo assignment. Sender leases and delivery uniqueness prevent concurrent normal sends. Immediate dispatch uses 20-row pages; additional pages start only within the first 30 seconds, and an in-flight sender page may finish later. Provider backoff and any remaining bulk tail stay durable. With scheduler OFF, later attempts require another scoped dispatch or an explicitly authorized delivery-only internal call. No unattended retry schedule is claimed.

Lead hooks cover manual creation/reassignment, bulk assignment, generic webhook, Telegram, Meta Lead Ads, Meta messages and conversation sync. Active Employee↔User linkage is required for Lead assignment generation and is checked again before delivery. Ingestion locks the tenant before replay lookup and routing. Generic webhook identity prefers `Idempotency-Key`, `eventId` or `externalId`, otherwise hashes a canonical sanitized payload. Exact replay uses an existing LeadWebhookLog marker, independent of JSON property order and the former 15-minute contact window. A deleted logged Lead remains a replay tombstone. External event IDs should be used when two intentionally distinct leads have identical payloads. Channel and legacy fallback round-robin cursors advance only when creating a new Lead. Bulk updates use a monotonic timestamp after their row locks.

Task creation uses `X-LegalHub-Create-Request` (UUID v4) as an operation identity, scoped by tenant and authenticated creator. A transaction advisory lock and deterministic Task ID return the same record on concurrent or lost-response retries. Changing the payload for the same key returns 409. Current Tasks, Calendar and Case task-create callers retain the key on network/JSON-body failure and end the operation after a confirmed successful JSON response. Assigned Task creation in an enabled pilot tenant rejects an ambiguous keyless request with 428 (reload CRM); keyless compatibility remains outside that gate. Reassignment uses the existing row lock/version guard. Ordinary edit, autosave and unchanged assignment do not emit an event.

Existing channel policy is preserved: in-app ON/push OFF creates a visible record without an outbox; in-app OFF/push ON creates a hidden record usable through the authenticated resolver. Opening it marks it read. Owner/admin mine and team preferences remain subordinate to access. Employee preferences cannot grant team copies. Privacy defaults OFF; UA assignment push text uses “Новий лід призначено вам” / “Нове завдання призначено вам”, with no client identity. Notification Center retains authorized entity context.

## Isolated verification

Local loopback PostgreSQL only, database name containing `notifications_qa`. Full repository test suite including security hardening and `RUN_DB_TESTS=1`: **201 PASS, 0 FAIL, 0 skipped**. Actual route/service code runs against PostgreSQL; only session, billing and provider boundaries are injected. Signed Meta requests still use the actual HMAC verifier; external Graph responses are synthetic.

- Lead manual create, same-assignee, ordinary autosave, reassignment and concurrent repeated handler: PASS.
- Task create, five concurrent identical operations, changed-key-payload rejection, keyless pilot rejection, reassignment, title/date/priority edit and same-assignee: PASS.
- Generic webhook concurrent replay, canonical replay without external ID, deleted-Lead replay, channel round-robin, explicit external assignment and locked legacy fallback round-robin: PASS.
- Telegram, signed Meta Lead Ads, Meta messages and conversation sync concurrent replay: PASS.
- Bulk concurrent assignment, mismatched/unlinked/inactive Employee validation: PASS.
- Owner mine/team, employee own-only, restricted foreign entity writes, org/recipient gates, cross-tenant event identity and existing composite FKs: PASS.
- Independent preferences, privacy, scoped provider stub delivery, no repeat delivery, authenticated Lead/Task resolver, push-only read, unauthenticated login return, foreign-user rejection and unread count to zero: PASS.
- Actual after-commit dispatcher drains a 21-row outbox through two pages under concurrent dispatch without duplicate sends; disabling an Employee link before Lead delivery cancels that delivery: PASS.
- Staff Routing database/migration regression, Lead visibility, Case/Lead/Client/Task autosave, auth/session/security, worker click and badge policy regression: PASS.
- TypeScript, Prisma validate, safe Production build with a dummy unreachable loopback DB, and `git diff --check`: PASS. No migration/schema change.
- Repository and generated client assets scanned for existing Production private VAPID/AES values: absent. No private server configuration names in client assets.

Worker, subscription encryption, VAPID architecture, badge mechanism, browser click handler and authenticated deep-link resolver are unchanged from base. Changes to `notificationPush.ts` are assignment copy, automatic delivery selection and recipient rechecks; provider transport/encryption/options remain the existing implementation.

## Read-only Production confirmation

Deployment remains `dpl_CKsWGmacQx9bqDbUdSLD4xR1Xk31`, READY at the base main commit. Domain and project Production pointers agree. Automatic events remain OFF, center/push remain ON, privacy OFF, one active device, zero pending deliveries. Cron definitions and deployed crons remain empty. Checks ran in a read-only transaction and read-only Vercel API calls. No new Phase 3 event allowlist or scheduler was installed.

## Readiness: NO — iPhone click limitation needs resolution

Backend isolated QA is complete. There is a concrete mismatch between the successful Phase 2 physical pilot and automatic assignment pushes: `public/notification-sw.js` adds native `NotificationOptions.navigate` only when `pilotDiagnostics === true`, while `pushPayload` sets that flag only for a valid synthetic `push_test`. Assignment events correctly have `pilotDiagnostics=false` and retain the older click fallback, which previously failed to navigate from the background on the pilot iPhone. Automated resolver/worker tests pass but cannot establish real iPhone behavior for this path.

The requested prohibition on worker/click changes was honored. Do not treat the Phase 2 synthetic success as physical Lead/Task click evidence. A separately authorized extension of the proven native navigation path, or an explicit decision to test the existing fallback with this known risk, is needed before recommending a Production 3A pilot. No automatic notification was sent to the real iPhone in this stage.

After that decision and a separate Production approval, the controlled plan is one synthetic Lead and one synthetic Task in the existing pilot tenant, assigned to its linked pilot Employee/User. Verify Notification Center, unread badge, physical background/closed delivery, click to the corresponding Lead/Task, read and badge reset; then safely remove synthetic data. Keep scheduler and all Phase 3B types OFF. This plan was prepared, not executed.

## Changed files

Application/services:

- `src/lib/notificationEventGate.ts`
- `src/lib/assignmentDelivery.ts`
- `src/lib/inboundLeadEvent.ts`
- `src/lib/taskCreate.ts`
- `src/lib/createTaskFetch.ts`
- `src/lib/notifications.ts`
- `src/lib/notificationPush.ts`
- `src/lib/notificationJobs.ts`
- `src/lib/entityWrite.ts`
- `src/lib/bulkActionServices.ts`
- `src/lib/leadRouting.ts`
- `src/lib/leadWebhookHandler.ts`
- `src/app/api/leads/route.ts`
- `src/app/api/leads/[id]/route.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/webhooks/telegram/leads/[slug]/[key]/route.ts`
- `src/app/api/webhooks/meta/leads/[slug]/route.ts`
- `src/app/api/webhooks/meta/messages/[slug]/route.ts`
- `src/app/tasks/page.tsx`
- `src/app/calendar/page.tsx`
- `src/app/cases/[id]/page.tsx`

Tests/configuration/report:

- `tests/notification-events-phase3.test.mjs`
- `tests/notifications-db.test.mjs`
- `package.json`
- `vercel.json` (automatic deployment disabled for the new feature branch)
- `docs/notification-events-phase3-qa.md`

The committed branch hash, local/remote equality and final clean Git status are reported in the final chat response. No PR, merge or deployment is created by this stage. STOP after the pre-pilot report.
