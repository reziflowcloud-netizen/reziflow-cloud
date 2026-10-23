# Leads Responsible persistence QA

Feature branch: `fix/leads-responsible-persistence`.
Base: `1aa114eab60ed6b672bef235adecf55632d7605b` (fresh fetch verified).
No deployment, main merge, schema change, migration, backfill, settings or secrets changes.

## Independent browser verification without Docker/PostgreSQL

From this branch with repository dependencies installed:

```sh
node scripts/leads-responsible-mock-harness.cjs
```

Open **http://127.0.0.1:3117/leads** on the same machine. This is a loopback-only,
frontend-only harness generated under `work/leads-responsible-harness`. It imports
the actual Leads/Detail, scope hook/control, language, navigation and CSS components.
Its synthetic API has no Prisma/database/authentication backend and rejects writes.
It does not load the repository `.env.local`. Do not publish or tunnel it publicly.
Stop the harness with Ctrl+C. Generated files can be removed afterward.

Optional automated browser smoke, in another terminal:

```sh
CHROMIUM_PATH=/path/to/chromium node scripts/qa-leads-responsible-mock.cjs
```

Use a system Chromium executable, or install Playwright Chromium and use its
`require('playwright').chromium.executablePath()` path. The script defaults to
`/usr/bin/chromium`. Results are written under `work/leads-responsible`.

Manual checks:

1. Select Mine, All, then Synthetic Other. Reload each, open its visible lead,
   use the detail Back button, then repeat using browser Back. Keep status,
   source, interest, search and other filter selections in the URL.
2. In browser DevTools set `document.cookie='qa-user=2;path=/'`, reload the same
   tab: the other synthetic user starts with All. Set `qa-user=1`, reload:
   the first user's saved selection returns. Set `qa-org=qa-b`, reload to check
   organization separation; restore `qa-org=qa-a`. These cookies are mock-only.
3. DevTools request blocking: block `*/api/staff-scope*`, reload a Mine or Employee
   URL, change search/status/source, open a lead. `backTo` must preserve the original
   scope parameters. The scope control is hidden during the outage; local storage
   must not change. Unblock and reload: the validated saved scope returns.
4. Network throttling: delay `/api/staff-scope` while restoring Mine. It must not
   become All while metadata is pending. Change an employee URL to `employee:999`:
   successful metadata validation must select All.
5. Inspect widths 1024/1440 and 390/414/430; on mobile open the Filters sheet.
   Use the actual language/theme controls for RU/UA/PL and Light/Dark/Slate.

Mock identity changes are synthetic layout cookies, not authentication tests.
Mock responses do not prove server authorization or database integration. Those
are separately checked by the isolated PostgreSQL integration run below.
No supported private remote preview/tunnel is available in this session; the
loopback harness is the reproducible independent verification path.

## Isolated integration browser runner

`scripts/qa-leads-responsible.cjs` requires an **empty disposable** PostgreSQL DB
at `127.0.0.1:55432/reziflow_leads_responsible_qa` and a Next server at
`http://127.0.0.1:3107` configured for that same DB. It refuses other DB targets
and a nonempty organization table. Never point it at a shared/customer database.
It creates synthetic organizations/users/employees/leads, generates a random
in-memory password, and cleans up only the organizations it created. It never
prints credentials. `LEADS_QA_INTERACTIVE=1` opens headed Chromium and pauses after
synthetic login for manual inspection. The server must also use only local QA
JWT/configuration values, without external integration credentials.

Cloud setup verified the existing onboarding PostgreSQL container's label,
dedicated volume and localhost-only port binding. An empty dedicated DB was
created from **schema-only** output of that local onboarding DB. No data copy,
Prisma migration/deploy, seed or production database operation was used.
The server and runner received the same explicitly validated local DB override.

Run with that local-only environment already configured:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3107
# Another terminal, same disposable DATABASE_URL:
node scripts/qa-leads-responsible.cjs
```

Optional `LEADS_QA_OUTPUT` changes the local evidence directory. The runner uses
real login/API/server access rules and actual pages. Only intentional delayed or
failed metadata/list responses and client-storage failures are intercepted.

## Verification commands

```sh
node --test --test-isolation=none tests/leads-responsible-persistence.test.mjs tests/staff-routing-scope.test.mjs tests/lead-responsible-visibility.test.mjs tests/security/hardening.test.mjs tests/mobile-lead-subtitle.test.mjs tests/mobile-refresh-autosave.test.mjs tests/desktop-responsive-layout.test.mjs tests/deployment-safety.test.mjs
npx --no-install prisma generate
npx --no-install tsc --noEmit
npm run build
```

Use Node 24 for the TypeScript imports in the pure tests. `--test-isolation=none`
ensures actual named test execution in the managed command sandbox. Database-
aware build/checks must use the validated local-only QA environment. The build
script is `prisma generate && next build`; no migration or seed step is present.

Final observed results and screenshots: `docs/qa/leads-responsible/`.
