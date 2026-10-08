// HTTPS smoke test against the disposable iPhone environment; never accepts a production origin.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
async function main() {
  const session = JSON.parse(await fs.readFile(process.argv[2], 'utf8'))
  const origin = process.argv[3]
  assert.ok(new URL(origin).hostname.endsWith('.trycloudflare.com'))
  assert.equal(new URL(origin).protocol, 'https:')
  const { chromium } = require(path.join(process.env.LEGALHUB_QA_NODE_MODULES, 'playwright'))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await ctx.newPage()
  const checks = {}
  const endpoint = origin + `/api/cases/${session.caseId}`
  const get = async () => { const res = await ctx.request.get(endpoint); assert.equal(res.status(), 200); return res.json() }
  try {
    const login = await page.goto(origin + '/login')
    assert.equal(login.status(), 200); assert.equal(login.headers()['x-legalhub-environment'], 'isolated-iphone-qa')
    assert.equal((await ctx.request.get(endpoint, { maxRedirects: 0 })).status(), 307)
    const manifest = await (await ctx.request.get(origin + '/manifest.json')).json()
    assert.equal(manifest.display, 'standalone')
    assert.equal((await ctx.request.get(origin + manifest.icons[0].src)).status(), 200)
    assert.equal((await ctx.request.post(origin + '/api/auth/register', { data: {} })).status(), 403)
    checks.httpsManifestIconsAndRestrictedProxy = 'PASS'
    await page.locator('input[type=email]').fill(session.email)
    await page.locator('input[type=password]').fill(session.password)
    await page.locator('button[type=submit]').click(); await page.waitForURL('**/dashboard')
    await page.goto(origin + `/cases/${session.caseId}`)
    await page.locator('[data-section-key="case-basic"] input').first().waitFor()
    const writes = []
    page.on('request', req => { if (req.url() === endpoint && req.method() === 'PATCH') writes.push({ body: req.postDataJSON(), header: req.headers()['x-legalhub-case-write'] }) })
    const saved = () => page.locator('.case-save-status:visible[data-state="saved"]').waitFor()
    const notesSection = page.locator('[data-section-key="case-notes"]')
    await notesSection.locator('button').first().click()
    const notes = `HTTPS iPhone QA notes — ready ${Date.now()}`
    await notesSection.locator('textarea:visible').fill(notes); await saved()
    assert.equal((await get()).notes, notes)
    const appearanceSection = page.locator('[data-section-key="case-important-dates"]')
    const appearance = appearanceSection.locator('input').filter({ visible: true })
    const previous = await get()
    const target = await appearance.evaluateAll((inputs, value) => inputs.findIndex(input => input.value === value), previous.personalAppearanceNote)
    assert.ok(target >= 0)
    await appearance.nth(target).fill(notes); await saved()
    assert.equal((await get()).personalAppearanceNote, notes)
    const status = previous.status === 'В работе' ? 'Новый' : 'В работе'
    await page.locator('select:visible').first().selectOption(status); await saved()
    assert.equal((await get()).status, status)
    await page.reload(); await page.locator('[data-section-key="case-basic"] input').first().waitFor()
    assert.equal((await get()).notes, notes)
    assert.ok(writes.length >= 3); assert.ok(writes.every(write => typeof write.body.expectedUpdatedAt === 'string' && write.header === 'versioned'))
    checks.newAutosaveNotesStatusAppearanceReopenAndVersionedHeader = 'PASS'
    const field = page.locator('[data-section-key="case-basic"] input').first()
    await field.fill('IPHONE-QA-' + Date.now()); await page.locator('button[class*="saveButton"]:visible').click(); await saved()
    const loaded = await get()
    const old = await ctx.request.patch(endpoint, { data: { caseNumber: 'IPHONE-QA-001', notes: 'Legacy manual QA Save passed', personalAppearanceNote: loaded.personalAppearanceNote, status: loaded.status, totalValue: loaded.totalValue } })
    assert.equal(old.status(), 200); assert.equal(old.headers()['x-legalhub-case-compatibility'], 'legacy-manual-temporary')
    assert.equal((await ctx.request.patch(endpoint, { headers: { 'X-LegalHub-Case-Write': 'versioned' }, data: { notes: 'must fail' } })).status(), 428)
    assert.equal((await ctx.request.patch(endpoint, { data: { expectedUpdatedAt: loaded.updatedAt, notes: 'stale must fail' } })).status(), 409)
    assert.equal((await get()).notes, 'Legacy manual QA Save passed')
    checks.manualSaveLegacySaveAndStale409 = 'PASS'
    await fs.writeFile('docs/qa/iphone-tunnel-smoke.json', JSON.stringify({ origin, environment: 'isolated synthetic QA only', realIPhone: 'NOT RUN — user manual check pending', checks }, null, 2) + '\n')
    console.log(JSON.stringify(checks))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
