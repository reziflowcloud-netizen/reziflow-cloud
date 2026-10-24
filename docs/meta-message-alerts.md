# Meta incoming unread alerts — development checkpoint

Draft only; no merge, deployment, production database or settings access.
Base main verified through GitHub connector: 07d765e5ad16386c3fed2de806b0e25069dbe44b,
exact tree d59673828809b6b787e66dd4fb9de15ce5ec3b37 matches local Git objects.
Direct fetch failed: configured proxy socket unreachable. Clean initial checkout.

## Audit and design

Existing MetaMessageNotifier is reused: one visible-only 30s poll, non-Meta
facebookMessagesEnabled stop gate retained. No new poller, scheduler or push event.
The old log-based endpoint did not apply per-lead access and automatic audio lacked
personal opt-in. Incoming source is now persisted LeadMessage.liveIncoming, set
only inside the existing organization-serialized direct webhook transaction.
Outgoing/echo/manual/history writes retain false. Existing uniqueness and replay
checks, Meta sender/profile/send/sync paths and transaction lock order are retained.
Delivery/read/comment events alone do not qualify. No historical backfill.

ACK uses a purpose-separated HMAC-derived JWT signing key, audience/type/expiry,
user/organization/Lead/session binding and exact max eligible ID in loaded messages.
Snapshot cannot authenticate as auth-token. Organization SHARE -> User SHARE ->
Lead SHARE -> monotonic GREATEST upsert; current membership/session/access reread
under locks. Snapshot never signs current time as a read boundary. Existing live
and history writers take Organization UPDATE before inserting and allocating IDs;
that is the commit-order prerequisite for max-ID acknowledgement. Other writes
never set liveIncoming. DB barriers test blocked concurrent insertion and stale ACK.
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

Known conservative ingestion boundary: if conversation sync stores an external ID
before its direct webhook, the later webhook remains a duplicate and is silent.
The retained payload does not reliably distinguish fresh direct arrivals from old
historical replay. Provider timestamps are deliberately not used to promote these
rows. This includes a genuinely new sync-first message: it remains visible in the
dialogue but does not become unread/audible. Complete direct-first FB/IG behavior
must not be described as complete sync-first coverage. Product review must accept
this limitation or supply a trustworthy provider event boundary before release.

## Migration and review gates

One additive migration: boolean default false + indexes, per-user/org/Lead read table,
and sound boolean default false. A trusted local, target-verified migration is a
prerequisite for eventual production rollout. No production command is authorized.
OLD APP + NEW DB, build, browser matrix, query EXPLAIN, final-source reruns and
independent review remain PENDING at this checkpoint. Do not call this production-ready.

Sanitized isolated runner: scripts/meta-message-local.cjs. Never copies/reads repo
env files; inherited application credentials are discarded; only disposable
127.0.0.1:55435/actualization_qa and mocked providers. No real Meta requests/messages.
Run snapshot policy tests with Node 24 --experimental-strip-types and
--test-isolation=none. API suite: node scripts/meta-message-local.cjs node
scripts/qa-meta-messages.mjs after running the sanitized dev app on 127.0.0.1:3127.
Final evidence and portable frontend-only Work harness will be added before completion.
