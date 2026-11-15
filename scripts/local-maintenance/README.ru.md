# Локальный раннер миграций LegalHub

BAT-оператор работает через **Windows PowerShell 5.1**. Синтетические тесты требуют **PowerShell 7** (`pwsh`): они проверяют версию и сразу отказывают в 5.1. Нужны Git, Node.js/npm, зависимости из `npm ci` (`node_modules`), а также PostgreSQL **18** с `initdb`, `pg_ctl`, `psql`, `pg_isready`, `createdb`, `pg_dump` и `pg_restore`. Используйте чистый отдельный checkout утверждённого commit.

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

BAT запускает Windows PowerShell 5.1; полный синтетический тест вызывает настоящий `PREFLIGHT.bat` из другой рабочей папки. Production Apply тестами не вызывается.
