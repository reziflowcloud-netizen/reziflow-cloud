# Notification Center and Web Push — architecture and rollout

Base: `bdaa846bce8228109ad6aab70b27249cef08f825` (fresh origin/main, 2026-10-09).
Branch: `feature/notifications-web-push`. No production deployment or database access.

## Audit

Next.js 14 App Router, Prisma 5, PostgreSQL. Auth cookies carry User and organization; getUser checks sessionVersion in DB. Employee.user uses the existing composite User(id, organizationId) relation. Owner/admin have full access; other users may be restricted. Lead, Case and Task restricted access is assignedToId. Employee routing mirrors linked User into assignedToId. Notification preferences must never override that access rule.

Each authenticated layout includes Sidebar and MobileNav. Existing mobile navigation has five items; CompactMobileHeader covers entity screens while dashboard/settings use page-header. Themes use CSS variables with light/dark/slate variants. Manifest already requests standalone, root metadata already supports Home Screen. No Service Worker or configured cron exists. Tasks use dueDate and JSON description.reminderAt; generated tasks reference cases/leads in metadata. Lead uses nextContactAt, lastContactAt, convertedAt; terminal default statuses are “Не подходит” and “Переведён в клиента”. Important dates include historical filing/MOS dates, which must be excluded from upcoming notifications.

## Proposed schema (before implementation)

- Notification: tenant/user, event type, localized title/body, entity type/id/link, readAt, createdAt, stable dedupeKey, inApp and pushRequested. Unique (organizationId,userId,dedupeKey).
- NotificationPreference: tenant/user composite relation; mine/team scope; per-event inApp/push JSON; pushEnabled master switch; showClientName=false; language.
- PushSubscription: tenant/user composite relation; globally unique SHA-256 endpoint hash; AES-256-GCM encrypted subscription (endpoint and keys); minimal device label; disabledAt/lastFailureAt/timestamps.
- NotificationPushDelivery: durable per-notification/per-device outbox; retries, lease token/expiry, nextAttemptAt, deliveredAt, terminalAt. Needed to retry one failing device without resending successfully delivered devices.

All additions are new tables plus indexes/relations. No existing column changes/backfill. OLD APP + NEW DB remains compatible. No migration is run against an existing database here.

## Execution

Persist assignment notifications inside the entity transaction, using createMany(skipDuplicates). Hook manual creation/reassignment, bulk assignment and webhook paths. Existing imports create unassigned leads, so no assignment event is generated for them. Same assignment version is idempotent; ordinary autosave has no notification side effect. Outbox delivery happens separately. Notifications remain durable if push fails. Recheck entity authorization during feed, count, click and delivery (including after reassignment/restricted role change). Stored context is limited to an entity label, never notes/documents/credentials.

Scheduled evaluator uses keyset pagination (bounded pages, explicit continuation cursor) across tasks, cases and leads. Task due soon: existing reminderAt, otherwise one day before dueDate; date-only deadlines remain valid through their calendar day. Overdue once per deadline occurrence. Skip generated case/lead reminders to avoid duplicates with entity-specific events. Cases: upcoming appointments/deadlines/custom dates at seven days and one day, excluding historical filing/MOS/contract dates. Lead contact: once per nextContactAt, only when unconverted, nonterminal and lastContactAt is earlier. Calendar dates use Europe/Warsaw. All jobs authenticated by a constant-time CRON_SECRET check, never session cookies.

## Rollout and secrets

NOTIFICATIONS_ENABLED, NOTIFICATION_EVENTS_ENABLED and WEB_PUSH_ENABLED default false and are independent rollout gates. Phase 1 enables center/settings and in-app events only; Phase 2 enables push for a test User using an explicit PUSH_TEST_USER_ID allowlist; Phase 3 widens events and delivery. No cron stanza is added to Vercel in this branch. Before rollout, verify the actual Vercel plan/runtime limits, choose a scheduler cadence and drain continuation pages. Proposed paid-plan cadence: every 15 minutes. An external scheduler can drain authenticated cursor URLs. Preview must use an isolated DB, distinct VAPID pair, encryption key and cron secret; production must use its own values. The branch disables automatic Vercel deployments.

VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION_ENCRYPTION_KEY are server-only env values. Public key is supplied by authenticated config API. Service Worker handles push/click only, with no fetch handler or cache. Push URLs use notification IDs, resolve after authentication and recheck access. Login preserves only validated internal notification URLs; no password/session algorithm changes.

Delivery is at-least-once at the transport boundary: a process crash after provider acceptance can repeat a push. Stable notification tags collapse duplicates; durable leases prevent simultaneous normal delivery. In-app records are exactly-once per dedupe key.

## Platform sources

- [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers): iOS push requires a Home Screen web app; permission is requested by explicit user action.
- [WebKit badging](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/): badge support is optional and platform dependent.
- [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs): CRON_SECRET authentication, runtime limits and overlapping invocation considerations.
- [web-push implementation](https://github.com/web-push-libs/web-push): VAPID and encrypted payload transport.

## Required verification

Isolated PostgreSQL migration, old schema against new DB, tenant FK rejection, recipient/dedupe/read/privacy/scheduling/outbox tests, security regression, TypeScript/Prisma/build. Browser QA at 1440/1024/390/414/430 for light/dark/slate and RU/UA/PL. Real iPhone Home Screen plus Android/desktop and two physical devices remain mandatory before production; local simulated transport is insufficient to mark real delivery PASS.

## Operational runbook (requires separate rollout approval)

1. Provision an isolated HTTPS QA deployment with a synthetic database first. Apply migrations there. Verify that its database, VAPID pair, AES key and cron secret differ from production. No deployment is created by this implementation.
2. Phase 1: `NOTIFICATIONS_ENABLED=true`, `NOTIFICATION_EVENTS_ENABLED=true`, `WEB_PUSH_ENABLED=false`. This enables the center/settings and five event families (six preference rows because task due/overdue are separate). Existing notifications remain in PostgreSQL when a delivery fails. Setting the center flag false also stops generation and delivery.
3. Phase 2 QA: set a single linked CRM `PUSH_TEST_USER_ID`, valid matching VAPID keys, a contact `VAPID_SUBJECT`, a 64-hex-character AES key, `PUSH_ENVIRONMENT` matching the runtime, and `WEB_PUSH_ENABLED=true`. Permission is requested only from the enable button. Use iPhone Home Screen, Android and desktop to test actual subscribe/delivery/click, login return, permission denied and two-device read synchronization. Test privacy OFF before ON. All these physical tests must pass before real production push.
4. Phase 3: after approval and successful device QA, widen push beyond the test User. Keep event preferences, current entity permissions and master push control enforced. Payments and technical/autosave events are excluded.
5. Scheduling: run `node scripts/run-notification-job.mjs` from an approved scheduler with `NOTIFICATION_JOB_ORIGIN` and `CRON_SECRET` in its secret store. Proposed cadence is 15 minutes, subject to the actual hosting plan. A single call processes only 25 entities and up to 20 delivery candidates; the script drains `nextCursor`, then remaining eligible deliveries. Do not configure a cron to call just the first page. Retries scheduled in the future are picked up on later runs. There is no Vercel cron configuration or running external scheduler in this branch. The handler declares a 60-second maximum; measure DB/page latency at expected tenant volume before selecting the host plan and cadence.
6. Transport retry: durable leases expire after two minutes, maximum five attempts, exponential backoff capped at one hour. Pending pushes older than 24 hours, already read records and no-longer-actionable entities are cancelled. A 404/410 provider response disables the device, erases its endpoint/keys ciphertext and cancels its queued deliveries. Unsubscribe deletes only the authenticated User's matching device and cascades its delivery rows. Up to ten active devices per User, including reactivation checks.
7. Environment keys are never included in source or logs. Ciphertext format is `v1` AES-GCM with tenant/User/endpoint-hash associated data. The initial implementation has one encryption key per environment; replacing it requires a planned server-side re-encryption or removing subscriptions and asking Users to enable again. Replacing VAPID keys also requires resubscription. Never overwrite keys during a routine deploy.
8. Rollback: turn off all three feature gates and stop the scheduler. Keep the additive tables and existing application data. The old app was checked against the new schema. Do not run destructive down-migrations. `vercel.json` disables automatic deployment of this feature branch; a production release requires a separate decision.

## Reproducing isolated automated QA

Use a local PostgreSQL database whose name contains `notifications_qa`, apply all repository migrations, and set `NOTIFICATIONS_TEST_DATABASE_URL` to its loopback URL. Then run `npm run test:notifications`; without that variable the DB suite deliberately skips, which is not a completed DB verification. Run security and the existing autosave/routing regression suites as recorded in the QA report.

For browser QA, start the built app on localhost with the same isolated DB and a synthetic QA JWT secret, all three flags enabled, in-memory generated QA VAPID/AES keys and a QA-only cron secret. Set `NOTIFICATIONS_QA_ORIGIN` and `NOTIFICATIONS_QA_JWT_SECRET` consistently, then run `node tests/notifications-browser.mjs`. Install the Playwright Chromium browser first. The script creates synthetic tenants, checks HTTP/UI paths and writes local `.qa` screenshots/results. Synthetic subscriptions validate storage/scoping and worker transport tests use a stub; neither proves delivery by Apple/Google/Mozilla push services. No real account credentials or production database are needed.
