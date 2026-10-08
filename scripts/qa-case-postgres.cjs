// Real authenticated Next + disposable PostgreSQL QA. Never accepts a non-loopback database.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const origin = 'http://127.0.0.1:3107'
const database = new URL(process.env.DATABASE_URL || '')
assert.equal(database.hostname, '127.0.0.1')
assert.equal(database.port, '55432')
assert.equal(database.pathname, '/legalhub_case_qa')
const db = new PrismaClient()
const report = { environment: { next: origin, postgres: '127.0.0.1:55432/legalhub_case_qa', disposable: true }, checks: {}, viewports: [], errors: [] }
const check = async (name, run) => { await run(); report.checks[name] = 'PASS'; console.log('PASS', name) }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function main() {
  const { chromium } = require(path.join(process.env.LEGALHUB_QA_NODE_MODULES, 'playwright'))
  const suffix = Date.now()
  const password = 'Disposable-QA-only-2026!'
  const org = await db.organization.create({ data: { name: 'Case autosave QA', slug: `case-qa-${suffix}` } })
  const otherOrg = await db.organization.create({ data: { name: 'Other tenant QA', slug: `case-other-${suffix}` } })
  const user = await db.user.create({ data: { email: `case-qa-${suffix}@example.invalid`, password: await bcrypt.hash(password, 10), name: 'QA Owner', role: 'owner', organizationId: org.id } })
  const otherUser = await db.user.create({ data: { email: `case-other-${suffix}@example.invalid`, password: user.password, name: 'Other QA', role: 'owner', organizationId: otherOrg.id } })
  const client = await db.client.create({ data: { firstName: 'Isolated', lastName: 'QA', organizationId: org.id, assignedToId: user.id } })
  const record = await db.case.create({ data: { clientId: client.id, organizationId: org.id, assignedToId: user.id, caseNumber: `QA-${suffix}`, notes: 'initial' } })
  const second = await db.case.create({ data: { clientId: client.id, organizationId: org.id, assignedToId: user.id, caseNumber: `QA-next-${suffix}` } })
  const section = await db.customSection.create({ data: { organizationId: org.id, scope: 'case', title: 'QA custom', fields: { create: [{ label: 'QA custom text', type: 'text' }, { label: 'QA custom number', type: 'number' }] } }, include: { fields: true } })
  const service = await db.service.create({ data: { organizationId: org.id, name: 'QA service' } })
  await db.caseStatus.createMany({ data: ['Новый', 'В работе', 'Архив'].map(name => ({ name, organizationId: org.id })) })
  const payment = await db.payment.create({ data: { caseId: record.id, amount: 15, note: 'QA immutable baseline' } })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('dialog', dialog => { report.errors.push(`Unexpected dialog: ${dialog.message()}`); dialog.dismiss() })
  const api = ctx.request
  const url = `/api/cases/${record.id}`
  const get = async () => { const res = await api.get(origin + url); assert.equal(res.status(), 200); return res.json() }
  const patch = async data => api.patch(origin + url, { data })
  const persisted = () => db.case.findUniqueOrThrow({ where: { id: record.id } })
  try {
    await check('real login UI and session', async () => {
      await page.goto(origin + '/login'); await page.locator('input[type=email]').fill(user.email); await page.locator('input[type=password]').fill(password)
      await page.locator('button[type=submit]').click(); await page.waitForURL('**/dashboard', { timeout: 120000 })
      assert.equal((await api.get(origin + '/api/auth/me')).status(), 200)
    })
    await check('PostgreSQL CAS A commit, stale B 409, no partial writes, fresh B commit', async () => {
      const loaded = await get()
      assert.equal((await patch({ notes: 'A committed', expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      const beforeTasks = await db.task.count({ where: { organizationId: org.id } })
      const conflict = await patch({ notes: 'B stale', status: 'В работе', personalAppearDate: '2026-12-10', customFieldValues: { [section.fields[0].id]: 'stale custom' }, expectedUpdatedAt: loaded.updatedAt })
      assert.equal(conflict.status(), 409); assert.equal((await persisted()).notes, 'A committed'); assert.equal((await persisted()).status, 'Новый')
      assert.equal(await db.task.count({ where: { organizationId: org.id } }), beforeTasks)
      assert.equal(await db.customFieldValue.count({ where: { recordId: record.id } }), 0)
      const fresh = await get(); assert.equal((await patch({ notes: 'B fresh', expectedUpdatedAt: fresh.updatedAt })).status(), 200)
      const same = await get()
      const concurrent = await Promise.all(['racer A', 'racer B'].map(notes => patch({ notes, expectedUpdatedAt: same.updatedAt })))
      assert.deepEqual(concurrent.map(res => res.status()).sort(), [200, 409])
    })
    await check('tenant isolation GET PATCH custom fields; revoked session', async () => {
      const other = await browser.newContext()
      assert.equal((await other.request.post(origin + '/api/auth/login', { data: { email: otherUser.email, password } })).status(), 200)
      assert.equal((await other.request.get(origin + url)).status(), 404)
      assert.equal((await other.request.patch(origin + url, { data: { notes: 'attack', expectedUpdatedAt: (await get()).updatedAt } })).status(), 404)
      assert.equal((await other.request.get(origin + `/api/custom-field-values?scope=case&recordId=${record.id}`)).status(), 404)
      await db.user.update({ where: { id: otherUser.id }, data: { sessionVersion: 1 } })
      assert.equal((await other.request.get(origin + '/api/auth/me')).status(), 401)
      await other.close()
    })
    await check('transactional dates/reminders create update clear, custom fields, rollback', async () => {
      let loaded = await get()
      assert.equal((await patch({ expectedUpdatedAt: loaded.updatedAt, filingDate: '2026-10-08', fingerprintsDate: '2026-11-09', predictedDecisionDate: '2027-02-10', personalAppearDate: '2026-12-10', customFieldValues: { [section.fields[0].id]: 'custom saved' }, reminderLanguage: 'pl' })).status(), 200)
      const tasks = await db.task.findMany({ where: { organizationId: org.id } }); assert.equal(tasks.length, 8)
      assert.equal((await get()).customFieldValues[section.fields[0].id], 'custom saved')
      loaded = await get()
      assert.equal((await patch({ expectedUpdatedAt: loaded.updatedAt, fingerprintsDate: '2026-12-11', predictedDecisionDate: '2027-03-10' })).status(), 200)
      assert.equal(await db.task.count({ where: { organizationId: org.id } }), 8)
      loaded = await get()
      assert.equal((await patch({ expectedUpdatedAt: loaded.updatedAt, notes: 'must rollback', customFieldValues: { 2147483647: 'foreign' } })).status(), 400)
      assert.equal((await get()).updatedAt, loaded.updatedAt); assert.equal((await persisted()).notes, loaded.notes)
      assert.equal((await patch({ expectedUpdatedAt: loaded.updatedAt, fingerprintsDate: '', predictedDecisionDate: '', personalAppearDate: '' })).status(), 200)
      assert.equal(await db.task.count({ where: { organizationId: org.id } }), 4)
    })
    await check('list status version and standalone custom-field PATCH compatibility', async () => {
      const list = await (await api.get(origin + '/api/cases?view=list')).json()
      const listed = list.find(row => row.id === record.id); assert.ok(listed.updatedAt)
      assert.equal((await patch({ status: 'В работе', expectedUpdatedAt: listed.updatedAt })).status(), 200)
      const endpoint = origin + '/api/custom-field-values'
      const loaded = await (await api.get(endpoint + `?scope=case&recordId=${record.id}`)).json(); assert.ok(loaded.expectedUpdatedAt)
      const data = { scope: 'case', recordId: record.id, values: { [section.fields[0].id]: 'standalone explicit' }, expectedUpdatedAt: loaded.expectedUpdatedAt }
      assert.equal((await api.patch(endpoint, { data })).status(), 200)
      assert.equal((await api.patch(endpoint, { data })).status(), 409)
    })
    const copy = {
      ru: { dirty: 'Есть несохранённые изменения', saving: 'Сохранение…', saved: '✓ Сохранено', error: 'Не удалось сохранить', retry: 'Повторить', reload: 'Загрузить актуальную запись' },
      uk: { dirty: 'Є незбережені зміни', saving: 'Збереження…', saved: '✓ Збережено', error: 'Не вдалося зберегти', retry: 'Повторити', reload: 'Завантажити актуальний запис' },
      pl: { dirty: 'Niezapisane zmiany', saving: 'Zapisywanie…', saved: '✓ Zapisano', error: 'Nie udało się zapisać', retry: 'Ponów', reload: 'Wczytaj aktualny rekord' },
    }
    const open = async () => {
      await page.goto(origin + `/cases/${record.id}`)
      await page.locator('input').filter({ visible: true }).count().catch(() => {})
      await page.waitForFunction(() => document.querySelector('[data-section-key="case-basic"] input') || document.querySelector('input.input'))
      await delay(800)
    }
    const field = () => page.viewportSize().width < 768 ? page.locator('[data-section-key="case-basic"] input').first() : page.locator('input:visible').first()
    const saveButton = () => page.viewportSize().width < 768 ? page.locator('button[class*="saveButton"]:visible') : page.locator('button.btn-primary:visible').first()
    const state = async text => { await page.locator('.case-save-status:visible').filter({ hasText: text }).waitFor({ state: 'visible', timeout: 15000 }) }
    const requests = []
    page.on('request', req => { if (req.method() === 'PATCH' && new URL(req.url()).pathname === url) requests.push(req.postDataJSON()) })
    for (const width of [390, 414, 430, 1024, 1440]) {
      for (const lang of ['ru', 'uk', 'pl']) {
        await page.setViewportSize({ width, height: 900 })
        await page.addInitScript(lang => localStorage.setItem('rezi_lang', lang), lang)
        await open()
        const input = field(); await input.waitFor({ state: 'visible' })
        const value = `QA-${width}-${lang}-${suffix}`
        const start = requests.length
        await input.fill(value); await state(copy[lang].dirty)
        await state(copy[lang].saved)
        assert.equal((await persisted()).caseNumber, value)
        assert.equal(requests.length - start, 1)
        assert.deepEqual(Object.keys(requests.at(-1)).sort(), ['caseNumber', 'expectedUpdatedAt', 'reminderLanguage'])
        const manualStart = requests.length
        await input.fill(value + '-manual'); await saveButton().click(); await state(copy[lang].saved)
        assert.equal((await persisted()).caseNumber, value + '-manual'); assert.equal(requests.length - manualStart, 1)
        await page.waitForFunction(width => width < 768 ? !!document.querySelector('[data-mobile-case-detail] button[class*="saveButton"]:not(:disabled)') : !!document.querySelector('.page-header button.btn-primary:not(:disabled)'), width)
        report.viewports.push({ width, lang, autosave: 'PASS', manualSave: 'PASS', scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) })
        console.log('PASS viewport', width, lang)
      }
    }
    await page.setViewportSize({ width: 390, height: 900 }); await page.addInitScript(() => localStorage.setItem('rezi_lang', 'ru')); await open()
    await check('rapid edits A/B/C 300ms minimal final DB C', async () => {
      const start = requests.length; await field().fill('rapid A'); await delay(300); await field().fill('rapid B'); await delay(300); await field().fill('rapid C')
      await state(copy.ru.saved); assert.equal((await persisted()).caseNumber, 'rapid C'); assert.equal(requests.length - start, 1)
    })
    await check('manual Save before debounce and during delayed autosave serializes latest', async () => {
      let start = requests.length; await field().fill('manual before debounce'); await saveButton().click(); await state(copy.ru.saved)
      assert.equal(requests.length - start, 1)
      await page.route('**' + url, async route => { if (route.request().method() === 'PATCH') await delay(1300); await route.continue() })
      start = requests.length; await field().fill('flight first'); await state(copy.ru.saving); await field().fill('flight latest'); await saveButton().click(); await state(copy.ru.saved)
      assert.equal((await persisted()).caseNumber, 'flight latest'); assert.equal(requests.length - start, 2)
      await page.unroute('**' + url)
    })
    await check('network failure preserves local input; retry writes exactly once', async () => {
      await page.route('**' + url, route => route.request().method() === 'PATCH' ? route.abort('failed') : route.continue())
      await field().fill('network retained'); await state(copy.ru.error); assert.equal(await field().inputValue(), 'network retained')
      assert.notEqual((await persisted()).caseNumber, 'network retained'); await page.unroute('**' + url)
      const start = requests.length; await page.getByRole('button', { name: copy.ru.retry, exact: true }).click(); await state(copy.ru.saved)
      assert.equal((await persisted()).caseNumber, 'network retained'); assert.equal(requests.length - start, 1)
    })
    await check('real UI conflict retained; confirmed reload observes A; fresh B succeeds', async () => {
      const loaded = await get(); assert.equal((await patch({ notes: 'external A', expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      await field().fill('conflict B')
      await page.getByRole('button', { name: copy.ru.reload, exact: true }).waitFor({ state: 'visible' }); assert.equal(await field().inputValue(), 'conflict B')
      page.removeAllListeners('dialog'); page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: copy.ru.reload, exact: true }).click(); await delay(1000)
      assert.equal(await field().inputValue(), (await persisted()).caseNumber)
      await field().fill('conflict B fresh'); await state(copy.ru.saved); assert.equal((await persisted()).caseNumber, 'conflict B fresh')
      page.on('dialog', dialog => { report.errors.push(`Unexpected dialog: ${dialog.message()}`); dialog.dismiss() })
    })
    await check('custom text/number use same Case CAS queue; clear nullable field', async () => {
      const custom = page.locator(`#custom-field-case-${record.id}-${section.fields[0].id}`)
      // The mobile custom section is opened through its normal accordion.
      if (!await custom.isVisible()) await page.getByText('Дополнительные разделы', { exact: true }).click()
      await custom.fill('custom browser'); await state(copy.ru.saved)
      assert.equal((await get()).customFieldValues[section.fields[0].id], 'custom browser')
      await custom.fill(''); await state(copy.ru.saved); assert.equal((await get()).customFieldValues[section.fields[0].id], '')
      await page.locator(`#custom-field-case-${record.id}-${section.fields[1].id}`).fill('32'); await state(copy.ru.saved)
      assert.equal((await get()).customFieldValues[section.fields[1].id], '32')
    })
    await check('ordinary service select, transactional date autosave and nullable clear', async () => {
      await open(); const select = page.locator('[data-section-key="case-basic"] select').first()
      await select.selectOption(String(service.id)); await state(copy.ru.saved); assert.equal((await persisted()).serviceId, service.id)
      await select.selectOption(''); await state(copy.ru.saved); assert.equal((await persisted()).serviceId, null)
      const dates = page.locator('[data-section-key="case-important-dates"] input[type=date]')
      await dates.nth(2).fill('2026-12-15'); await dates.nth(3).fill('2027-04-15'); await state(copy.ru.saved)
      assert.equal((await persisted()).fingerprintsDate.toISOString().slice(0, 10), '2026-12-15')
      assert.equal(await db.task.count({ where: { organizationId: org.id } }), 7)
      await dates.nth(2).fill(''); await dates.nth(3).fill(''); await state(copy.ru.saved)
      assert.equal((await persisted()).fingerprintsDate, null); assert.equal((await persisted()).predictedDecisionDate, null)
      assert.equal(await db.task.count({ where: { organizationId: org.id } }), 4)
    })
    let reads = 0
    page.on('request', req => { if (req.method() === 'GET' && new URL(req.url()).pathname === url) reads++ })
    const pull = async distance => page.evaluate(distance => {
      const target = document.querySelector('[data-section-key="case-basic"]')
      const touch = y => new Touch({ identifier: 1, target, clientX: 150, clientY: y })
      target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(100)] }))
      target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(100 + distance)] }))
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }))
    }, distance)
    const moreRefresh = async () => {
      await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Ещё', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Обновить', exact: true }).click()
    }
    await check('pull at top threshold release once; normal scroll; no hard reload or route change', async () => {
      await open(); await field().blur(); await page.evaluate(() => { window.scrollTo(0, 0); window.qaDocumentMarker = 123 })
      let start = reads; await pull(109); await delay(150); assert.equal(reads, start)
      await pull(110); await delay(700); assert.equal(reads, start + 1)
      await page.evaluate(() => window.scrollTo(0, 250)); start = reads; await pull(140); await delay(150); assert.equal(reads, start)
      await page.evaluate(() => window.scrollTo(0, 0)); assert.equal(await page.evaluate(() => window.qaDocumentMarker), 123)
      assert.equal(new URL(page.url()).pathname, `/cases/${record.id}`)
    })
    await check('dirty pull, dirty resume, manual refresh during pending save preserve latest', async () => {
      await field().fill('dirty pull'); await field().blur(); await page.evaluate(() => window.scrollTo(0, 0))
      let start = reads; await pull(140); await delay(100); assert.equal(reads, start); assert.equal(await field().inputValue(), 'dirty pull')
      await state(copy.ru.saved)
      await field().fill('dirty resume'); start = reads
      await page.evaluate(() => { window.qaNow = Date.now; Date.now = () => window.qaNow() + 46000; window.dispatchEvent(new Event('focus')) })
      await delay(100); assert.equal(reads, start); await state(copy.ru.saved)
      await page.evaluate(() => { Date.now = window.qaNow })
      await page.route('**' + url, async route => { if (route.request().method() === 'PATCH') await delay(1300); await route.continue() })
      await field().fill('dirty manual pending'); await state(copy.ru.saving); start = reads; await moreRefresh(); await delay(100)
      assert.equal(reads, start); assert.equal(await field().inputValue(), 'dirty manual pending'); await state(copy.ru.saved)
      await page.unroute('**' + url); await moreRefresh(); await delay(700); assert.equal(reads, start + 1)
      assert.equal(await field().inputValue(), 'dirty manual pending'); assert.equal((await persisted()).caseNumber, 'dirty manual pending')
    })
    await check('resume <45s no fetch >45s one fetch; no polling', async () => {
      await open()
      await page.evaluate(() => { window.qaNow = Date.now; window.qaBase = Date.now(); Date.now = () => window.qaBase })
      await moreRefresh(); await delay(700); let start = reads
      await page.evaluate(() => { Date.now = () => window.qaBase + 44000; window.dispatchEvent(new Event('focus')) })
      await delay(200); assert.equal(reads, start)
      await page.evaluate(() => { Date.now = () => window.qaBase + 46000; window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')) })
      await delay(700); assert.equal(reads, start + 1)
      start = reads; await delay(1500); assert.equal(reads, start)
      await page.evaluate(() => { Date.now = window.qaNow })
    })
    await check('late real GET snapshot cannot overwrite intervening autosave', async () => {
      await open()
      await page.route('**' + url, async route => {
        if (route.request().method() === 'GET') { const response = await route.fetch(); await delay(1500); await route.fulfill({ response }) }
        else await route.continue()
      })
      await moreRefresh(); await delay(100); await field().fill('edit during real GET'); await state(copy.ru.saved); await delay(1700)
      assert.equal(await field().inputValue(), 'edit during real GET'); assert.equal((await persisted()).caseNumber, 'edit during real GET')
      await page.unroute('**' + url)
    })
    await check('authenticated app Back bottom navigation other Case other section flush without confirms', async () => {
      await open(); await field().fill('leave app Back'); await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.waitForURL('**/cases')
      assert.equal((await persisted()).caseNumber, 'leave app Back')
      await open(); await field().fill('leave other Case'); await page.getByRole('navigation', { name: 'Mobile navigation' }).locator('a[href="/cases"]').click(); await page.waitForURL('**/cases')
      await page.locator('article[role="button"]:visible').first().click(); await page.waitForURL(`**/cases/${second.id}`)
      assert.equal((await persisted()).caseNumber, 'leave other Case')
      await open(); await field().fill('leave bottom nav'); await page.getByRole('navigation', { name: 'Mobile navigation' }).locator('a[href="/clients"]').click(); await page.waitForURL('**/clients')
      assert.equal((await persisted()).caseNumber, 'leave bottom nav')
      await page.setViewportSize({ width: 1440, height: 900 }); await open(); await field().fill('leave CRM section')
      await page.locator('a[href="/tasks"]:visible').first().click(); await page.waitForURL('**/tasks'); assert.equal((await persisted()).caseNumber, 'leave CRM section')
      await page.goto(origin + '/cases'); await open(); await field().fill('leave browser Back'); await page.evaluate(() => history.back()); await page.waitForURL('**/cases')
      assert.equal((await persisted()).caseNumber, 'leave browser Back')
    })
    await page.setViewportSize({ width: 390, height: 900 })
    for (const lang of ['ru', 'uk', 'pl']) await check(`all five save states localized ${lang}`, async () => {
      await page.addInitScript(lang => localStorage.setItem('rezi_lang', lang), lang); await open()
      await page.route('**' + url, async route => { if (route.request().method() === 'PATCH') await delay(500); await route.continue() })
      await field().fill(`states-${lang}`); await state(copy[lang].dirty); await state(copy[lang].saving); await state(copy[lang].saved); await page.unroute('**' + url)
      await page.route('**' + url, route => route.request().method() === 'PATCH' ? route.abort('failed') : route.continue())
      await field().fill(`error-${lang}`); await state(copy[lang].error); await page.unroute('**' + url)
      await page.getByRole('button', { name: copy[lang].retry, exact: true }).click(); await state(copy[lang].saved)
      const loaded = await get(); assert.equal((await patch({ notes: `external-${lang}`, expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      await field().fill(`conflict-${lang}`); await page.getByRole('button', { name: copy[lang].reload, exact: true }).waitFor({ state: 'visible' })
      page.removeAllListeners('dialog'); page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: copy[lang].reload, exact: true }).click(); await delay(700)
      page.on('dialog', dialog => { report.errors.push(`Unexpected dialog: ${dialog.message()}`); dialog.dismiss() })
    })
    await check('payments untouched by autosave', async () => { assert.deepEqual(await db.payment.findUnique({ where: { id: payment.id } }), payment) })
    await check('explicit payment UI then Case autosave uses acknowledged parent version', async () => {
      await page.addInitScript(() => localStorage.setItem('rezi_lang', 'ru')); await open()
      await page.getByRole('button', { name: /^Оплаты/ }).click()
      await page.locator('input[type=number]:visible').first().fill('5')
      const response = page.waitForResponse(res => new URL(res.url()).pathname === url + '/payments' && res.request().method() === 'POST')
      await page.getByRole('button', { name: 'Добавить оплату', exact: true }).click(); assert.equal((await response).status(), 200)
      await page.waitForFunction(() => Array.from(document.querySelectorAll('input[type=number]')).find(input => input.getClientRects().length)?.value === '')
      await page.getByRole('button', { name: 'Детали', exact: true }).click(); await field().fill('after explicit payment'); await state(copy.ru.saved)
      assert.equal((await persisted()).caseNumber, 'after explicit payment'); assert.equal((await persisted()).totalPaid, 20)
    })
    await check('CRUD isolated Case create read manual patch archive delete', async () => {
      const created = await api.post(origin + '/api/cases', { data: { clientId: client.id, caseNumber: `CRUD-${suffix}` } }); assert.equal(created.status(), 200)
      const row = await created.json(); const endpoint = origin + `/api/cases/${row.id}`
      assert.equal((await api.get(endpoint)).status(), 200)
      assert.equal((await api.patch(endpoint, { data: { status: 'Архив', expectedUpdatedAt: row.updatedAt } })).status(), 200)
      assert.equal((await api.delete(endpoint)).status(), 200); assert.equal((await api.get(endpoint)).status(), 404)
    })
    report.fixture = { organizationId: org.id, caseId: record.id, secondCaseId: second.id }
  } catch (error) {
    report.errors.push(error.stack || error.message)
    throw error
  } finally {
    await fs.writeFile('docs/qa/case-postgres-e2e.json', JSON.stringify(report, null, 2) + '\n')
    await browser.close()
  }
  assert.deepEqual(report.errors, [])
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
