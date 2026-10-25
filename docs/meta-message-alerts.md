# Meta incoming unread alerts — audit, design and final QA

Draft PR #5; development only. No merge, deployment, Production access/change,
provider configuration, routing, notification master policy or QStash change.

## Exact source

Fresh main was verified through the GitHub connector as
`07d765e5ad16386c3fed2de806b0e25069dbe44b`, tree
`d59673828809b6b787e66dd4fb9de15ce5ec3b37`, exactly matching the clean checkout.
Direct fetch failed because the configured proxy socket was unreachable.
Connector-created trees were compared with local Git trees before publication.

Final reviewed application source: remote `f65ca0d10337903da19bc284534d7adff9558fd9`,
local `d043247141cab74e895fcb9ea5280a2947e8ba7e`, src tree
`1dc9cff3c1c881a766df1956a3a880c8ebed52c5`.
Source/app/build SHA-256:
`f53a6e2d26792bc60032830ea5cd9da59f264d11bbaf5c1ca83ea71bc54fbff1`.
Final evidence-only commits retain this source. Earlier checkpoint reports/reviews
are not represented as final-source checks. JSON evidence records the actual local
HEAD/digest; remote/local commit hashes differ because publication used connector
Git commits with the same verified trees.

## Audit and behavior

The existing MetaMessageNotifier and visible-only 30s poll are reused. Previously,
/api/notifications/meta-messages selected latest status=message LeadWebhookLog,
including sync/outgoing logs, without Lead access checks. Automatic sound lacked
personal opt-in. Logs remain diagnostic, never unread/sound eligibility.

The existing FB/IG slug handler already serializes live and history inserts using
lockInboundLead (Organization UPDATE), before duplicate checks/routing. Its signature,
provider/profile/send/sync operations and lock ordering remain. LeadMessage uniqueness
still deduplicates external IDs. No parallel notifier, push event, scheduler or cadence.

The additive migration establishes Organization.metaMessageActivatedAt using stable
CURRENT_TIMESTAMP (new organizations use creation time). No history scan/backfill.
Only a direct incoming message.mid, no postback/echo/outgoing, finite event timestamp
at/after activation and no more than five minutes in the future can allocate a unique
liveReceipt from a database sequence under the existing Organization transaction.
Manual, old-app, delivery/read-only, sync-only and historical rows stay null.
A sync-first incoming can be promoted exactly once by its qualifying direct webhook
only if its stored sentAt is also post-activation. Old synced replay stays silent.
Missing/unreliable timestamp or message.mid stays visible but conservatively ineligible.
Provider time is an eligibility boundary only, NEVER the ACK or sound ordering.
Across organizations sequence gaps/interleavings are harmless; commit ordering is
required and serialized only within the tenant boundary.

Snapshot ACK signs the max rendered liveReceipt, never message ID or server time.
A purpose-separated HMAC-derived key, JWT type/audience/issuer/expiry and explicit
user/org/Lead/session binding prevent auth-token confusion or foreign/forged ACKs.
Organization SHARE -> User SHARE -> Lead SHARE -> GREATEST upsert rereads current
membership/session/access under locks. Old tab ACK cannot lower a marker or swallow
an unseen receipt allocated on a lower-ID synced message. Other users retain reads.

Only successfully loaded, visible conversation panes ACK. Mobile overview never
ACKs; desktop requires viewport intersection. Observation waits for the actual Lead
render if messages load first. Transient failure leaves unread intact and retries
only on later focus/visibility, at most three attempts per snapshot, without a timer.
Conversation deep-link tab/scroll is keyed to Lead/navigation and consumed once.
Notification links retain the existing draft leave guard. Opening Center never ACKs.
Its ordinary Mark all read does not mark Meta conversations read.

Lead table/Kanban/mobile badges and the unread quick filter cover every currently
authorized Lead, before existing client pagination. Current membership/access is
rechecked in count SQL independently of IDs captured by an earlier list query.
Search, Staff Scope, Responsible, sort, URL/localStorage filters remain intact.
Badge and truncated name have independent flex sizing; measured bounds cover long
names, count visibility and keyboard activation. RU/UA/PL and Light/Dark/Slate use
existing translations/theme variables.

Global alert/sound eligibility is narrower: active same-org Employee explicitly
linked to the same-org assigned User; otherwise same-org Owner/Admin fallback.
No guessed identity links; assignedToId remains User access and employeeId remains
business responsibility. Restricted access never expands. Admin fallback is actionable
in the existing bell/Center even without an Employee link. Explicit ordinary list
Mine keeps its existing filtering/409 behavior; fallback does not widen that list.
Center preview is five identifiable authorized Leads plus total, with no floating
panel or contradictory ordinary-empty text while Meta unread exists.

Fresh recipient sound cursor and opaque access-scoped visual revision are separate.
Initial baseline reconciles visuals silently; it initializes even an empty inbox.
Nonrecipient accessible arrivals and reads outside preview still update list/dialogue.
Personal metaMessageSound is saved in existing notification preferences, default OFF,
independent of Push/Notification permission. Audio never blocks polling; resume is
bounded, generation/visibility rechecked after lock/resume, rejection is nonfatal.
Web Locks + storage provide best-effort cross-tab dedupe; bursts batch per poll.
Preferences/read events invalidate stale in-flight generations and queue refresh.
Login/logout invalidates published/in-flight state across tabs.

## Final results

| Gate | Final result |
| --- | --- |
| Real isolated PostgreSQL + authenticated APIs + mocked Meta/provider entry points | 24 groups PASS |
| Actual-app browser matrix | 18 combinations PASS (390/1440 × RU/UA/PL × Light/Dark/Slate) |
| Additional actual-app browser journeys | 7 PASS: mobile consecutive dialogues, failed ACK/focus retry, keyboard/count bounds at 769/1024/1359 table, 1440 Kanban, 390 mobile |
| Actual-component timing/Next navigation | 10 groups PASS |
| Focused regressions/security/snapshot/Meta/staff/polling | 86 PASS, 0 FAIL, 1 optional DB SKIP (87 registered) |
| TypeScript / optimized isolated build | PASS / PASS |
| Empty synthetic PostgreSQL migration chain | 53 applied |
| Populated exact pre-feature expansion | 52 -> 53; 1,000 old messages, zero activated; default sound OFF |
| Exact OLD APP + NEW DB | 7 API/read/write/preference checks PASS |
| PostgreSQL deadlocks / unexpected browser page errors or HTTP 5xx | 0 / 0 |
| Independent Work review (user-reported, separate evidence) | 125 PASS, 4 optional DB SKIP, 0 FAIL; no remaining product findings |

The Cloud skip is the pre-existing constrained-pool webhook fixture requiring a
separate LEAD_WEBHOOK_POOL_TEST_DATABASE_URL. It is not PASS. Required feature DB,
API, replay/receipt and lock-race tests ran separately. Independent Work counts are
not added to Cloud counts. Only the explicitly injected 503 at its exact ACK endpoint
is excluded once; all unrelated page errors/5xx remain failures.

DB barriers observe actual waiting PostgreSQL queries before release: eligible
commit order, stale snapshots, fresh sync-first promotion (single receipt allocation),
current-access count recheck, role/restriction mutation, reassignment/delete and an
actual Lead PATCH + ACK + identity three-way queue. The final three-way harness waits
for each of the three queued operations; an earlier unconstrained test could allow
permission widening to win and legitimately return ACK 200. That discarded attempt
was a harness ordering issue; no product change was needed. No P2024/P2028/5xx was
observed in the completed final suites.

Timing tests use controlled document.visibilityState and virtual clock (source still
30s), plus a real same-origin shared browser context/Web Locks/storage across tabs.
They cover never-resolving and rejecting audio resume, stale in-flight OFF, ON without
backlog replay, queued refresh, session invalidation, outside-preview read, burst
batching, hidden 90s with zero polls and one visible-resume refresh, and actual Next
same-Lead query/between-Lead navigation. Controlled visibility is not an OS lifecycle
claim. Six representative screenshots are committed; all 18 checks are in browser.json.

## Synthetic CPU/query assessment

Final exact SELECT capture: enabled Meta poll 7 SELECTs; existing full Lead list 8.
Non-Meta organizations stop after the settings gate; no repeated hidden polls, card
polls or new schedules. Initial baseline adds one visual reconciliation request;
subsequent list/dialogue refresh uses the shared visual revision/read events.

Synthetic fixture: 100 Leads, 100,000 historical messages, 10,000 already-read live
messages, 10 unread. Exact EXPLAIN ANALYZE BUFFERS plans: latest 0.435ms, unread preview
2.953ms, visual revision 3.469ms, list unread counts 0.583ms in this local run.
Unread ranges and per-Lead latest use indexed range/index-only scans, excluding read
history via throughReceipt; LIMIT alone is not treated as a scan bound. One SQL query
can perform per-Lead index probes; there is no application-level N+1. Cost grows with
authorized Leads and unread tail; this is a local assessment, not Production CPU data.
Raw plans/counts are in performance.json; no Production measurements were made.

## Reproduce / independent Work review

Node 24, cached package dependencies/Prisma engine, Chromium /usr/bin/chromium and
postgres:16-alpine were available. Run only on disposable loopback synthetic DB.
The guarded runner discards inherited app/provider credentials, never reads/copies
repository env files, and mocks Meta (all other non-loopback fetches fail).

```sh
docker --host=unix:///var/run/docker.sock run -d --name legalhub-meta-qa --label codex.qa=meta-message -e POSTGRES_USER=actualization_qa -e POSTGRES_PASSWORD=disposable_only -e POSTGRES_DB=actualization_qa -p 127.0.0.1:55435:5432 postgres:16-alpine
node scripts/meta-message-local.cjs node node_modules/prisma/build/index.js generate
node scripts/meta-message-local.cjs node node_modules/prisma/build/index.js migrate deploy
node scripts/meta-message-local.cjs typecheck
node scripts/meta-message-local.cjs dev
# Separate terminal; DB-mutating suites run sequentially:
node scripts/meta-message-local.cjs node scripts/qa-meta-messages.mjs
node scripts/meta-message-local.cjs node scripts/qa-meta-message-browser.mjs
node scripts/meta-message-local.cjs node scripts/qa-meta-message-performance.mjs
node scripts/qa-meta-message-timing.mjs
```

Timing uses the separate frontend-only harness:
`node scripts/meta-message-ui-harness.cjs`, then http://127.0.0.1:3129/review.
Actual Leads/Detail/settings/Notifier/bell/Center, server-memory fixtures, no Prisma,
DB, auth server, providers or repo env; restart resets fixtures. Synthetic incoming,
burst, read, sound/reset and real Next Link controls are provided. Windows uses a
node_modules junction. This UI-only harness does not model authorization/persistence.
Never publish/tunnel it.

Old-app compatibility and populated migration reproduction require exact old source:

```sh
mkdir -p work/meta-old
git archive 07d765e5 src prisma public package.json package-lock.json tsconfig.json next.config.js postcss.config.js tailwind.config.js next-env.d.ts | tar -x -C work/meta-old
cp -a node_modules work/meta-old/node_modules
node scripts/meta-message-local.cjs node node_modules/prisma/build/index.js generate --schema work/meta-old/prisma/schema.prisma
node scripts/meta-message-local.cjs node node_modules/next/dist/bin/next dev work/meta-old --hostname 127.0.0.1 --port 3130
# Separate terminal, after the core API fixture exists:
node scripts/meta-message-local.cjs node scripts/qa-meta-message-old-app.mjs
node scripts/qa-meta-message-migration.cjs
node scripts/meta-message-local.cjs build-prepare
cp -a node_modules work/meta-build/node_modules
node scripts/meta-message-local.cjs build
```

Migration script hardcodes the disposable loopback target and resets only its separate
meta_expand test schema. It applies all 52 old migrations before inserting historical
fixtures, then applies the final additive migration. The main QA DB also received the
full final 53-migration chain from empty, not a manually patched checkpoint schema.
Cached dependencies were copied; package/lockfile stayed unchanged. Reuse build deps
rather than nesting another node_modules copy when repeating the command.

Eventual Production rollout requires a separate authorized, trusted local migration
with a positively verified target and app-role sequence permissions before deploying
the new app. This prerequisite is NOT authorization to execute it. No production
migration, historical activation, seed, merge, deploy or settings change was performed.
