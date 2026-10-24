# Decision received — independent UI review

Frontend-only actual Case page/mobile components, synthetic API fixtures and
server-memory persistence/CAS. This harness provides **UI-only evidence**;
it has no Prisma/database/authentication backend and proves no real server permissions.
It binds only to loopback, reads no repository env files, and passes no database,
authentication or integration credentials to its child process. Do not publish/tunnel it.

Windows (Node installed; PostgreSQL/Docker unnecessary), from the feature checkout:

```powershell
npm ci --ignore-scripts
node scripts/decision-received-ui-harness.cjs
```

Open http://127.0.0.1:3118/cases/synthetic-decision in your browser. There is no login.
Stop with Ctrl+C. Data survives reload/leave/reopen while the server process lives;
restart resets it. Generated files stay under `work/decision-ui-harness`.

1. Desktop: expand MOS/correspondence if necessary. The compact square checkbox
   sits directly below `Przewidywana data wydania decyzji` in the same form group.
2. Mobile: open MOS/correspondence. The date and checkbox share this existing
   accordion; the Important Dates summary still includes the date.
3. Check/uncheck, wait for the existing saved indicator, reload, leave for Cases
   and reopen. Open a second browser tab to see the shared synthetic state.
4. Use existing language/theme controls: RU / UA / PL and Light / Dark / Slate.
   Inspect desktop 1024/1440 and mobile 390/414/430; no horizontal overflow.
5. Browser DevTools Network: checkbox autosave sends only `decisionReceived`,
   `expectedUpdatedAt`, `reminderLanguage`. Other fields remain unchanged.

Synthetic controls in DevTools console (same loopback page):

```js
const control = action => fetch('/api/mock/control', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({action})
});
await control('external'); // stale page -> next checkbox edit shows conflict
// Use the existing Reload current record button and confirm discard.
await control('fail');     // next autosave intentionally returns mock 503
await control('recover');  // then click existing Retry
await control('reset');    // reset synthetic record; reload the page
```

Optional automated UI-only smoke (another terminal):

```powershell
npx playwright install chromium
$env:CHROMIUM_PATH = node -e "console.log(require('playwright').chromium.executablePath())"
node scripts/qa-decision-ui-harness.cjs
```

Observed Cloud UI-only smoke: six matrix cases PASS, mock conflict PASS,
failure-retained draft/retry PASS, runtime errors zero. This is a pairwise matrix,
not every language × theme × width combination. Windows execution itself remains
for independent Work review. Real database/security/migration evidence follows
separately after its final rerun.
