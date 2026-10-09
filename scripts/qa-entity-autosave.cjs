// Actual Next endpoints and browser forms against disposable loopback PostgreSQL only.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const database = new URL(process.env.DATABASE_URL || '')
assert.equal(database.hostname, '127.0.0.1'); assert.equal(database.port, '55432'); assert.equal(database.pathname, '/legalhub_case_qa')
const origin = 'http://localhost:3107', db = new PrismaClient()
const reportPath = process.env.LEGALHUB_QA_REPORT || 'docs/qa/entity-autosave-postgres-e2e.json'
const report = { testedEntities: (process.env.LEGALHUB_QA_ENTITIES || 'lead,client,task').split(','), isolatedDatabase: true, checks: {}, viewports: [], browserErrors: [], http5xx: [] }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const check = async (name, run) => { await run(); report.checks[name] = 'PASS'; console.log('PASS', name) }
const copy = {
  ru: { saved: '✓ Сохранено', saving: 'Сохранение…', error: 'Не удалось сохранить', retry: 'Повторить', save: 'Сохранить', qualification: 'Квалификация' },
  uk: { saved: '✓ Збережено', saving: 'Збереження…', error: 'Не вдалося зберегти', retry: 'Повторити', save: 'Зберегти', qualification: 'Кваліфікація' },
  pl: { saved: '✓ Zapisano', saving: 'Zapisywanie…', error: 'Nie udało się zapisać', retry: 'Ponów', save: 'Zapisz', qualification: 'Kwalifikacja' },
}
async function main() {
  const { chromium } = require(path.join(process.env.LEGALHUB_QA_NODE_MODULES, 'playwright'))
  const suffix = Date.now(), password = 'Disposable-QA-only-2026!'
  const org = await db.organization.create({ data: { name: 'Entity autosave QA', slug: 'entity-' + suffix } })
  const foreign = await db.organization.create({ data: { name: 'Foreign QA', slug: 'entity-foreign-' + suffix } })
  const user = await db.user.create({ data: { organizationId: org.id, role: 'owner', name: 'Entity QA', email: `entity-${suffix}@example.invalid`, password: await bcrypt.hash(password, 10) } })
  const colleague = await db.user.create({ data: { organizationId: org.id, name: 'Colleague', email: `colleague-${suffix}@example.invalid`, password: user.password, restrictedAccess: true } })
  const stranger = await db.user.create({ data: { organizationId: foreign.id, role: 'owner', name: 'Foreign', email: `foreign-${suffix}@example.invalid`, password: user.password } })
  const client = await db.client.create({ data: { organizationId: org.id, assignedToId: user.id, firstName: 'Entity', lastName: 'QA', email: 'retained@example.invalid', pesel: '123', gender: 'male' } })
  const lead = await db.lead.create({ data: { organizationId: org.id, assignedToId: user.id, firstName: 'Lead', fullName: 'Lead QA', notes: 'initial', email: 'lead@example.invalid' } })
  const task = await db.task.create({ data: { organizationId: org.id, assignedToId: user.id, title: 'Entity QA task', description: JSON.stringify({ reminderNote: 'initial', caseImportantDate: { caseId: 'sentinel', kind: 'qa' }, retainedMeta: true }), dueDate: new Date('2026-12-31') } })
  const sections = {}
  for (const scope of ['lead', 'client']) sections[scope] = await db.customSection.create({ data: { organizationId: org.id, scope, title: 'QA custom', fields: { create: [{ label: 'QA custom text', type: 'text' }] } }, include: { fields: true } })
  await db.leadStatus.createMany({ data: [{ organizationId: org.id, name: 'Новый' }, { organizationId: org.id, name: 'В работе' }, { organizationId: org.id, name: 'Отказ', requireReason: true, reasons: ['reason'] }] })
  await db.taskPriority.createMany({ data: [{ organizationId: org.id, name: 'Нормально', color: '#22c55e' }, { organizationId: org.id, name: 'Срочно', color: '#ff0000' }] })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true })
  const page = await ctx.newPage(), api = ctx.request
  const records = { lead, client, task }, plurals = { lead: 'leads', client: 'clients', task: 'tasks' }
  const endpoint = entity => `/api/${plurals[entity]}/${records[entity].id}`
  const get = async entity => { const res = await api.get(origin + endpoint(entity)); assert.equal(res.status(), 200); return res.json() }
  const patch = async (entity, data, headers) => api.patch(origin + endpoint(entity), { data, headers })
  page.on('pageerror', error => report.browserErrors.push(error.message))
  page.on('response', response => { if (response.status() >= 500) report.http5xx.push({ url: response.url(), status: response.status() }) })
  const login = async (context, account) => { const res = await context.request.post(origin + '/api/auth/login', { data: { email: account.email, password } }); assert.equal(res.status(), 200) }
  try {
    await login(ctx, user)
    for (const entity of report.testedEntities) {
      const key = entity === 'lead' ? 'notes' : entity === 'client' ? 'firstName' : 'title'
      await check(`${entity}: PostgreSQL CAS, stale writer 409, concurrent winner exactly once`, async () => {
        const loaded = await get(entity)
        assert.equal((await patch(entity, { [key]: 'CAS A', expectedUpdatedAt: loaded.updatedAt })).status(), 200)
        assert.equal((await patch(entity, { [key]: 'stale', expectedUpdatedAt: loaded.updatedAt })).status(), 409)
        const fresh = await get(entity)
        const race = await Promise.all(['winner A', 'winner B'].map(value => patch(entity, { [key]: value, expectedUpdatedAt: fresh.updatedAt })))
        assert.deepEqual(race.map(res => res.status()).sort(), [200, 409])
        assert.equal((await get(entity)).organizationId, org.id)
      })
      await check(`${entity}: old bundle manual PATCH, new version bump, no versionless autosave fallback`, async () => {
        const loaded = await get(entity)
        const oldBundlePayload = { ...loaded, [key]: 'old manual', ...(entity === 'client' ? { familyClientIds: (loaded.familyLinks || []).map(link => link.relativeClientId) } : {}) }
        delete oldBundlePayload.expectedUpdatedAt
        const legacy = await patch(entity, oldBundlePayload)
        assert.equal(legacy.status(), 200); assert.equal(legacy.headers()['x-legalhub-write-mode'], 'legacy-manual'); assert.equal(legacy.headers().deprecation, 'true')
        assert.ok(new Date((await get(entity)).updatedAt) > new Date(loaded.updatedAt))
        assert.equal((await patch(entity, { [key]: 'new missing' }, { 'X-LegalHub-Entity-Write': 'versioned' })).status(), 428)
        assert.equal((await patch(entity, { [key]: 'invalid', expectedUpdatedAt: null })).status(), 400)
        assert.equal((await patch(entity, { [key]: 'new stale', expectedUpdatedAt: loaded.updatedAt })).status(), 409)
      })
      await check(`${entity}: auth, restricted access, cross-tenant stale/version/body attacks`, async () => {
        const anonymous = await browser.newContext(), other = await browser.newContext(), restricted = await browser.newContext()
        await login(other, stranger); await login(restricted, colleague)
        const loaded = await get(entity)
        for (const method of ['get', 'patch']) {
          const args = method === 'patch' ? { maxRedirects: 0, data: { expectedUpdatedAt: loaded.updatedAt, organizationId: foreign.id, [key]: 'forbidden' } } : { maxRedirects: 0 }
          assert.ok([401,307].includes((await anonymous.request[method](origin + endpoint(entity), args)).status()))
          assert.equal((await other.request[method](origin + endpoint(entity), args)).status(), 404)
          assert.equal((await restricted.request[method](origin + endpoint(entity), args)).status(), 404)
        }
        const updated = await patch(entity, { organizationId: foreign.id, [key]: 'scope remains', expectedUpdatedAt: loaded.updatedAt })
        assert.equal(updated.status(), 200); assert.equal((await updated.json()).organizationId, org.id)
        assert.equal((await patch(entity, { [key]: 'cross-origin', expectedUpdatedAt: (await get(entity)).updatedAt }, { origin: 'https://cross-origin.invalid' })).status(), 403)
        await anonymous.close(); await other.close(); await restricted.close()
      })
    }
    await check('Lead status reason validation, history and next contact reminder atomic; invalid custom rolls everything back', async () => {
      let loaded = await get('lead'), before = await db.leadContactHistory.count({ where: { leadId: lead.id } })
      assert.equal((await patch('lead', { status: 'Отказ', expectedUpdatedAt: loaded.updatedAt })).status(), 400)
      assert.equal((await patch('lead', { status: 'Отказ', statusReason: 'reason', statusReasonComment: 'valid', nextContactAt: '2026-12-10T10:00', nextContactNote: 'call', expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      assert.equal(await db.leadContactHistory.count({ where: { leadId: lead.id } }), before + 3)
      assert.equal(await db.task.count({ where: { organizationId: org.id, description: { contains: lead.id } } }), 1)
      loaded = await get('lead'); before = await db.leadContactHistory.count({ where: { leadId: lead.id } })
      assert.equal((await patch('lead', { status: 'В работе', customFieldValues: { 999999999: 'bad' }, expectedUpdatedAt: loaded.updatedAt })).status(), 400)
      assert.equal((await get('lead')).updatedAt, loaded.updatedAt); assert.equal(await db.leadContactHistory.count({ where: { leadId: lead.id } }), before)
    })
    await check('Lead responsible resolves linked user; response and history retain correct identities', async () => {
      const employee = await db.employee.create({ data: { organizationId: org.id, name: 'Linked Colleague', userId: colleague.id, active: true } })
      const loaded = await get('lead')
      const response = await patch('lead', { employeeId: String(employee.id), expectedUpdatedAt: loaded.updatedAt })
      assert.equal(response.status(), 200); const saved = await response.json()
      assert.equal(saved.assignedToId, colleague.id); assert.equal(saved.employee.name, 'Linked Colleague'); assert.equal(saved.assignedTo.name, 'Colleague')
      const history = await db.leadContactHistory.findFirst({ where: { leadId: lead.id, note: { startsWith: 'Ответственный изменен' } }, orderBy: { createdAt: 'desc' } })
      assert.ok(history.note.includes((loaded.assignedTo?.name || '—') + ' -> Colleague'))
    })
    await check('Client minimal PATCH preserves omitted nullable/boolean fields and MOS fields; passport/rental reminder idempotence', async () => {
      let loaded = await get('client')
      assert.equal((await patch('client', { passportExpiresAt: '2028-12-20', rentalEndDate: '2027-12-31', legalTitle: 'najem', statusUKR: true, expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      loaded = await get('client'); assert.equal(loaded.email, 'retained@example.invalid'); assert.equal(loaded.pesel, '123'); assert.equal(loaded.gender, 'male')
      for (const value of ['renamed A', 'renamed B']) { assert.equal((await patch('client', { firstName: value, expectedUpdatedAt: loaded.updatedAt })).status(), 200); loaded = await get('client') }
      assert.equal(await db.task.count({ where: { organizationId: org.id, description: { contains: '"clientPassportEnd"' } } }), 1)
      assert.equal(await db.task.count({ where: { organizationId: org.id, description: { contains: '"clientRentalEnd"' } } }), 1)
      assert.equal((await patch('client', { email: '', gender: '', birthDate: '', statusUKR: false, expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      loaded = await get('client'); assert.equal(loaded.email, null); assert.equal(loaded.gender, null); assert.equal(loaded.statusUKR, false); assert.equal(loaded.pesel, '123')
    })
    await check('Task priority-only patch retains deadline, status completion and responsible work', async () => {
      let loaded = await get('task')
      assert.equal((await patch('task', { priority: 'Срочно', assignedToId: colleague.id, expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      loaded = await get('task'); assert.equal(loaded.dueDate.slice(0, 10), '2026-12-31'); assert.equal(loaded.assignedToId, colleague.id)
      assert.equal((await patch('task', { status: 'done', expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      loaded = await get('task'); assert.equal((await patch('task', { status: 'todo', expectedUpdatedAt: loaded.updatedAt })).status(), 200)
    })
    for (const entity of ['lead', 'client']) await check(`${entity}: custom text/clear participates in parent CAS, stale and wrong-scope rollback`, async () => {
      const field = sections[entity].fields[0].id, foreignField = sections[entity === 'lead' ? 'client' : 'lead'].fields[0].id
      let loaded = await get(entity)
      assert.equal((await patch(entity, { customFieldValues: { [field]: 'custom saved' }, expectedUpdatedAt: loaded.updatedAt })).status(), 200)
      assert.equal((await patch(entity, { customFieldValues: { [field]: 'stale' }, expectedUpdatedAt: loaded.updatedAt })).status(), 409)
      loaded = await get(entity); assert.equal(loaded.customFieldValues[field], 'custom saved')
      assert.equal((await patch(entity, { customFieldValues: { [foreignField]: 'wrong scope' }, expectedUpdatedAt: loaded.updatedAt })).status(), 400)
      assert.equal((await get(entity)).updatedAt, loaded.updatedAt)
      assert.equal((await patch(entity, { customFieldValues: { [field]: '' }, expectedUpdatedAt: loaded.updatedAt })).status(), 200)
    })
    await check('CRUD: create/read/partial update/delete Lead Client Task in isolated DB', async () => {
      for (const [entity, body] of Object.entries({ lead: { fullName: 'CRUD lead', notes: 'kept' }, client: { firstName: 'CRUD', lastName: 'Client', email: 'kept@example.invalid' }, task: { title: 'CRUD task', dueDate: '2027-12-31' } })) {
        const created = await api.post(origin + '/api/' + plurals[entity], { data: body }); assert.equal(created.status(), 200)
        const row = await created.json(), url = origin + '/api/' + plurals[entity] + '/' + row.id
        assert.equal((await api.get(url)).status(), 200)
        assert.equal((await api.patch(url, { data: { [entity === 'task' ? 'title' : entity === 'lead' ? 'fullName' : 'firstName']: 'CRUD updated', expectedUpdatedAt: row.updatedAt } })).status(), 200)
        assert.equal((await api.delete(url)).status(), 200); assert.equal((await api.get(url)).status(), 404)
      }
    })
    if (process.env.LEGALHUB_QA_API_ONLY) return
    const writes = [], reads = { lead: 0, client: 0, task: 0 }
    page.on('request', request => { for (const entity of Object.keys(records)) if (new URL(request.url()).pathname === endpoint(entity)) { if (request.method() === 'PATCH') writes.push({ entity, data: request.postDataJSON() }); if (request.method() === 'GET') reads[entity]++ } })
    const open = async (entity, width = 390, lang = 'ru', theme = 'light') => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(({ lang, theme }) => { localStorage.setItem('rezi_lang', lang); localStorage.setItem('rezi_theme', theme) }, { lang, theme })
      await page.goto(origin + (entity === 'task' ? '/tasks' : `/${plurals[entity]}/${records[entity].id}`))
      if (entity === 'task') { const loaded = await get('task'); if (width < 768) await page.getByRole('button').filter({ hasText: loaded.priority }).filter({ visible: true }).first().click(); await page.getByText(loaded.title, { exact: true }).filter({ visible: true }).first().click(); await page.locator('input:visible').first().waitFor() }
      if (entity === 'lead' && width < 768) await page.getByRole('button', { name: copy[lang].qualification, exact: true }).click()
      await input(entity).waitFor({ state: 'visible' })
    }
    const input = entity => entity === 'lead' ? page.locator('textarea[rows="7"]:visible').first() : entity === 'client' ? page.locator('[data-section-key="client-personal"] input:visible').first() : page.locator('input:visible').first()
    const pull = async () => page.evaluate(() => { const target = document.body; const touch = y => new Touch({ identifier: 1, target, clientX: 150, clientY: y }); target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(100)] })); target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(240)] })); target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] })) })
    const state = (lang, kind) => page.locator('.case-save-status:visible').filter({ hasText: copy[lang][kind] }).first().waitFor({ timeout: 20000 })
    for (const entity of report.testedEntities) {
      const key = entity === 'lead' ? 'notes' : entity === 'client' ? 'firstName' : 'title'
      await check(`${entity}: viewport/language/theme autosave forms`, async () => {
        for (const width of (process.env.LEGALHUB_QA_FAST ? [390] : [390,414,430,1024,1440])) for (const lang of (process.env.LEGALHUB_QA_FAST ? ['ru'] : ['ru','uk','pl'])) for (const theme of (process.env.LEGALHUB_QA_FAST ? ['light'] : ['light','dark','slate'])) {
          await open(entity, width, lang, theme)
          const value = `${entity}-${width}-${lang}-${theme}`
          await input(entity).fill(value); await state(lang, 'saved'); assert.equal((await get(entity))[key], value)
          assert.equal(await page.locator('.case-save-status:visible').filter({ hasText: /несохран|незбереж|Niezapisane/ }).count(), 0)
          const statusBox = await page.locator('.case-save-status:visible').first().boundingBox(); assert.ok(statusBox && statusBox.width <= width)
          report.viewports.push({ entity, width, lang, theme, autosave: 'PASS', scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) }); await fs.writeFile(reportPath, JSON.stringify(report,null,2)+'\n')
        }
      })
      await open(entity)
      await check(`${entity}: browser ordinary select/date/custom/metadata and nullable clearing`, async () => {
        if (entity === 'lead') {
          await page.locator('[data-lead-status-color] select:visible').selectOption('В работе'); await state('ru','saved'); assert.equal((await get(entity)).status, 'В работе')
          await page.locator('select:visible').filter({ has: page.locator('option[value=hot]') }).selectOption('hot'); await state('ru','saved'); assert.equal((await get(entity)).urgency, 'hot')
          await page.locator('input[type=date]:visible').fill('2027-02-03'); await state('ru','saved'); assert.equal((await get(entity)).deadlineAt.slice(0,10), '2027-02-03')
          await page.locator('input[type=date]:visible').fill(''); await state('ru','saved'); assert.equal((await get(entity)).deadlineAt, null)
        } else if (entity === 'client') {
          await page.locator('[data-section-key=client-personal] input[type=date]:visible').fill('1990-02-03'); await state('ru','saved'); assert.equal((await get(entity)).birthDate.slice(0,10), '1990-02-03')
          await page.locator('[data-section-key=client-personal] input[type=date]:visible').fill(''); await state('ru','saved'); assert.equal((await get(entity)).birthDate, null)
          await page.getByRole('button').filter({ hasText: 'Дополнительные разделы' }).filter({visible:true}).first().click()
        } else {
          await page.locator('input[type=date]:visible').fill('2027-02-03'); await state('ru','saved'); assert.equal((await get(entity)).dueDate.slice(0,10), '2027-02-03')
          await page.locator('input[type=date]:visible').fill(''); await state('ru','saved'); assert.equal((await get(entity)).dueDate, null)
          await page.locator('[role=dialog] input:visible').last().fill('ordinary task note'); await state('ru','saved'); const meta = JSON.parse((await get(entity)).description); assert.equal(meta.reminderNote, 'ordinary task note'); assert.equal(meta.retainedMeta, true)
        }
        if (entity !== 'task') {
          const field = sections[entity].fields[0].id, custom = page.locator(`#custom-field-${entity}-${records[entity].id}-${field}`)
          await custom.fill('browser custom'); await state('ru','saved'); assert.equal((await get(entity)).customFieldValues[field], 'browser custom')
          await custom.fill(''); await state('ru','saved'); assert.equal((await get(entity)).customFieldValues[field], '')
        }
        await open(entity)
      })
      await check(`${entity}: real UI stale conflict retains local edit and requires explicit reload`, async () => {
        const loaded = await get(entity); assert.equal((await patch(entity, { [key]: 'other writer A', expectedUpdatedAt: loaded.updatedAt })).status(), 200)
        await input(entity).fill('conflict retained B'); await page.locator('.case-save-status[data-state=conflict]:visible').waitFor(); assert.equal(await input(entity).inputValue(), 'conflict retained B')
        page.once('dialog', dialog => dialog.accept()); await page.locator('.case-save-status[data-state=conflict]:visible button').click(); await delay(400)
        assert.equal(await input(entity).inputValue(), 'other writer A'); await input(entity).fill('fresh writer B'); await state('ru','saved'); assert.equal((await get(entity))[key], 'fresh writer B')
      })
      await check(`${entity}: rapid edits, manual Save debounce and latest input in-flight`, async () => {
        const before = writes.length
        await input(entity).fill('rapid A'); await input(entity).fill('rapid B'); await input(entity).fill('rapid C'); await state('ru', 'saved')
        assert.equal(writes.length - before, 1); assert.equal((await get(entity))[key], 'rapid C')
        await input(entity).fill('manual flush'); await page.getByRole('button', { name: copy.ru.save, exact: true }).filter({ visible: true }).first().click()
        if (entity === 'task') await open(entity); else await state('ru', 'saved')
        assert.equal((await get(entity))[key], 'manual flush')
        await page.route('**' + endpoint(entity), async route => { if (route.request().method() === 'PATCH') await delay(1200); await route.continue() })
        await input(entity).fill('inflight first'); await state('ru', 'saving'); await input(entity).fill('inflight latest'); await state('ru', 'saved')
        assert.equal((await get(entity))[key], 'inflight latest'); await page.unroute('**' + endpoint(entity))
      })
      await check(`${entity}: network failure retains edit, Retry once and dirty refresh/resume blocked`, async () => {
        await page.route('**' + endpoint(entity), route => route.request().method() === 'PATCH' ? route.abort('internetdisconnected') : route.continue())
        await input(entity).fill('network retained'); await state('ru', 'error'); assert.equal(await input(entity).inputValue(), 'network retained')
        page.once('dialog', dialog => dialog.accept())
        if (entity === 'task') await page.getByRole('button', { name: 'Отмена', exact: true }).filter({ visible: true }).last().click()
        else await page.getByRole('button', { name: entity === 'lead' ? 'Назад' : 'Back', exact: true }).click()
        assert.equal(await input(entity).inputValue(), 'network retained')
        assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented }), true)
        await input(entity).blur(); await page.evaluate(() => window.scrollTo(0,0)); const pullBefore = reads[entity]; await pull(); await delay(150); assert.equal(reads[entity], pullBefore)
        const before = reads[entity]
        await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 46000; window.dispatchEvent(new Event('focus')); Date.now = now })
        await delay(200); assert.equal(reads[entity], before)
        await page.unroute('**' + endpoint(entity)); const start = writes.length
        await page.getByRole('button', { name: copy.ru.retry, exact: true }).first().click(); await state('ru', 'saved')
        assert.equal(writes.length - start, 1); assert.equal((await get(entity))[key], 'network retained')
      })
      await check(`${entity}: clean resume refresh and late GET cannot overwrite new saved edit`, async () => {
        const before = reads[entity]
        await page.evaluate(() => { window.qaClock = Date.now; Date.now = () => window.qaClock() + 46000; window.dispatchEvent(new Event('focus')) })
        await delay(800); assert.equal(reads[entity], before + 1); await page.evaluate(() => { Date.now = window.qaClock })
        await page.route('**' + endpoint(entity), async route => { if (route.request().method() === 'GET') { const response = await route.fetch(); await delay(1500); await route.fulfill({ response }) } else await route.continue() })
        await page.evaluate(() => { window.qaClock = Date.now; Date.now = () => window.qaClock() + 92000; window.dispatchEvent(new Event('focus')); Date.now = window.qaClock })
        await delay(150); await input(entity).fill('edit during GET'); await state('ru','saved'); await delay(1700)
        assert.equal(await input(entity).inputValue(), 'edit during GET'); assert.equal((await get(entity))[key], 'edit during GET'); await page.unroute('**' + endpoint(entity))
      })
      await check(`${entity}: immediate Back/modal close flushes; reopen persistence`, async () => {
        await input(entity).fill('leave flushed')
        if (entity === 'task') await page.getByRole('button', { name: 'Отмена', exact: true }).last().click()
        else { await page.getByRole('button', { name: entity === 'lead' ? 'Назад' : 'Back', exact: true }).click(); await page.waitForURL('**/' + plurals[entity]) }
        await delay(200); assert.equal((await get(entity))[key], 'leave flushed')
        await open(entity); assert.equal(await input(entity).inputValue(), 'leave flushed')
      })
    }
    report.fixtures = { organizationId: org.id, leadId: lead.id, clientId: client.id, taskId: task.id }
    assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.http5xx, [])
  } finally {
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
