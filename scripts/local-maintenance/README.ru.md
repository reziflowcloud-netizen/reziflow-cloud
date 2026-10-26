# Локальный раннер миграций LegalHub

BAT-оператор работает через **Windows PowerShell 5.1**. Синтетические тесты требуют **PowerShell 7** (`pwsh`): они проверяют версию и сразу отказывают в 5.1. Нужны Git, Node.js/npm, зависимости из `npm ci` (`node_modules`), а также PostgreSQL **18** с `initdb`, `pg_ctl`, `psql`, `pg_isready`, `createdb`, `pg_dump` и `pg_restore`. Используйте чистый отдельный checkout утверждённого commit.

## Три действия оператора

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

## Воспроизводимые Windows-тесты

Из чистого checkout с локальными синтетическими PostgreSQL-базами:

```powershell
pwsh -NoProfile -File tests/local-maintenance/runner-tests.ps1
pwsh -NoProfile -File tests/local-maintenance/full-preflight.ps1
```

BAT запускает Windows PowerShell 5.1; полный синтетический тест вызывает настоящий `PREFLIGHT.bat` из другой рабочей папки. Production Apply тестами не вызывается.
