# Document actualization — UI-only Work review

No Docker/PostgreSQL, Prisma generation, authentication server or repository env files.
Actual Case/mobile, Tasks/mobile and Calendar/mobile components use synthetic
server-memory fixtures. This is **UI-only evidence**, not database/security evidence.
The server binds only to loopback. Do not publish or tunnel it.

Windows / Node 24, from the feature checkout:

```powershell
npm ci --ignore-scripts
node scripts/document-actualization-ui-harness.cjs
```

Open http://127.0.0.1:3119/cases/synthetic-actualization. No login. Stop with Ctrl+C.
Restart resets the fixture; reload/navigation retains it while the process lives.
Generated app: `work/actualization-ui-harness`; fixture API:
`scripts/fixtures/actualization-ui-api.js`. No production configuration is inherited.

Review:

1. Expand the existing document actualization section. Its small inline text shows
   the next control date. The initial synthetic prediction gives a control due today.
2. Toggle Decision received in MOS. The inline state and Case Task disappear/resume
   through existing autosave immediately. Reload, leave and reopen.
3. Add an actualization entry; correct its date with ✎, save, then delete it.
   Next date follows latest genuine date +90 days, falling back to predicted date.
   Clear the prediction after deleting entries to see neutral no-date text/no Task.
4. Open `/tasks` and `/calendar`. Use RU/UA/PL controls: managed titles follow the
   selected language, including mobile. Ordinary Task titles remain unchanged.
5. Inspect 1440/1024 and 390/414/430, Light/Dark/Slate, current/overdue/stopped states.
   The task persists without a push subscription. This mock does not prove server
   ownership/tenant/notification security; real isolated evidence is separate.

Synthetic controls, DevTools on this loopback page:

```js
const control = action => fetch('/api/mock/control', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action})
});
await control('fail');     // next save intentionally fails with mock 503
await control('recover');  // use the existing Retry button
await control('external');// next edit produces mock CAS conflict; use existing reload
await control('reset');    // reload the page after reset
```

Optional smoke in another terminal:

```powershell
npx playwright install chromium
$env:CHROMIUM_PATH = node -e "console.log(require('playwright').chromium.executablePath())"
node scripts/qa-document-actualization-ui.mjs
```

Cloud Chromium: six language/theme/width samples PASS; actual DocUpdate controls,
mock failure/retry and conflict PASS; runtime errors 0. Windows execution remains
for independent Work review. Results: `docs/qa/document-actualization/ui-only.json`.
