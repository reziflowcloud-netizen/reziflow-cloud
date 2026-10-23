# QA results — 2026-10-23

Verified application/source commit: `76559df` on `fix/leads-responsible-persistence`.
Base: `1aa114eab60ed6b672bef235adecf55632d7605b`.
Implementation review commits: `95a45fb`, metadata-outage correction `8348bfc`,
status-reason initialization correction and stronger browser coverage `76559df`.
This evidence follow-up changes only documentation/screenshots.

## Results

- Focused pure/security/routing/mobile/responsive/deployment regressions: **87/87 PASS**.
- `npm run build`: **PASS**, exit 0; Prisma Client **5.22.0** generated from the exact
  unchanged `prisma/schema.prisma`, Next **14.2.35** compiled/typechecked/prerendered.
  No schema, package, lockfile, migration, seed, deployment or environment-setting changes.
- `npx --no-install tsc --noEmit`, repeated after generation/build: **PASS**.
- Isolated PostgreSQL integration browser checks: **PASS**, details in `report.json`.
- Database-free actual-component mock browser smoke: **PASS**, `mock-result.json`.
- Browser page/runtime errors: **0**. No unexpected server 5xx observed. The metadata
  outage case intentionally injects 503; restricted scope expansion intentionally returns 403.
- All six rendered matrix cases: **no page-level horizontal overflow**.
- Nonblocking build warning: existing outdated Browserslist data; dependencies unchanged.

## Integration coverage

All/Mine/Employee through reload, actual in-app Detail Back, browser Back, and
switching values. Other filters retained: status, status reason, source, service
interest, search, temperature, custom dates, quick filter and sort direction/key.
The 390px mobile case additionally exercises actual detail Back and browser Back.

Same-tab real authenticated user and organization switches with old URLs;
namespace restoration after returning to the original account; inactive/deleted/
foreign employee; a selected employee deactivated before reload; unlinked Mine;
restricted UI and server scope expansion rejection; delayed metadata without
initial storage overwrite or premature lead requests; late All response after
Mine; malformed/unavailable namespaced storage; metadata outage preserving search
changes, original scope URL/storage/backTo, followed by successful Mine recovery.

Six-case pairwise rendered matrix (not a full Cartesian matrix):

| Width | Language | Theme | Result / screenshot |
| --- | --- | --- | --- |
| 1024 | RU | Light | PASS — `1024-ru-light.png` |
| 1440 | UA (`uk`) | Dark | PASS — `1440-uk-dark.png` |
| 1440 | PL | Slate | PASS — `1440-pl-slate.png` |
| 390 | RU | Dark | PASS — `390-ru-dark.png` |
| 414 | UA (`uk`) | Slate | PASS — `414-uk-slate.png` |
| 430 | PL | Light | PASS — `430-pl-light.png` |

Every matrix case switches Mine to Employee and reloads the rendered app.
The primary navigation suite covers all three values at desktop 1440. Mobile
screenshots show the actual Filters sheet. Screenshots contain synthetic data only.

## Safety and reproducibility

Fresh `git fetch origin` succeeded after granting command-level network access;
remote main matched the user's independently verified base. Proxy/network policy,
credentials, environment configuration and Vercel settings were not altered.
Runtime subsequently reported current enforced network policy. No tunnel/public
hosting operation was used. Both test servers bind to local loopback in the
reproduction instructions; no private remote preview mechanism is available.

DB isolation was verified using the local Docker socket: onboarding container
label `codex.onboarding=reziflow`, dedicated onboarding data volume, and only
`127.0.0.1:55432` host binding. The pre-existing stopped QA database container was
started; environment configuration was not restarted or changed. An empty dedicated
`reziflow_leads_responsible_qa` DB was made from **schema-only** local onboarding DB
output. No customer records were copied. Only synthetic fixtures were created,
and the runner removes only its own fixture organizations and dependent records.
No Production connection, customer data, migrations/backfills or integration sends.

Exact commands (with validated local QA DB override for DB-aware commands):

```sh
node --test --test-isolation=none tests/leads-responsible-persistence.test.mjs tests/staff-routing-scope.test.mjs tests/lead-responsible-visibility.test.mjs tests/security/hardening.test.mjs tests/mobile-lead-subtitle.test.mjs tests/mobile-refresh-autosave.test.mjs tests/desktop-responsive-layout.test.mjs tests/deployment-safety.test.mjs
node scripts/qa-leads-responsible.cjs
node scripts/leads-responsible-mock-harness.cjs
node scripts/qa-leads-responsible-mock.cjs
npm run build
npx --no-install tsc --noEmit
```

Cloud used an untracked local wrapper that validates the onboarding `.env.local`
DB as `127.0.0.1:55432/reziflow_dev`, rejects `DIRECT_URL`, and replaces only the
child process's database name with the dedicated QA name. It does not print or
modify credentials. Build and integration runner used that same override.
The mock harness needs no database or `.env.local`; it removes DB/auth selectors
from its child process and imports the actual frontend components with synthetic
API routes. Its results supplement, rather than replace, full integration checks.

Independent desktop/browser instructions: `docs/leads-responsible-qa.md`.
