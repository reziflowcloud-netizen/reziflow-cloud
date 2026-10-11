# Notifications — Production Complete

Verified 2026-10-11 after three real automatic frequent runs. Development 12 complete. Customer organizations were not enabled.

## Deployment and migration

Previous main `7621e8bd99e551de0561ed79c7bd8f2a10e5d25c`, previous Ready deployment `dpl_7SagjMScXqZaCNzP3jKKpDaGjkz4`. Accepted feature `e54d6f54019f4ef5d6351e3b6bb18485825c0764` plus configuration-only follow-up `6fa02ed1caed8f4cdbcf20d0c39bc26e7a9d6adf`; normal merge to main `4adbf2f3e73aa54c38ee7e84e2f4ca266e0454e2`, Ready Production `dpl_He27oNwevfbt1KDc4sB2XyjUV7uU`. Final documentation commit follows this application merge. No rebase. Latest main was unchanged before merge.

Fresh public-schema custom-format backup: 2,320,484 bytes, private outside Git, pg_restore list PASS, previous backups preserved. Pending before apply exactly one: `20261011120000_notification_organization_opt_in`; guarded npm run db:migrate:deploy PASS. After apply: 50 applied, pending0, failed0, checksum mismatches0. Migration adds default-false Organization master, nullable activation timestamp and the reviewed Task organization/dueDate index; no DROP/RENAME/data transformation. Old application with new DB passed real authenticated browser Login/Dashboard/Leads/Cases/Clients/Tasks/Settings smoke before application deployment.

## Organization and security gates

Persisted ON=1 (TestRezidents), OFF=22. New-organization OFF default PASS in isolated DB regression. Owner/Admin UI/API ON→OFF→ON PASS; first watermark 10:23:12.192Z, final watermark 10:27:00.154Z. OFF candidate queries returned zero, new watermark excludes history/off-gap. Historical notification creation after activation zero. Production employee update403, identity-injected Admin request400, cross-tenant tests PASS. Temporary disposable TestRezidents role-probe account and its own default preference were cleaned up; no existing entity fixtures recreated.

Push remains personal opt-in: master toggle issued zero permission requests; actual browser permission remained default. Non-subscribed employee/preferences/center requests succeeded. Hash comparison confirmed every existing preference/subscription unchanged, existing readAt values preserved and User16 iPhone subscription count1. Privacy, scope and access remain unchanged; VAPID private key server-only, QStash receives no DB credentials, same-origin resolver re-checks access, expired-session return and iPhone fallback regressions PASS.

## Provider transition and capacity

Prepared new schedules PAUSED, verified auth/destination/mode/cadence, paused old pilot, then activated exactly two. Prepare GitHub run38131483551 success14s; activation38132041340 success17s. Business generation jobs skipped; no manual generation. Temporary QSTASH_NOTIFICATION_SETUP_TOKEN removed from repository secrets after completion; permanent cron secret retained, values not exposed.

- Frequent `legalhub-production-notifications-frequent`: POST{} to https://legalhubcrm.com/api/internal/notifications, `*/15 * * * *`, Task due/reminder/overdue and Lead next contact only.
- Daily `legalhub-production-notifications-cases`: same destination/auth, POST mode=daily, `0 6 * * *`, Case Important Dates +7/+1 only. 06UTC is 08Warsaw summer / 07Warsaw winter; business-date arithmetic uses Europe/Warsaw.
- Shared queue parallelism1, retries2, retry delay15s, timeout55s; auth/body redacted. Old `legalhub-production-notifications` stays PAUSED, last execution10:15UTC before transition. GitHub has manual fallback/configuration triggers only.

Static persisted-state projection: 96 frequent +1 daily request =97/day normal, 291/day if each request retries twice, vs1000/day Free; headroom903/709. Current next24h candidates1, maximum1/page; no extra continuation projected. This is a projection, not a full measured day, and requires reassessment when opt-in volume grows. Old general full-sweep proposal was91 deliveries/run; actual old limited pilot showed7/run. New observed empty runs use1. The internal same-origin GET used by a chunk is not a second QStash delivery.

## Real automatic frequent evidence

- #1: CREATED 2026-10-11T10:30:00.458Z, DELIVERED 2026-10-11T10:30:22.909Z; HTTP200, runtime 2664ms, one delivery/page, continuation0. Message `msg_26hZCxZCuWyyTWPmSVBrNB8829psDjmbbXLHMiM3BJKfp95JsyCb91RJSTGa39i`.
- #2: CREATED 2026-10-11T10:45:00.431Z, DELIVERED 2026-10-11T10:45:09.145Z; HTTP200, runtime 3365ms, one delivery/page, continuation0. Message `msg_26hZCxZCuWyyTWPmSVBrNB882AMxBbNQ1HLTzLP1hCQ9yzcaNEaL9TWj1ieyoQL`.
- #3: CREATED 2026-10-11T11:00:01.445Z, DELIVERED 2026-10-11T11:00:09.546Z; HTTP200, runtime 3351ms, one delivery/page, continuation0. Message `msg_26hZCxZCuWyyTWPmSVBrNB882ASrNtdksNCJdLTapnQFv1FGYjPVQsiP6z9G9x5`.

Total observed provider deliveries: 3; retries: 0; continuations: 0. Each message originated from the frequent schedule.

| Aggregate | First run | After three runs |
| --- | ---: | ---: |
| Enabled organizations | 1 | 1 |
| Organizations skipped OFF | 22 | 22 |
| Task candidates | 0 | 0 |
| Lead candidates | 0 | 0 |
| Notifications created | 0 | 0 |
| Push deliveries queued/sent | 0/0 | 0/0 |
| Non-enabled organization events | 0 | 0 |
| Duplicate notifications | 0 | 0 |

Candidate/created counts are correlated read-only DB observations. Read-only replay at all three provider CREATED timestamps also returned Task=0 and Lead=0 against current persisted data. Successful provider logs retain HTTP status and runtime, but do not retain application response bodies.

Daily automatic execution: N/A during completion window; next2026-10-12T06:00:00Z. Configuration PASS; isolated daily/date/DST/tenant/history tests PASS; actual current/next daily Case candidates0. No manual Case generation was used. Runtime/pages/created for a real daily execution therefore N/A; historical backfill observed0.

## Regression and observation scope

Isolated full post-deploy suite261/261 PASS, no skips: Notification Center/preferences/Web Push, Phase3A/3B, candidate-first frequent/daily, concurrency/retry, dedupe, security/tenant isolation, resolver/expired-session/inaccessible entity/iPhone fallback, Lead webhook and Client GET pool, autosave/staff routing/Lead visibility. UI12/12 across Owner/Employee RU/UK/PL at390/1366, no overflow/error/permission request. TypeScript, Prisma validate, fresh isolated50-migration chain, DB-write-free safe build, git diff --check PASS.

Actual Production owner page/API smoke200, employee403, browser errors0. Vercel error/5xx queries since10:19UTC (application rollout deployment) complete, no truncated results: P2024=0, P2028=0, pool timeout=0, unexpected5xx=0. This is the observed rollout window, not an indefinite guarantee. Existing real iPhone Lead/Task/Case direct/fallback QA was already accepted; this rollout does not alter click/navigation code or subscriptions.

PROJECT_STATE.md and HANDOFF.md updated with final architecture/state. No customer org auto-enable, no new Task/Case/Lead fixtures, no secret rotation, no unrelated rollout. Stop after final verification.
