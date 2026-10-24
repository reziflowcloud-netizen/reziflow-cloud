# Meta incoming unread alerts — development checkpoint

Draft only; no merge, deployment, production database or settings access.
Base main verified through GitHub connector: 07d765e5ad16386c3fed2de806b0e25069dbe44b,
exact tree d59673828809b6b787e66dd4fb9de15ce5ec3b37 matches local Git objects.
Direct fetch failed: configured proxy socket unreachable. Clean initial checkout.

## Audit and design

Existing MetaMessageNotifier is reused: one visible-only 30s poll, non-Meta
facebookMessagesEnabled stop gate retained. No new poller, scheduler or push event.
The old log-based endpoint did not apply per-lead access and automatic audio lacked
personal opt-in. Incoming source is now persisted LeadMessage.liveReceipt, allocated
only inside the existing organization-serialized direct webhook transaction.
Outgoing/echo/manual/history-only/postback-only writes retain null. Existing uniqueness and replay
checks, Meta sender/profile/send/sync paths and transaction lock order are retained.
Delivery/read/comment events alone do not qualify. No historical backfill.

ACK uses a purpose-separated HMAC-derived JWT signing key, audience/type/expiry,
user/organization/Lead/session binding and exact max live receipt ordinal in loaded messages.
Snapshot cannot authenticate as auth-token. Organization SHARE -> User SHARE ->
Lead SHARE -> monotonic GREATEST upsert; current membership/session/access reread
under locks. Snapshot never signs current time as a read boundary. Existing live and history writers take Organization UPDATE. Only qualifying direct
incoming allocates a sequence receipt, inside that transaction. This serializes
receipt commit order; outgoing/historical message IDs cannot affect ACK. DB barriers test blocked concurrent insertion and stale ACK.
Only visible, successfully loaded conversation panes acknowledge. Mobile overview
cannot ACK. Desktop pane must intersect the viewport. No automatic navigation.

List badges and quick unread filter cover every authorized Lead in the existing
full result before client-side pagination. Existing Staff Scope/search/responsible/
URL/localStorage/sort paths remain. Global alert/sound recipients are narrower:
valid active same-org Employee + explicitly linked same-org User matching assignedToId;
otherwise same-org Owner/Admin fallback. Restricted users retain assignedToId access.
No inferred names/links. Admin fallback appears in the existing notification bell/
Center independent of default Mine Employee linkage; explicit list Mine stays Mine.

Fresh event cursor is independent of unread previews (bounded to five with total).
Read of newest never regresses sound cursor. Empty initial inbox initializes the
cursor, so the first later event qualifies. Sound defaults OFF, persisted in existing
personal NotificationPreference; no Notification permission or master policy change.
Cross-tab best-effort locks+storage dedupe; autoplay failure is nonfatal. Settings
and read events invalidate in-flight generations and queue refresh. Cross-tab read
refreshes list badges even outside the five-item preview. Login/logout invalidates
old in-flight results and clears published state across tabs.

Sync-first ordering is now supported: Organization.metaMessageActivatedAt defaults to
the additive migration/organization creation epoch, without reading old messages.
A direct incoming with message.mid, no postback/echo, and a finite provider timestamp
at/after activation (no more than five minutes in the future) allocates one sequence
receipt under the existing Organization lock. A stored sync-first incoming may be
promoted only if its stored sentAt is also post-activation. Historical replay with
old event or stored time stays silent; sync-only and old-app rows stay null.
Provider time is only this eligibility boundary, NEVER read ordering. Events missing
a reliable timestamp/mid remain visible but ineligible; that conservative rule is
explicit. No original message ID is used as a read boundary. The new lower-ID sync
row/higher-ID outgoing/earlier-snapshot race is covered by real API tests.

Audio is detached from visual polling and bounded while awaiting resume; generation
and visibility are rechecked after lock/resume. Current access-scoped opaque visual
revision is independent from recipient-only sound cursor; baseline always reconciles
visual consumers, including accessible nonrecipient Leads and reads outside preview.
Counts recheck current membership/access in SQL, independently of earlier list IDs.
Center labels identify authorized Leads; no permanent floating panel. Existing draft
leave guard is used. Deep-link consumption is keyed to Lead/navigation. Failed ACK
retries only on subsequent focus/visibility, max three per snapshot; no card timer.

## Migration and review gates

One additive migration: activation epoch + nullable indexed unique receipt ordinal/sequence, per-user/org/Lead read table,
and sound boolean default false. A trusted local, target-verified migration is a
prerequisite for eventual production rollout. No production command is authorized.
Checkpoint two: typecheck and 21 PostgreSQL/API/mocked-provider groups PASS.
67 focused existing/security/policy/snapshot regressions PASS before the final
postback/markup checkpoint (repeat planned). OLD APP + NEW DB, build, browser matrix, query EXPLAIN, final-source reruns and
independent review remain PENDING at this checkpoint. Do not call this production-ready.

Sanitized isolated runner: scripts/meta-message-local.cjs. Never copies/reads repo
env files; inherited application credentials are discarded; only disposable
127.0.0.1:55435/actualization_qa and mocked providers. No real Meta requests/messages.
Run snapshot policy tests with Node 24 --experimental-strip-types and
--test-isolation=none. API suite: node scripts/meta-message-local.cjs node
scripts/qa-meta-messages.mjs after running the sanitized dev app on 127.0.0.1:3127.
Frontend-only actual-component Work review: `node scripts/meta-message-ui-harness.cjs`
then http://127.0.0.1:3129/leads and /review. No repository env, Prisma, DB or providers;
in-memory fixtures reset on restart. Actual Leads, Detail, notification settings,
Notifier, bell and Center. Synthetic incoming/burst/read/sound/reset controls;
Next Link controls test same-Lead query and between-Lead client navigation.
Do not publish/tunnel. UI-only harness is not authorization or persistence evidence.

Remote initial checkpoint 26508b3 (tree c8cbbb8) is superseded by receipt-ordinal
checkpoint. Work independently reported 38 passing initial-checkpoint regressions,
1 optional DB skip; this is separate from Cloud evidence and not final-source QA.
