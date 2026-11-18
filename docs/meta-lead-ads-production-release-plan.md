# Meta Lead Ads — план допуска к Production и SL

Дата проверки: 15 ноября 2026. Статус: **PLAN PREPARED / PRODUCTION RELEASE BLOCKED**. Это независимый source-only review и предложение следующего выпуска, не разрешение merge, миграции, deployment, Meta changes или подключения SL. Решение о собственном Stage A QA принимается отдельно: клиентские требования Stage B не являются автоматически требованиями внутреннего теста.

## 1. Проверенная исходная точка

| Объект | Проверенный факт | Граница доказательства |
| --- | --- | --- |
| main | `2e7c25ca573203ee8a3c757f7a36e48259964166` | Локальный `origin/main` совпадает с read-only remote проверкой координатора. |
| Production | Vercel `dpl_2SUihHPufQbFjpVG6QycKuZgh7yu`, READY, ref `main`, тот же SHA | Read-only deployment metadata получены координатором; health реальных RAM/SL интеграций **UNKNOWN**. Env, DB и клиентские данные не читались. |
| PR #9 | Draft/open, HEAD `5d71d4c43e14637fbb556e5ddd445e819378ceae`, 29 файлов | Нативный Lead Ads runtime + одна additive migration. GitHub показывает mergeable; это не проверка собранного release candidate. |
| PR #10 | Draft/open, HEAD `b2fee84147454ab58c072788b8bb7d3409302a31`, 4 файла | Ветка `fix/maintenance-runner-fingerprint-determinism`, **не** старая `feature/local-maintenance-runner`. Изменяет локальный maintenance runner и его тесты. |
| PR #16 | Draft/open; source-review snapshot `c79118993fac71635e29ab6ba3a37fda09a8d47e`, 90 файлов в этом snapshot | Последующие исправления QA STOP/контролируемого resume рассматриваются отдельно; актуальный HEAD указан в самом PR. QA tools/docs и отключение deployment этой ветки в `vercel.json` не выпускают нативный Production runtime из #9. |
| Review/CI | У трёх PR API `reviews: []`. Combined status #9/#10: только Vercel `success`; #16: пустой список | Это не Security Approval и не PASS необходимых regression/check runs. Старые локальные результаты в PR body являются заявленной исторической evidence, не повторным независимым запуском. |

Источники GitHub: [PR #9](https://github.com/reziflowcloud-netizen/reziflow-cloud/pull/9), [PR #10](https://github.com/reziflowcloud-netizen/reziflow-cloud/pull/10), [PR #16](https://github.com/reziflowcloud-netizen/reziflow-cloud/pull/16). PR refs, reviews и combined statuses прочитаны через официальный GitHub connector. Production metadata в таблице — явно отдельная read-only проверка координатора.

Read-only `git merge-tree` не показал conflict markers для каждого #9/#10 относительно указанного main. `src/middleware.ts` изменён с обеих сторон; при сборке кандидата необходимо сохранить изменения main, включая public demo/session fixes. Совместный результат **#9 + #10 + актуальный main** не создан и не протестирован этим review. Сохранённый старый combined candidate не заменяет проверку нового immutable SHA.

## 2. Независимые находки и release gates

1. **Общие UI-изменения остаются даже при OFF.** В #9 `src/lib/leads.ts::normalizeLeadSources` без tenant/feature gate добавляет три Lead Ads source option к настроенным источникам всех организаций. `src/app/settings/integrations/page.tsx` без такого gate добавляет ссылку на интеграцию. OFF блокирует ingestion, но не означает «RAM UI без изменений». До ограниченного выпуска нужен tenant/feature gate этих UI-изменений либо явное утверждение общей видимости владельцем.
2. **Общий ingestion helper изменён.** #9 меняет `inboundLeadOnce` в `src/lib/inboundLeadEvent.ts`: внутренний результат, replay/push options, timeout/maxWait. Старые callers сохраняют defaults, но source inspection не доказывает отсутствие регрессий. Обязательны targeted generic/legacy Meta webhook, routing, replay, notification и constrained-pool проверки на финальном combined SHA.
3. **OFF является acknowledge-and-drop для новых webhook notifications.** При валидной конфигурации и HMAC маршрут #9 возвращает `200 disabled:true` до записи receipts. Он не создаёт очередь для последующего включения. Rollback обязан сохранять старый SL-процесс и определить восстановление пропущенного интервала; нельзя обещать, что достаточно позднее включить worker.
4. **Scheduler не включён этим кодом.** `/api/internal/meta-lead-ads` — authenticated POST, global/worker flags обязательны; отдельный периодический вызов и alerting ещё нужны. Текущий `vercel.json` не добавляет такой cron; notification scheduler не является Lead Ads scheduler. Без него durable receipts не обеспечивают своевременное создание Lead.
5. **Авторизация вручную истекает.** `metaLeadAdsAuthorization.ts` принимает единственный точный App/Page/Form/organization tuple, проверяет token fingerprint и operator attestation не старше 30 дней. Это не tenant-bound OAuth onboarding. Нужны ответственное лицо, предупреждение до истечения, проверяемая процедура обновления и отдельная политика token/App/key rotation. Не продлевать attestation вслепую.
6. **Версия API должна быть явной.** #9 по умолчанию использует `v23.0`; официальный индекс Meta сейчас указывает `v27.0`. Перед пилотом явно закрепить проверенную для этого приложения версию и проверить ответы/permissions. Не полагаться на старый default и не менять версию одновременно с клиентским rollout без проверки. [Meta Graph API](https://developers.facebook.com/docs/graph-api/)
7. **Лимиты размера проверяются после буферизации.** Webhook делает `request.arrayBuffer()` до проверки 64 KiB; Graph retrieval делает `response.text()` до проверки 128 KiB. Это limits принимаемого содержимого, не строгий memory bound. До широкого публичного SL endpoint нужны streaming/ingress limits либо отдельное обоснование и нагрузочная проверка. В этом задании код не исправлялся.
8. **Receipt retention не является полным удалением контактов.** Новый manual retention переводит terminal receipts в tombstones после 30 дней, удаляет tombstones после 366 дней; pending/processing сохраняет. Он не удаляет CRM Leads, notifications, backups и server Page tokens. Существующий `/api/meta/data-deletion` только возвращает ссылку на инструкции и confirmation code, автоматического удаления не выполняет. Процедура SL должна честно учитывать эти отдельные хранилища.

Положительные source controls #9: отдельные `META_LEAD_ADS_*` credentials с проверкой отличия от legacy App/secret; HMAC raw body; unknown tuple fail-closed; tenant-scoped API owner/admin + same-origin writes; глобальная уникальность App/Page/Form; composite tenant FK delivery→binding; tenant lock перед routing/Lead creation; claim/lease и повторная authorization перед созданием; Graph response identity проверяется по Lead/Form; raw contact payload не сохраняется в delivery receipts. Это source findings, не текущий Production E2E PASS.

## 3. Минимальный состав будущего выпуска

- **DB:** только `20261027120000_meta_lead_ads_multitenant`. Создаёт `MetaLeadAdsBinding` и `MetaLeadAdsDelivery`, индексы/CHECK/FK; `enabled=false`, `mode=off`. В source main 53 migration directories, в #9 — 54. Миграция не изменяет существующие CRM/Meta таблицы и не создаёт tenant, binding, Page или token.
- **Application:** reviewed #9 runtime, bindings API/UI, shared helper/source list/middleware изменения после решения пункта 2. Никаких изменений существующих RAM callbacks/subscriptions/OAuth settings.
- **Maintenance:** #10 + узкая SQL auditor поддержка #9 нужны для предлагаемого guarded maintenance пути. #10 сам по себе не развёртывает CRM-функциональность и не является обязательным серверным компонентом Lead Ads.
- **QA #16:** оставить отдельным reviewable пакетом. Windows launcher, ngrok, test allowlists, evidence и private files не являются Production infrastructure и не должны попадать в Production env. Merge #16 сам по себе не выпускает интеграцию #9.
- **Server configuration:** новые dedicated App/Page credentials, отдельный стабильный receipt HMAC key, worker secret, exact allowlists и scheduler. Их значения не включать в Git, UI, URL, PR или отчёт. Использовать существующий managed HTTPS endpoint только после отдельного разрешения на его конфигурацию. Production ngrok не требуется этим планом.

При первом deployment оставить `META_LEAD_ADS_ENABLED`, `META_LEAD_ADS_WORKER_ENABLED`, `META_LEAD_ADS_RETENTION_ENABLED` OFF; live/shadow allowlists пустыми; все bindings OFF. Не копировать синтетические QA tuples/credentials/tenant IDs в Production. При последующем SL допуске — только точный SL organization ID и его отдельно проверенные Page/Form; отсутствие других tenant разрешений должно проверяться отрицательным тестом.

## 4. Минимальные regression проверки

В проектном Node runtime с поддержкой существующих TS imports, без Production env и без `.env`/credential pull, можно отдельно выполнить:

```text
node --test tests/staff-routing-scope.test.mjs tests/lead-responsible-visibility.test.mjs tests/notifications-policy.test.mjs
```

Это pure routing/round-robin, tenant/access и notification/push-security policy checks. Координатор выполнил эту точную команду на сохранённом combined candidate `51c560a5f0090b669ee4ffe48485ba4d6a3a873e`: **36/36 PASS, 0 SKIP**, без DB/HTTP. Были только существующие `MODULE_TYPELESS_PACKAGE_JSON` warnings. Это предоставленная координатором фактическая evidence; автор этого независимого source review команду не запускал. Результат не подтверждает DB ingestion и не заменяет проверки будущего candidate от текущего main.

Для изменённого `inboundLeadOnce` существующие meaningful runtime fixtures:

| Команда | Только отдельно проверенная synthetic конфигурация | Что проверяет |
| --- | --- | --- |
| `node --test tests/notification-events-phase3.test.mjs` | `NOTIFICATIONS_TEST_DATABASE_URL`, host localhost/127.0.0.1, database name содержит `notifications_qa` | Actual route ingestion/replay, scoped notification outbox, assignment/security; Meta/transport dependencies подменяются fixture. |
| `node --test tests/lead-webhook-pool-timeout.test.mjs` | `LEAD_WEBHOOK_POOL_TEST_DATABASE_URL`, host localhost/127.0.0.1, database name содержит `legalhub_webhook_qa` | Generic webhook replay/idempotence и ограниченный connection pool. |

Без этих dedicated URL runtime tests SKIP: считать это PASS ingestion нельзя. Не включать слепо `RUN_DB_TESTS` у `staff-routing-v2-db.test.mjs`: он использует default Prisma environment. Включение любых DB tests — только после отдельного synthetic target guard; наличие localhost само по себе не заменяет ownership proof.

На финальном combined SHA также нужны: #9 HMAC/unknown App/Page/Form/cross-tenant/replay/OFF tests; OLD **актуальный main** + NEW DB; NEW APP + OLD DB с ожидаемым controlled `SCHEMA_NOT_READY`; новые источники и старые custom sources; две организации с одинаковыми контактами и разными routing; повтор/параллельный replay без повторного notification; tenant-local disable во время Graph fetch; read-only/negative auth и публичные `/login`, `/privacy`, `/data-deletion`, demo/session routes. Старый `tests/meta-lead-ads-old-app.mjs` закрепляет `bb0ef241…`, поэтому его исторический PASS не подтверждает совместимость текущего main. Нужны актуализированный fixture/candidate и точные результаты, а не повтор всей старой baseline без причины.

RAM Messenger/Instagram/generic webhook route files, `metaOAuth.ts`, `metaMessages.ts`, `leadWebhookHandler.ts`, `leadRouting.ts`, `notifications.ts` не изменены в feature diff #9; shared helper и UI исключения описаны выше. **Runtime baseline RAM/Instagram/Google Sheets — UNKNOWN**: внешние resources, callbacks, credentials и клиентские потоки не проверялись.

## 5. Backup, migration и restore: отдельный будущий допуск

1. Зафиксировать release SHA от свежего main и полный exact diff/SQL hash; согласовать maintenance window, RPO/RTO, restore owner и rollback deployment. Неподтверждённые Production engine/version, ledger/drift, grants, extensions, provider/PITR/backup retention остаются **UNKNOWN**. Сейчас Production доступ для этого плана не требуется.
2. Владелец отдельно разрешает guarded PREFLIGHT над точной Production целью. Read-only identity/host/TLS/role/ledger и ожидаемый список миграций должны совпасть; неизвестная или дополнительная migration блокирует действие. Использовать существующий guarded migration command `npm run db:migrate:deploy`; никогда не install/build/seed/db push/reset.
3. PR #10 делает `pg_dump --format=custom --schema=public --no-owner --no-privileges` под exported snapshot, проверяет TOC и восстанавливает в owned isolated PostgreSQL. Это **не полный disaster recovery backup** Supabase, других schemas, roles/grants, Auth/Storage или внешних файлов. Их отдельное покрытие и восстановимость должны быть согласованы до APPLY.
4. Проверить archive integrity, restore exit status, structure/extension compatibility, ledger и шесть representative fingerprints (`_prisma_migrations`, `LeadMessage`, `Lead`, `Organization`, `User`, `NotificationPreference`), затем additive migration только на restored copy. MD5 fingerprint — corruption detector, не доказательство полноты всех данных или защиты от умышленной подмены. Нужен целевой smoke старого актуального приложения на restored NEW DB; проверить также tenant/Lead deletion semantics с новыми FK.
5. Runner fail-closed блокирует неподтверждённые external extension dependencies/opaque public functions; не обходить этот отказ и не обещать, что Supabase extensions автоматически восстановлены. Исторический PG17.6→PG18.6 synthetic PASS PR #10 не подтверждает неизвестную реальную Production конфигурацию.
6. После успешного review sealed plan и точного owner approval — отдельный APPLY, затем ledger/object/grant checks; application deployment отдельным шагом, всё ещё OFF. При неопределённом результате не повторять APPLY и не восстанавливать DB автоматически: установить состояние ledger/объектов и принять отдельное решение. Подробный контракт: `scripts/local-maintenance/README.ru.md`, `runner.ps1`, `core.ps1` на HEAD #10.

## 6. Rollback и ограниченное включение

Первое действие emergency rollback — подтверждённый tenant-local bindings DELETE/disable, сериализованный с Lead creation; результат `503` не считать отключением. Затем остановить scheduler и отозвать server tuple/allowlist отдельной проверяемой операцией. Env propagation по нескольким instances не является мгновенным revoke. Уже начавшийся Graph request может закончиться, но финальная tenant authorization должна блокировать создание после disable commit.

Вернуть ранее проверенный READY application deployment, **оставив additive tables**. Не DROP таблицы/данные и не откатывать ledger при обычном rollback кода. Публичный callback/подписку менять лишь для dedicated Lead Ads App/Page по отдельному разрешению; чужие subscriptions не удалять. Queue/blocked receipts сохранять для согласованного recovery. Global OFF отвечает `200 disabled`, а reactivation time блокирует старые receipts: требуются gap accounting и отдельно одобренный recovery/backfill, не blind enable/reset attempts.

До SL должны пройти controlled automatic Meta→receipt→Lead→Staff Routing→notification test, duplicate/retry test, отрицательный чужой tenant test и проверяемый STOP. Dashboard HMAC/sample PASS и ручной Graph read сами по себе не являются этим E2E. Прежний SL-процесс работает параллельно до сверки согласованного числа лидов, назначения и уведомлений; бизнес-дубли между старым процессом и новым требуют явной политики.

## 7. Meta permissions / Review / BV: Stage A отдельно от SL

**CONFIRMED по текущей официальной документации:** разрешения Standard Access предназначены для app-role users; работа с non-role users требует Advanced Access. App Review распространяется на permissions/features; Business Verification требуется для Advanced Access и приложений, позволяющих другим businesses получать свои данные. Исключение для пользователей с ролью собственного приложения нельзя автоматически переносить на клиентское SL onboarding. Точный app type/use-case validator и текущие approvals этого App в данном source review **UNKNOWN**. [Access levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/), [App Review](https://developers.facebook.com/documentation/resp-plat-initiatives/individual-processes/app-review), [Business Verification](https://developers.facebook.com/documentation/development/release/business-verification)

Отдельная текущая UI-проверка координатора: собственный QA App опубликован без новой Review/BV, расширения токенов или оплаты; Dashboard сообщает, что требуемых действий нет. `leads_retrieval` и `pages_manage_metadata` продолжают показывать «Готово к тестированию», не доказанный Advanced Access. Тот же Dashboard предлагает стать поставщиком технологий для запроса доступа к данным других пользователей/компаний. Это подтверждение собственного QA-сценария, а не допуска SL; App Mode не был автоматически возвращён в Development.

**SL gate:** подтвердить право SL предоставить доступ, Page task/Lead Access Manager и Form ownership; подготовить App Review/Advanced Access для реально используемых permissions и verified business connection. Текущий permissions reference перечисляет у `leads_retrieval` зависимости: Ads Management Standard Access feature, `ads_management`, `ads_read`, `business_management`, `pages_manage_ads`, `pages_read_engagement`, `pages_show_list`. Для webhook subscription используется `pages_manage_metadata`. Название feature и permission access level — разные сущности. Минимальный одобренный набор и UI validator необходимо проверить по выбранному App/use case; нельзя обещать, что достаточно двух scopes, или расширять их автоматически. [Permissions reference](https://developers.facebook.com/documentation/development/permissions), [Lead Ads retrieval](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)

Review package должен правдиво показывать advertiser-authorized CRM use, consent/доступ, выбор точной Page/Form, mapping/routing, создание и удаление/отключение Lead; нужны доступный test account и screencast. Не создавать платную рекламу для формального получения permission. Privacy/Data Deletion должны описывать реальные SL данные, providers/transfers и фактическую ручную/автоматическую очистку; Stage A synthetic-only QA pages недостаточны для этого сценария. DPA/клиентские условия и процедура запросов SL утверждаются перед реальными данными. Stage A не требует договора между оператором и его собственным QA tenant.

## 8. Graph polling fallback — только предложение, NOT IMPLEMENTED

Meta официально поддерживает bulk read `GET /{FORM_ID}/leads`, включая `id`, `form_id`, `created_time`, `field_data`, и курсоры; требуется `leads_retrieval`. Polling не снимает permissions, access level, Lead Access, Review/BV или publication restrictions. Документация показывает timestamp filtering для **ad** leads; поддержку такого фильтра на выбранном **form** edge и version нужно отдельно подтвердить. Не переносить ad-пример на form без проверки. [Официальный bulk-read guide](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/)

Предлагаемый контракт отдельного PR:

- Scheduler OFF по умолчанию; exact App/Page/Form/tenant allowlist, provenance/token fingerprint, один lease на binding и ограниченные pages/time/bytes. Header Authorization; не следовать `paging.next` как произвольному URL с credentials. Использовать только валидированный opaque `after` cursor на заново построенном фиксированном Graph endpoint; не писать cursor/URL/payload в публичный лог.
- Watermark хранить отдельно на binding: `(created_time, leadId)` + состояние законченного scan. Не считать ID хронологией и не обещать порядок выдачи. Предлагаемое overlap окно 10 минут — engineering assumption до проверки late-arrival/API поведения. Cursor не заменяет durable watermark. При истечении cursor начать ограниченное перекрывающее сканирование; watermark продвигать только после durable receipt commit всех страниц выбранного окна. Исчерпание budget/ошибка не означает завершённый scan.
- Нормализовать обнаруженные IDs в тот же durable receipt path и stable App+Lead dedupe, а не напрямую `Lead.create` и не выдавать polling за HMAC delivery. Повтор webhook+poll, равные timestamps, crash после receipt/до checkpoint, изменение токена и disable во время запроса должны давать один Lead/notification в правильном tenant. Существующий код worker повторно проверяет Form/Lead identity, authorization, billing/routing; его следует использовать как общую границу обработки. Backfill старше activationTime требует отдельного bounded approval design.
- Не хранить contact payload в checkpoint. Лучше сначала минимальные metadata IDs, затем действующий worker retrieval. Проверить field support `platform`, чтобы не подменять неизвестную сеть Facebook. Различать origin polling и webhook в operational metrics.
- 429/5xx/transport — bounded exponential backoff+jitter, Retry-After и usage headers; auth/permission errors останавливают конкретный binding и требуют owner reauthorization. После exhausted retries — видимый blocked state, без удаления work или автоматического сброса attempts. Общая квота ограничена также для пустого Page; период не выбирать вслепую. [Meta rate limits](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)

Для запуска fallback нужны отдельные implementation/security tests, dry-run на синтетических QA IDs, доказательство доступности form edge, согласованные polling SLA/retention и owner authorization. Он не развёрнут и не является обходом текущего Meta Pending.

## 9. Одно следующее решение владельца

Утвердить **подготовку финального immutable release candidate от свежего main с reviewed #9/#10**, включая решение об общих UI-изменениях и перечисленные targeted regressions, с сохранением всех switches OFF. Это не approval Production migration/deployment, SL activation или изменения Meta. После получения точных результатов представить отдельный конкретный SQL/deployment/rollback approval gate.

Production DB/credentials/backups, RAM/SL assets и Meta configuration автором этого документа не читались и не менялись. Тесты/инфраструктура в рамках этого независимого review не запускались. Любые текущие Stage A runtime результаты и shutdown evidence координатора должны быть зафиксированы отдельно; этот документ не повышает их статус.
