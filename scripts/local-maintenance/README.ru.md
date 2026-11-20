# Локальный раннер миграций LegalHub

Исправления M1/M2: [portable pg_attver и несколько pending migrations](../../docs/local-maintenance-stripe-release-gates.md).
Исключается только валидная внутренняя версия `pg_attver` на PG17.12+/18.7+;
пользовательские column options сохраняются, неизвестные внутренние options блокируются.
Pending migrations передаются плоским упорядоченным `string[]`; неверный набор,
порядок, checksum и изменённый sealed plan по-прежнему блокируют операцию.
Эти исправления не доказывают причину старого Production data mismatch и не дают
разрешения на Production PREFLIGHT/APPLY или deployment.

Единый поддерживаемый операторский runtime — **PowerShell 7 Core** (`pwsh.exe`), также для синтетических тестов. Все четыре BAT находят первый `pwsh.exe` в `PATH`, фиксируют полный путь и проверяют Core/major >= 7 до запуска раннера. Текущая рабочая папка отдельно не просматривается. Если runtime отсутствует или проверка не прошла — exit 78, без запуска режима и без fallback на Windows PowerShell 5.1. Прямой запуск `runner.ps1` под 5.1 тоже отказывает до импорта модулей/Add-Type. Нужны Git, Node.js/npm, зависимости из `npm ci` (`node_modules`), а также PostgreSQL **18** с `initdb`, `pg_ctl`, `psql`, `pg_isready`, `createdb`, `pg_dump` и `pg_restore`. Используйте чистый отдельный checkout утверждённого commit.

Можно запускать тот же `scripts/local-maintenance/runner.ps1` напрямую через `pwsh -NoProfile -File`, с теми же режимом и guards. BAT передают аргументы без дополнительного `call`/повторного parsing и возвращают исходный exit code раннера. Пути с пробелами заключайте в двойные кавычки по правилам Windows native argv. Например: `STATUS.bat -ConfigPath "C:\LegalHub Private\config.json"`. Launchers не задают `-ExecutionPolicy`, не меняют политику и не используют Bypass. Если действующая политика запрещает выполнение, остановитесь; её нельзя обходить выбором другого интерпретатора. UTC-время sealed plan сохраняется как исходная строка на версиях с `ConvertFrom-Json -DateKind String`; строгая проверка также принимает UTC `DateTime` старых версий PowerShell 7 без преобразования через локаль. Строки должны иметь исходный round-trip формат `o` с `Z`. Срок четыре часа и допуск будущего времени две минуты сохранены. Изменение даты не продлевает план: HMAC проверяется до чтения payload, редактирование без правильного seal отклоняется. Новый SHA требует нового preflight и не наследует старый plan/approval.

## Три действия оператора

Уточнение проверки структуры: [закрытый контракт public-only restore](../../docs/local-maintenance-structure-proof.md).
Непрозрачные routines и внешние зависимости не разрешаются по имени. Проверяется точное тело существующей routing-функции, её свойства, builtin-ссылки и trigger; неподдерживаемые объекты блокируются. Новый HEAD требует отдельного утверждения перед Production PREFLIGHT.

1. **Подготовить закрытую локальную конфигурацию вне Git.** Файл окружения содержит по одной строке `DIRECT_URL=...` и `DATABASE_URL=...`. Каталоги, конфигурация, файл окружения и доверенный CA-сертификат должны иметь ACL только для вашего Windows-пользователя, SYSTEM и Administrators. Не отправляйте URL, пароли или backup в чат. Пример `config.json` без секретов:

   ```json
   {
     "targetKind": "production",
     "environmentFile": "C:\\Users\\YOUR_NAME\\AppData\\Local\\LegalHubMaintenance\\production.env",
     "expectedHost": "db.YOUR_PROJECT_REF.supabase.co",
     "expectedApplicationHost": "db.YOUR_PROJECT_REF.supabase.co",
     "applicationRole": "YOUR_APPLICATION_DB_ROLE",
     "backupDirectory": "C:\\Users\\YOUR_NAME\\Documents\\LegalHub Private Backups",
     "privateDirectory": "C:\\Users\\YOUR_NAME\\AppData\\Local\\LegalHubMaintenance",
     "postgresBin": "C:\\Program Files\\PostgreSQL\\18\\bin",
     "nodeBin": "C:\\Program Files\\nodejs",
     "tlsRootCertFile": "C:\\Users\\YOUR_NAME\\AppData\\Local\\LegalHubMaintenance\\production-ca.pem"
   }

2. **Выполнить preflight и прочитать отчёт.** В чистом checkout: `PREFLIGHT.bat -ApprovedCommit <40-символьный SHA> -ExpectedMigrations <имя> -ConfigPath <путь>`. `STATUS.bat` и `REPORT.bat` читают только локальный отчёт; они не подтверждают текущее состояние DB. Если миграций нет, выполните `PREFLIGHT.bat -NoMigration -ApprovedCommit <SHA> -ConfigPath <путь>`: backup и симуляция будут пропущены. План действует четыре часа. Preflight создаёт приватную копию только схемы `public` без владельцев/ACL, восстанавливает её в собственном PostgreSQL на `127.0.0.1` и применяет миграцию только там. Это не полный backup ролей и других схем. Совместимость старого приложения проверяется на уровне схемы; HTTP smoke — отдельный шаг rollout.

3. **Применять только после отдельного решения владельца.** `APPLY_APPROVED.bat -ApprovalReference <ссылка_на_решение> -PlanPath <путь>` требует точного интерактивного подтверждения, повторной проверки и использует план лишь один раз. `ApprovalReference` — заявление оператора, а не криптографическая проверка внешнего решения. Рабочая команда внутри раннера — существующая `npm run db:migrate:deploy`; `package.json` и guarded script не менялись. При неизвестном результате: **диагностика ledger и результата, без повтора и автоматического rollback**.

Раннер блокирует неизвестные SQL/миграции, неподтверждённую общность DIRECT_URL и DATABASE_URL, недоступный read-only идентификатор кластера, отличающиеся роли приложения и миграции при создании sequence, а также нестандартные применимые default ACL для sequence. Он не выдаёт GRANT автоматически. Никакой unattended Production Apply не поддерживается; создание раннера не разрешает его Production использование.

## Отдельный Session Pooler preflight через IPv4

Новый режим **только для Preflight** требует PowerShell7 и двух явных выборов: `-ConnectionMode SupabaseSessionPooler` и `preflightConnectionMode: "supabase_shared_session_ipv4"` в отдельной приватной конфигурации. Отсутствующее поле сохраняет прежний Direct; неизвестный режим или несовпадение CLI/config блокируется. Автоматического fallback нет. Production Apply с этим режимом или его sealed plan запрещён самим кодом до подключения; отдельное разрешение владельца не отменяет этот guard.

Точные hostname/project reference/username получают через **Connect → Session pooler** авторизованного Dashboard нужного проекта. Host нельзя вычислять по региону. Только shared hostname вида `aws-<index>-<region>.pooler.supabase.com`, IPv4, порт **5432**, база `postgres`. Transaction pooler6543 не используется ни для maintenance, ни для проверки роли приложения. Оригинальные `DIRECT_URL`, `DATABASE_URL` и исходная конфигурация остаются неизменными; отдельный зашифрованный env-файл дополнительно содержит фиксированные ключи `PREFLIGHT_SESSION_URL` и `PREFLIGHT_APPLICATION_SESSION_URL`. Пароли совпадают с соответствующими оригинальными credentials и не входят в аргументы/логи.

Дополнительные поля приватной конфигурации (значения ниже — непригодные для запуска шаблоны):

```json
{
  "preflightConnectionMode": "supabase_shared_session_ipv4",
  "projectReference": "EXACT_DASHBOARD_PROJECT_REFERENCE",
  "expectedHost": "db.EXACT_DASHBOARD_PROJECT_REFERENCE.supabase.co",
  "sessionPoolerHost": "EXACT_DASHBOARD_SESSION_HOST",
  "maintenanceRole": "postgres",
  "sessionPoolerDashboardVerifiedAt": "ACTUAL_VERIFICATION_UTC_ISO_TIMESTAMP",
  "credentialCleanupDeadlineUtc": "ORIGINAL_OWNER_APPROVED_CREDENTIAL_DEADLINE_UTC"
}
```

Остальные закрытые пути/CA/`applicationRole` сохраняются из reviewed config, но новые env/config/TEMP/backup/restore находятся внутри существующего подтверждённого BitLocker-тома. Формат pooler-login — `<фактическая_role>.<projectReference>`; `current_user` и `session_user` должны отдельно подтвердить ожидаемую PostgreSQL-role. Для приложения используется второй session URL на5432 с прежними app credentials; исходный URL на6543 может проверяться только как метаданные происхождения, подключение к нему не выполняется.

Свежий Dashboard attestation действует не более24часов. Первоначальный cleanup deadline не сдвигают при копировании credentials; истёкшее окно блокирует новый preflight. DNS разрешается только для утверждённого hostname, выбирается публичный IPv4; `PGHOSTADDR` фиксирует socket-address, а исходный `PGHOST`, `sslmode=verify-full` и утверждённый CA обеспечивают проверку имени и цепочки. Запрещено ослаблять TLS или подменять параметры окружения. Успешный TLS/доступ подтверждается только настоящим подключением, не существованием CA-файла.

Раннер требует одинаковые database/OID/system_identifier/server_version через maintenance и application sessions. Клиентский TLS проверяет libpq; отдельный `pg_stat_ssl` для собственного backend должен подтвердить также TLS pooler→Postgres. Это не замена клиентской проверке сертификата и не повод менять SSL settings при отказе. Snapshot exporter остаётся в одной read-only repeatable-read транзакции. До/после dump проверяются PID, snapshot, identity, isolation и собственный advisory lock; отдельное соединение подтверждает импорт snapshot и невозможность захвата занятого probe key. Ключ фиксируется до запроса захвата, освобождается только на исходном backend; чужие locks/sessions не меняются. Потеря ответа/соединения, изменение identity, невозможность snapshot import или непроверенный cleanup блокируют результат. Первичная ошибка и cleanup code сохраняются раздельно. Экспорт/клиентские команды ограничены по времени; `pg_dump` остаётся однопоточным с обязательным `--snapshot` и без несогласованного повторного dump.

Sealed plan дополнительно связывает mode, hostname/port, IPv4, project, logins/roles, CA checksum/TLS policy и срок credentials. Старый plan/SHA не заменяет review и утверждение нового кандидата. Порядок: целевые тесты → независимый security review → CI на точном SHA → **владелец утверждает этот новый SHA** → один preflight:

```powershell
pwsh -NoProfile -File scripts/local-maintenance/runner.ps1 -Mode Preflight -ConnectionMode SupabaseSessionPooler -ApprovedCommit <NEW_OWNER_APPROVED_SHA> -ExpectedMigrations 20261027120000_meta_lead_ads_multitenant -ConfigPath <ENCRYPTED_SESSION_CONFIG>
```

Документированная поддержка: [Session connection](https://supabase.com/docs/guides/database/connecting-to-postgres), [backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [session semantics](https://supabase.com/kb/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO), [TLS](https://supabase.com/docs/guides/platform/ssl-enforcement). Документация и локальный протокольный тест не подтверждают фактический Supavisor preflight. Недоступный `pg_control_system`, несовпадение роли/OID, отказ CA или другой gate — STOP, без обхода, выдачи grants или изменения Supabase settings. Public-only backup и `PASS_SCHEMA_ONLY` не становятся полным disaster recovery/HTTP compatibility.

## Воспроизводимые Windows-тесты

`Set-PrivateAcl` пропускает запись только при точном защищённом каноническом ACL: три явных Allow FullControl для текущего пользователя, SYSTEM и Administrators; правильное наследование для файла/каталога; известный владелец; отсутствие reparse points у пути и предков. Унаследованный ACL не считается точным. Неизвестный владелец блокирует запись. В остальных случаях меняется только DACL через штатный .NET API; владелец, группа и SACL не записываются. Это устраняет лишнюю запись всего дескриптора в PowerShell `Set-Acl`, а не отменяет отказ Windows в WriteDACL. Ошибка записи остаётся ошибкой без повышения привилегий или запасного механизма. После записи обязательны `Assert-PrivateAcl` и точная повторная проверка.

Целевые тесты без БД: `pwsh -NoProfile -File tests/local-maintenance/acl-tests.ps1`. Проверка на заранее утверждённом закрытом каталоге: добавить `-PrivateTestRoot <каталог>`. Она создаёт только новые пустые тестовые объекты, проверяет DACL-only запись и идемпотентность, сохранность владельца/группы и отказ без fallback; затем удаляет только собственные пустые объекты с проверкой пути и WhatIf. Production credentials не нужны.

Из чистого checkout с локальными синтетическими PostgreSQL-базами:

```powershell
pwsh -NoProfile -File tests/local-maintenance/runner-tests.ps1
pwsh -NoProfile -File tests/local-maintenance/full-preflight.ps1
pwsh -NoProfile -File tests/local-maintenance/session-pooler-tests.ps1
```

К последней команде можно добавить `-PrivateTestRoot <утверждённый закрытый каталог>`: она проверяет snapshot/lock/import/dump/restore и потерянный acquire-response на собственном localhost PostgreSQL с синтетическими данными. Это не имитация успешного подключения к настоящему Supavisor. Обычный CI запускает только model tests без DNS/БД/credentials.

Отдельный Windows-тест `pwsh -NoProfile -File tests/local-maintenance/operator-launchers-tests.ps1 -PostgresBin <bin>` вызывает настоящие четыре BAT: синтетический PREFLIGHT, приватные offline STATUS/REPORT и только негативные APPLY. Он проверяет отсутствие/неподдерживаемую версию runtime, ранний отказ 5.1, неизменность Execution Policy, аргументы/кавычки и exit codes. Побайтно идентичные копии BAT с тестовым endpoint дополнительно проверяют точные argv и произвольный exit 37. Production Apply тестами не вызывается.

CLI/exit semantics: [about_Pwsh](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pwsh), [cmd /s /c](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd). Если действующая политика блокирует файл под 5.1 ещё до раннего guard, тест фиксирует этот отказ отдельно и проверяет guard на исходном тексте в inline-команде; настройки политики не изменяются. При повторном native отказе structure suite сохраняет только закрытый безопасный diagnostic в отдельный ACL-защищённый test report до очистки временного кластера и завершает тест с исходной ошибкой. Первоначальный PG17.12 failure остаётся UNKNOWN.
## Атомарная публикация отчётов

Отчёт сначала записывается в новый файл в том же защищённом каталоге:
ACL устанавливается до записи содержимого, выполняются flush на диск и
проверка SHA-256. Для замены используется `File.Replace` с
`[NullString]::Value` — настоящим .NET null без резервного файла; первая
публикация использует `File.Move` на том же томе. Неатомарного fallback нет.
Уникальное имя staging-файла исключает удаление файла другого writer при
перекрывающихся записях. При ошибке удаляется только файл этого вызова.
Ранее существовавший `.new` сохраняется как свидетельство прерванного запуска
и блокирует запись. Attempted marker сохраняет приоритет над отчётом:
использованный план нельзя удалять, сбрасывать или повторно применять.

Проверка реального файлового I/O на синтетических данных:
`pwsh -NoProfile -File tests/local-maintenance/report-write-tests.ps1`.
`full-preflight.ps1` проверяет публикацию checkpoint и итогового отчёта вокруг
миграции исключительно localhost; запрет `Mode Apply -Synthetic` сохраняется.

## Свежая проверка блокировок

`Assert-LockSafety` больше не принимает решение по старым счётчикам из
`Get-DatabaseSnapshot`: между ним и guard выполнялись дополнительные запросы
identity/application. После проверки размеров индексов выполняется один новый
read-only запрос. Он подтверждает прежние database/role/session role/OID/cluster/
server identity, TLS и право видеть статистику других соединений. Неизвестная
identity, скрытая статистика, ошибка запроса, отсутствующий либо нецелочисленный
счётчик блокируют выполнение.

Правила сохранены: любые waiting relation locks, внешние транзакции старше
30 секунд или idle-in-transaction запрещают DDL. Клиентские/служебные соединения
не исключаются; автоматического ожидания «пока станет безопасно» нет.
При `DDL_LOCK_RISK` stderr содержит только UTC и три проверенных счётчика.
SQL, PID, пользователи, connection strings и пути в диагностику не попадают.

Короткое read-only наблюдение 16 ноября 2026, 13:56:01–13:56:45 UTC: в трёх
из шести samples `idleTransactions=1`, в остальных ноль; waiting/long всегда
ноль. Это подтверждает кратковременный триггер текущего общего guard.
Точные счётчики прошлых APPLY не были сохранены; историческую причину либо
реальный конфликт с FK нельзя выдавать за доказанный факт. Связь с объектами
миграции не доказана, поэтому глобальная защитная политика не сужена.

Проверки: `pwsh -NoProfile -File tests/local-maintenance/lock-safety-tests.ps1`;
добавление `-WithPostgres` проверяет настоящие idle/waiting/long состояния на
принадлежащем тесту localhost-кластере с полной остановкой/очисткой.

Следующее окно выпуска (до 60 минут) согласуется с владельцем после проверки
исправления. Владелец подтверждает предупреждение организации и приостановку
работы в CRM; фоновые процессы не останавливаются без отдельного разрешения.
Новый SHA утверждается до Production PREFLIGHT. Нужен новый sealed plan;
attempted plans сохраняются и не используются повторно. Затем личный Read-Host
владельца, один APPLY, независимый postcheck и условный deployment со всеми
Lead Ads gates OFF. Любой свежий риск останавливает выпуск; чужие транзакции
не завершаются, guard не обходится.

### Prisma 5.22: строгий TLS и безопасная диагностика команды

Prisma URL использует `sslmode=require&sslaccept=strict&sslcert=<CA file>`.
В [парсере установленного engine 5.22](https://github.com/prisma/prisma-engines/blob/605197351a3c8bdd595af2d2a9bc3025bca48ea2/quaint/src/connector/postgres/url.rs)
`sslcert` загружает CA, а `sslrootcert` не обрабатывается. Для libpq сохраняются
`PGSSLMODE=verify-full` и `PGSSLROOTCERT`; настройки Production не меняются.
На локальной TLS-копии старый параметр воспроизводит P1011, правильный CA
проходит, неправильный CA и hostname отклоняются. TLS и advisory locks не отключаются.

Guarded entry point ограничивает stdout/stderr Prisma 64 КиБ на поток и
публикует только версионированный набор кодов ошибок. Runner повторно проверяет
закрытый формат перед сохранением в защищённом отчёте. Полный вывод, SQL,
credentials, URI и пути не публикуются. Неизвестный/повреждённый формат становится
`DIAGNOSTIC_UNAVAILABLE`; ненулевой exit code по-прежнему запрещает повтор SQL.
Ограничение вывода или сбой процесса означает неизвестный результат команды,
а не доказательство отсутствия изменений; attempted marker сохраняется.

Источники: [PostgreSQL statistics visibility/caching](https://www.postgresql.org/docs/17/monitoring-stats.html),
[table-level lock compatibility](https://www.postgresql.org/docs/17/explicit-locking.html).
