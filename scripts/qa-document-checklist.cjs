// Real authenticated API/UI QA against disposable loopback PostgreSQL only.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const { PrismaClient } = require('@prisma/client'), bcrypt = require('bcryptjs'), { chromium, request } = require('playwright')
const target = new URL(process.env.DATABASE_URL || '')
assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '55432'); assert.equal(target.pathname, '/legalhub_case_qa')
const origin = 'http://localhost:3107', db = new PrismaClient()
const report = { environment: 'disposable loopback PostgreSQL + production Next build', checks: {}, viewports: [], errors: [] }
const check = async (name, run) => { await run(); report.checks[name] = 'PASS'; console.log('PASS', name) }
async function main() {
  const suffix = Date.now(), password = 'Disposable-Checklist-QA-2026!'
  const org = await db.organization.create({ data: { name: 'Checklist QA', slug: `checklist-qa-${suffix}`, notificationAutomationEnabled: true, notificationAutomationActivatedAt: new Date(0) } })
  const foreign = await db.organization.create({ data: { name: 'Other checklist QA', slug: `checklist-other-${suffix}` } })
  const user = await db.user.create({ data: { organizationId: org.id, name: 'QA Owner', role: 'owner', email: `checklist-owner-${suffix}@example.invalid`, password: await bcrypt.hash(password, 10) } })
  const employee = await db.user.create({ data: { organizationId: org.id, name: 'QA Restricted', restrictedAccess: true, email: `checklist-staff-${suffix}@example.invalid`, password: user.password } })
  const outsider = await db.user.create({ data: { organizationId: foreign.id, name: 'QA Other', role: 'owner', email: `checklist-other-${suffix}@example.invalid`, password: user.password } })
  const client = await db.client.create({ data: { organizationId: org.id, firstName: 'Checklist', lastName: 'QA', assignedToId: employee.id } })
  const foreignService = await db.service.create({ data: { organizationId: foreign.id, name: 'Other service' } })
  const browser = await chromium.launch({ headless: true }), ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage(), api = ctx.request
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  const req = async (method, route, data, status = 200, context = api) => {
    const res = await context[method](origin + route, { maxRedirects: 0, ...(data === undefined ? {} : { data }) }); assert.equal(res.status(), status, `${method} ${route}: ${(await res.text()).slice(0, 200)}`); return status >= 300 && status < 400 ? res.headers() : res.json()
  }
  const login = async (context, account) => req('post', '/api/auth/login', { email: account.email, password }, 200, context)
  let service, secondService, current, old, legacySnapshot, initial, file
  try {
    await login(api, user)
    await db.caseStatus.createMany({ data: ['Новый', 'В работе', 'Архив'].map(name => ({ name, organizationId: org.id })) })
    await db.caseOption.createMany({ data: ['Paszport', 'Zdjęcie'].map((value, order) => ({ organizationId: org.id, type: 'mosDocument', value, order })) })
    service = await req('post', '/api/services', { name: 'Document checklist service', price: 100 })
    secondService = await req('post', '/api/services', { name: 'Second service' })
    const templateUrl = `/api/services/${service.id}/document-template`
    old = await db.case.create({ data: { organizationId: org.id, clientId: client.id, serviceId: service.id, assignedToId: employee.id, caseNumber: `LEGACY-${suffix}`, mosNumber: 'MOS-PRESERVED', mosSentAt: new Date('2026-10-09'), cabinetLogin: 'qa-only', cabinetPassword: 'qa-only' } })
    await db.task.createMany({ data: ['Paszport', 'Old submitted document'].map(name => ({ organizationId: org.id, title: `MOS: ${name}`, status: 'done', description: JSON.stringify({ mosDocument: { caseId: old.id, sentAt: '2026-10-09' } }) })) })
    await db.task.createMany({ data: [
      { organizationId: org.id, title: 'MOS: Paszport', status: 'done', description: JSON.stringify({ mosDocument: { caseId: old.id, sentAt: '2026-10-08' } }) },
      { organizationId: org.id, title: 'MOS: Undated submitted document', status: 'done', dueDate: new Date('2026-12-01'), description: JSON.stringify({ mosDocument: { caseId: old.id } }) },
      { organizationId: org.id, title: 'MOS: Manual pending legacy document', status: 'todo', description: JSON.stringify({ reminderNote: 'Legacy pending note', mosDocument: { caseId: old.id, sentAt: null } }) },
      { organizationId: foreign.id, title: 'MOS: Cross-tenant invalid history', status: 'done', description: JSON.stringify({ mosDocument: { caseId: old.id, sentAt: '2026-10-09' } }) },
    ] })
    await check('legacy general/service fallback and no mutation on reads', async () => {
      const t = await req('get', templateUrl); assert.equal(t.legacy, true); assert.equal(t.items.length, 2)
      const list = await req('get', `/api/cases/${old.id}/checklist`); assert.equal(list.initialized, false); assert.equal(list.items.length, 0)
      assert.equal((await db.case.findUniqueOrThrow({ where: { id: old.id } })).updatedAt.toISOString(), old.updatedAt.toISOString())
      await db.caseOption.create({ data: { organizationId: org.id, type: `mosDocument:${secondService.id}`, value: 'Specific service document' } })
      assert.equal((await req('get', `/api/services/${secondService.id}/document-template`)).items.length, 1)
    })
    const requirements = [
      { name: 'Paszport', required: true, forMos: true, active: true },
      { name: 'Zdjęcie', required: true, forMos: true, active: true },
      { name: 'Insurance', required: true, forMos: false, active: true },
      { name: 'Meldunek', required: false, forMos: true, active: true },
    ]
    await check('template create/toggles/reorder/name/archive CAS and duplicate rejection', async () => {
      let t = await req('put', templateUrl, { expectedVersion: 0, items: requirements })
      assert.equal(t.legacy, false); assert.equal(t.items.length, 4)
      await req('put', templateUrl, { expectedVersion: 0, items: t.items }, 409)
      await req('put', templateUrl, { expectedVersion: t.version, items: [...t.items, { ...requirements[0], name: '  PASZPORT  ' }] }, 400)
      t = await req('put', templateUrl, { expectedVersion: t.version, items: [...t.items].reverse().map(row => row.name === 'Meldunek' ? { ...row, name: 'Meldunek optional' } : row) })
      assert.equal(t.items[0].name, 'Meldunek optional')
      const toggled = t.items.map(item => item.name === 'Insurance' ? { ...item, required: false, forMos: true } : item)
      t = await req('put', templateUrl, { expectedVersion: t.version, items: toggled })
      assert.equal(t.items.find(item => item.name === 'Insurance').required, false)
      assert.equal(t.items.find(item => item.name === 'Insurance').forMos, true)
      t = await req('put', templateUrl, { expectedVersion: t.version, items: [...t.items.map(item => item.name === 'Insurance' ? { ...item, required: true, forMos: false } : item), { name: 'Archived template record', required: true, forMos: true, active: false }] })
      assert.equal(t.items.filter(item => item.active).length, 4)
      initial = t
    })
    await check('atomic new Case snapshot; existing Case unchanged; later template edits isolated', async () => {
      current = await req('post', '/api/cases', { clientId: client.id, serviceId: service.id, assignedToId: employee.id, caseNumber: `V2-${suffix}` })
      const list = await req('get', `/api/cases/${current.id}/checklist`); assert.equal(list.items.length, 4); assert.equal(list.progress.required, 3)
      let t = await req('get', templateUrl)
      t = await req('put', templateUrl, { expectedVersion: t.version, items: [...t.items, { name: 'New template document', required: false, forMos: false, active: true }] })
      assert.equal((await req('get', `/api/cases/${current.id}/checklist`)).items.length, 4)
      assert.equal((await req('get', `/api/cases/${old.id}/checklist`)).initialized, false)
      const next = await req('post', '/api/cases', { clientId: client.id, serviceId: service.id, assignedToId: employee.id })
      assert.equal((await req('get', `/api/cases/${next.id}/checklist`)).items.length, 5)
    })
    await check('Lead conversion and CSV import both create Case snapshots', async () => {
      const lead = await db.lead.create({ data: { organizationId: org.id, fullName: 'Converted QA', assignedToId: user.id } })
      const converted = await req('post', `/api/leads/${lead.id}/convert`, { createCase: true, serviceId: service.id })
      assert.equal((await req('get', `/api/cases/${converted.caseId}/checklist`)).items.length, 5)
      const csv = `first name,last name,service,case number\nImported,QA,Document checklist service,CSV-${suffix}`
      const result = await api.post(origin + '/api/import', { multipart: { file: { name: 'qa.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }, confirm: 'true' } })
      assert.equal(result.status(), 200, (await result.text()).slice(0, 200))
      const imported = await db.case.findFirstOrThrow({ where: { organizationId: org.id, caseNumber: `CSV-${suffix}` } })
      assert.equal((await req('get', `/api/cases/${imported.id}/checklist`)).items.length, 5)
    })
    await check('optional-only snapshot has no blockers and emits no readiness event', async () => {
      const optionalService = await req('post', '/api/services', { name: 'Optional-only service' })
      await req('put', `/api/services/${optionalService.id}/document-template`, { expectedVersion: 0, items: [{ name: 'Optional evidence', required: false, forMos: false, active: true }] })
      const optionalCase = await req('post', '/api/cases', { clientId: client.id, serviceId: optionalService.id, assignedToId: employee.id })
      const payload = await req('get', `/api/cases/${optionalCase.id}/checklist`); assert.equal(payload.progress.ready, true); assert.equal(payload.progress.actionable, false)
      assert.equal((await db.case.findUniqueOrThrow({ where: { id: optionalCase.id } })).documentsReady, true)
      assert.equal(await db.notification.count({ where: { entityId: optionalCase.id } }), 0)
    })
    const listUrl = `/api/cases/${current.id}/checklist`, get = () => req('get', listUrl)
    const itemPatch = async (name, body) => { const row = (await get()).items.find(item => item.name === name); return req('patch', `${listUrl}/${row.id}`, { expectedVersion: row.version, ...body }) }
    await check('simultaneous final required statuses serialize and emit exactly one readiness occurrence', async () => {
      const concurrent = await req('post', '/api/cases', { clientId: client.id, serviceId: service.id, assignedToId: employee.id })
      const rows = (await req('get', `/api/cases/${concurrent.id}/checklist`)).items.filter(item => item.active && item.required)
      const results = await Promise.all(rows.map(row => api.patch(origin + `/api/cases/${concurrent.id}/checklist/${row.id}`, { data: { expectedVersion: row.version, status: 'RECEIVED' } })))
      assert.ok(results.every(res => res.status() === 200))
      assert.equal(await db.notification.count({ where: { entityId: concurrent.id, type: 'documents_ready' } }), 1)
    })
    await check('readiness notification responsible only; optional missing; repeat save dedupe; second occurrence', async () => {
      await itemPatch('Paszport', { status: 'RECEIVED', note: 'Passport note' }); await itemPatch('Zdjęcie', { status: 'RECEIVED' })
      const count = () => db.notification.count({ where: { organizationId: org.id, entityId: current.id, type: 'documents_ready' } })
      assert.equal(await count(), 0)
      await itemPatch('Insurance', { status: 'RECEIVED' }); assert.equal(await count(), 1)
      assert.equal((await get()).progress.received, 3)
      const notice = await db.notification.findFirstOrThrow({ where: { entityId: current.id, type: 'documents_ready' } })
      assert.equal(notice.userId, employee.id); assert.equal(notice.deepLink, `/cases/${current.id}?tab=docs`); assert.equal(notice.pushRequested, false)
      assert.equal(await db.notificationPushDelivery.count({ where: { notificationId: notice.id } }), 0)
      await itemPatch('Insurance', { status: 'RECEIVED', note: 'same readiness' }); assert.equal(await count(), 1)
      await itemPatch('Insurance', { status: 'NEEDED' }); await itemPatch('Insurance', { status: 'RECEIVED' }); assert.equal(await count(), 2)
      assert.equal(await db.task.count({ where: { organizationId: org.id, description: { contains: current.id } } }), 0)
      const employeeCtx = await request.newContext(); await login(employeeCtx, employee)
      const noticeRes = await employeeCtx.get(origin + `/notifications/open/${notice.id}`, { maxRedirects: 0 }); assert.equal(noticeRes.status(), 307); assert.equal(noticeRes.headers().location, `/cases/${current.id}?tab=docs`)
      await employeeCtx.dispose()
    })
    await check('concurrent CAS one commit/one conflict; no partial writes; independent Case autosave version', async () => {
      const row = (await get()).items.find(item => item.name === 'Paszport')
      const oldVersion = (await db.case.findUniqueOrThrow({ where: { id: current.id } })).updatedAt
      const results = await Promise.all(['A', 'B'].map(note => api.patch(origin + `${listUrl}/${row.id}`, { data: { expectedVersion: row.version, note } })))
      assert.deepEqual(results.map(res => res.status()).sort(), [200, 409])
      assert.equal((await db.case.findUniqueOrThrow({ where: { id: current.id } })).updatedAt.toISOString(), oldVersion.toISOString())
      await req('patch', `${listUrl}/${row.id}`, { note: 'unversioned' }, 428)
    })
    await check('MOS same source, status/date validation, historical date persists, no task duplication', async () => {
      const row = (await get()).items.find(item => item.name === 'Insurance')
      await req('patch', `${listUrl}/${row.id}`, { expectedVersion: row.version, status: 'SUBMITTED_TO_MOS' }, 400)
      await itemPatch('Paszport', { status: 'SUBMITTED_TO_MOS', submittedAt: '2026-10-09' })
      const submitted = (await get()).items.find(item => item.name === 'Paszport'); assert.equal(submitted.mosSubmittedAt.slice(0, 10), '2026-10-09')
      await req('patch', `${listUrl}/${submitted.id}`, { expectedVersion: submitted.version, submittedAt: '2026-02-30' }, 400)
      await itemPatch('Paszport', { note: 'Preserved MOS note' }); assert.equal((await get()).items.find(item => item.name === 'Paszport').mosSubmittedAt.slice(0, 10), '2026-10-09')
      await req('post', `/api/cases/${current.id}/mos-documents/submit`, { names: ['Zdjęcie'], submittedAt: '2026-10-09' })
      assert.equal((await get()).items.find(item => item.name === 'Zdjęcie').status, 'SUBMITTED_TO_MOS')
      assert.equal(await db.task.count({ where: { organizationId: org.id, description: { contains: current.id } } }), 0)
    })
    await check('file relation, cross-case rejection, note and reload persistence', async () => {
      file = await db.caseDocument.create({ data: { caseId: current.id, name: 'Passport fixture.pdf', fileType: 'pdf', mimeType: 'application/pdf' } })
      const row = (await get()).items.find(item => item.name === 'Paszport')
      await req('post', `${listUrl}/${row.id}/files`, { expectedVersion: row.version, documentId: file.id })
      const fresh = (await get()).items.find(item => item.id === row.id); assert.equal(fresh.files[0].id, file.id); assert.equal(fresh.note, 'Preserved MOS note')
      const alien = await db.caseDocument.create({ data: { caseId: old.id, name: 'Other case fixture.pdf' } })
      await req('post', `${listUrl}/${row.id}/files`, { expectedVersion: fresh.version, documentId: alien.id }, 404)
    })
    await check('manual Case-only document; service change Keep; merge preserves statuses/files/notes and obsolete items', async () => {
      let data = await get(); await req('post', listUrl, { action: 'add', expectedVersion: data.version, name: 'Manual evidence', required: false, forMos: false })
      assert.equal((await req('get', templateUrl)).items.some(item => item.name === 'Manual evidence'), false)
      let c = await req('get', `/api/cases/${current.id}`)
      await req('patch', `/api/cases/${current.id}`, { expectedUpdatedAt: c.updatedAt, serviceId: secondService.id })
      data = await get(); assert.notEqual(data.templateServiceId, data.serviceId)
      await req('post', listUrl, { action: 'keep', expectedVersion: data.version, serviceId: secondService.id }); assert.equal((await get()).items.length, 5)
      c = await req('get', `/api/cases/${current.id}`); await req('patch', `/api/cases/${current.id}`, { expectedUpdatedAt: c.updatedAt, serviceId: service.id })
      data = await get(); await req('post', listUrl, { action: 'keep', expectedVersion: data.version, serviceId: service.id })
      await req('put', `/api/services/${secondService.id}/document-template`, { expectedVersion: 0, items: [requirements[0], { name: 'New required evidence', required: true, forMos: false, active: true }] })
      c = await req('get', `/api/cases/${current.id}`); await req('patch', `/api/cases/${current.id}`, { expectedUpdatedAt: c.updatedAt, serviceId: secondService.id })
      data = await get(); await req('post', listUrl, { action: 'merge', expectedVersion: data.version, serviceId: secondService.id })
      data = await get(); const passport = data.items.find(item => item.name === 'Paszport')
      assert.equal(passport.status, 'SUBMITTED_TO_MOS'); assert.equal(passport.files[0].id, file.id); assert.equal(passport.note, 'Preserved MOS note')
      assert.equal(data.items.find(item => item.name === 'Insurance').outsideTemplate, true); assert.equal(data.items.length, 6)
      await req('post', listUrl, { action: 'merge', expectedVersion: data.version, serviceId: secondService.id }); assert.equal((await get()).items.length, 6)
    })
    await check('explicit legacy conversion retains submitted names/dates and existing MOS credentials; no initial notification', async () => {
      const oldUrl = `/api/cases/${old.id}/checklist`
      await req('post', oldUrl, { action: 'initialize', expectedVersion: 0, serviceId: service.id })
      legacySnapshot = await req('get', oldUrl)
      const passport = legacySnapshot.items.find(item => item.name === 'Paszport'); assert.equal(passport.status, 'SUBMITTED_TO_MOS'); assert.equal(passport.mosSubmittedAt.slice(0, 10), '2026-10-09')
      assert.equal(legacySnapshot.items.find(item => item.name === 'Old submitted document').outsideTemplate, true)
      const undated = legacySnapshot.items.find(item => item.name === 'Undated submitted document'); assert.equal(undated.status, 'SUBMITTED_TO_MOS'); assert.equal(undated.mosSubmittedAt, null)
      const pending = legacySnapshot.items.find(item => item.name === 'Manual pending legacy document'); assert.equal(pending.status, 'NEEDED'); assert.equal(pending.note, 'Legacy pending note'); assert.equal(pending.forMos, true)
      assert.equal(legacySnapshot.items.some(item => item.name === 'Cross-tenant invalid history'), false)
      const saved = await db.case.findUniqueOrThrow({ where: { id: old.id } }); assert.equal(saved.cabinetLogin, old.cabinetLogin); assert.equal(saved.mosNumber, old.mosNumber); assert.equal(saved.updatedAt.toISOString(), old.updatedAt.toISOString())
      assert.equal(await db.task.count({ where: { organizationId: org.id, description: { contains: old.id } } }), 5)
      assert.equal(await db.notification.count({ where: { entityId: old.id, type: 'documents_ready' } }), 0)
      await req('post', oldUrl, { action: 'initialize', expectedVersion: legacySnapshot.version, serviceId: service.id }, 409)
    })
    await check('restricted access, cross-tenant, template permission and revoked session', async () => {
      const staff = await request.newContext(), other = await request.newContext(), anon = await request.newContext()
      await login(staff, employee); await login(other, outsider)
      await req('get', listUrl, undefined, 200, staff)
      await req('put', templateUrl, { expectedVersion: initial.version, items: initial.items }, 403, staff)
      for (const context of [other, anon]) await req('get', listUrl, undefined, context === other ? 404 : 307, context)
      const hidden = await db.case.create({ data: { organizationId: org.id, clientId: client.id, assignedToId: user.id } })
      await req('get', `/api/cases/${hidden.id}/checklist`, undefined, 404, staff)
      const row = (await get()).items[0]
      await req('patch', `${listUrl}/${row.id}`, { expectedVersion: row.version, status: 'NEEDED' }, 404, other)
      await req('post', '/api/cases', { clientId: client.id, serviceId: foreignService.id }, 404)
      await req('post', '/api/cases', { clientId: client.id, assignedToId: outsider.id }, 404)
      await req('get', `/api/services/${foreignService.id}/document-template`, undefined, 404)
      await db.user.update({ where: { id: employee.id }, data: { sessionVersion: { increment: 1 } } })
      await req('get', listUrl, undefined, 401, staff)
      await Promise.all([staff.dispose(), other.dispose(), anon.dispose()])
    })
    await check('readiness respects organization OFF and recipient in-app opt-out', async () => {
      await db.organization.update({ where: { id: org.id }, data: { notificationAutomationEnabled: false } })
      let row = (await get()).items.find(item => item.name === 'New required evidence'); await itemPatch(row.name, { status: 'RECEIVED' })
      const count = await db.notification.count({ where: { entityId: current.id } }); assert.equal(count, 2)
      await db.organization.update({ where: { id: org.id }, data: { notificationAutomationEnabled: true } })
      await db.notificationPreference.create({ data: { organizationId: org.id, userId: employee.id, events: { documents_ready: { inApp: false } } } })
      await itemPatch(row.name, { status: 'NEEDED' }); await itemPatch(row.name, { status: 'RECEIVED' })
      assert.equal(await db.notification.count({ where: { entityId: current.id } }), count)
    })
    await check('explicit archive preserves linked files', async () => {
      const data = await get(), row = data.items.find(item => item.name === 'Manual evidence')
      await req('delete', `${listUrl}/${row.id}`, { expectedVersion: row.version }); assert.equal((await get()).items.find(item => item.id === row.id).active, false)
      assert.equal(await db.caseDocument.count({ where: { id: file.id } }), 1)
    })
    const polishDir = path.join(process.cwd(), '.qa', 'desktop-cleanup-polish'); await fs.mkdir(polishDir, { recursive: true })
    const detailsDir = path.join(process.cwd(), 'docs', 'qa', 'document-checklist-v2-desktop-cleanup'); await fs.mkdir(detailsDir, { recursive: true })
    const docsRoot = () => page.locator('[data-document-checklist=documents]:visible')
    const passportButton = () => docsRoot().locator('[data-checklist-item=Paszport]')
    const openPassport = async () => { await passportButton().click(); await page.getByRole('dialog').waitFor() }
    const patchRoute = `**${listUrl}/*`
    const { documentChecklistText } = await import('../src/lib/documentChecklistI18n.ts')
    const metadataVisible = async (row, item, lang) => {
      const copy = documentChecklistText[lang], text = await row.textContent()
      for (const value of [item.status === 'NEEDED' ? copy.statusNeeded : item.status === 'RECEIVED' ? copy.received : copy.submitted, item.required ? copy.required : copy.optional, item.forMos ? 'MOS' : copy.notMos, item.files.length ? `${copy.fileCount}: ${item.files.length}` : copy.noFiles, ...(item.outsideTemplate ? [copy.outside] : []), ...(item.note ? [item.note] : [])]) assert.ok(text.includes(value), `Missing item metadata: ${value}`)
      if (item.mosSubmittedAt || item.receivedAt) assert.ok(text.includes(new Date(item.mosSubmittedAt || item.receivedAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : lang === 'pl' ? 'pl-PL' : 'ru-RU')))
    }
    await page.goto(origin + `/cases/${current.id}?tab=docs`)
    await page.evaluate(() => { localStorage.setItem('rezi_lang', 'uk'); localStorage.setItem('rezi_theme', 'light'); document.documentElement.dataset.theme = 'light'; window.dispatchEvent(new CustomEvent('langchange', { detail: 'uk' })) })
    await check('manual Save waits for server, closes once, preserves file and restores opener focus', async () => {
      await passportButton().focus(); await page.keyboard.press('Enter'); const dialog = page.getByRole('dialog'); await dialog.waitFor()
      await dialog.locator('textarea').fill('UI polish saved note')
      let release, started, writes = 0
      const gate = new Promise(resolve => { release = resolve }), requestStarted = new Promise(resolve => { started = resolve })
      await page.route(patchRoute, async route => { if (route.request().method() !== 'PATCH') return route.continue(); writes++; started(); await gate; await route.continue() })
      await page.screenshot({ path: path.join(polishDir, '06-modal-before-save.png') })
      await dialog.locator('[data-checklist-save]').evaluate(button => { button.click(); button.click() })
      await requestStarted
      assert.equal(await dialog.isVisible(), true); assert.equal(await dialog.locator('[data-checklist-save]').isDisabled(), true)
      assert.equal(await dialog.locator('textarea').isDisabled(), true); assert.equal(writes, 1)
      release(); await dialog.waitFor({ state: 'hidden' }); await page.unroute(patchRoute)
      assert.equal(writes, 1); const row = (await get()).items.find(item => item.name === 'Paszport')
      assert.equal(row.note, 'UI polish saved note'); assert.equal(row.status, 'SUBMITTED_TO_MOS'); assert.equal(row.active, true); assert.equal(row.files[0].id, file.id)
      assert.equal(await passportButton().evaluate(button => button === document.activeElement), true)
      await docsRoot().locator('[role=status][data-state=saved]').waitFor()
      await page.screenshot({ path: path.join(polishDir, '07-after-save-modal-closed.png') })
    })
    await check('failed Save retains draft and editor; successful Retry closes without archive', async () => {
      await openPassport(); const dialog = page.getByRole('dialog'); await dialog.locator('textarea').fill('UI polish retry retained')
      let writes = 0
      await page.route(patchRoute, async route => { if (route.request().method() !== 'PATCH') return route.continue(); writes++; if (writes === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"synthetic unavailable"}' }); else await route.continue() })
      await dialog.locator('[data-checklist-save]').click(); await dialog.locator('[data-state=error]').waitFor()
      assert.equal(await dialog.isVisible(), true); assert.equal(await dialog.locator('textarea').inputValue(), 'UI polish retry retained')
      assert.equal((await get()).items.find(item => item.name === 'Paszport').note, 'UI polish saved note')
      await dialog.locator('[data-checklist-save]').click(); await dialog.waitFor({ state: 'hidden' }); await page.unroute(patchRoute)
      const row = (await get()).items.find(item => item.name === 'Paszport'); assert.equal(row.note, 'UI polish retry retained'); assert.equal(row.active, true); assert.equal(writes, 2)
    })
    await check('manual Save drains in-flight autosave and newer draft in CAS order before close', async () => {
      await openPassport(); const dialog = page.getByRole('dialog')
      let release, started, writes = 0
      const gate = new Promise(resolve => { release = resolve }), requestStarted = new Promise(resolve => { started = resolve })
      await page.route(patchRoute, async route => { if (route.request().method() !== 'PATCH') return route.continue(); writes++; if (writes === 1) { started(); await gate } await route.continue() })
      await dialog.locator('textarea').fill('UI polish pending A'); await requestStarted
      await dialog.locator('textarea').fill('UI polish latest B'); await dialog.locator('[data-checklist-save]').click()
      assert.equal(await dialog.isVisible(), true); release(); await dialog.waitFor({ state: 'hidden' }); await page.unroute(patchRoute)
      assert.equal(writes, 2); assert.equal((await get()).items.find(item => item.name === 'Paszport').note, 'UI polish latest B')
    })
    await check('CAS conflict retains editor and draft until explicit reload; subsequent Save closes', async () => {
      await openPassport(); const dialog = page.getByRole('dialog'); await dialog.locator('textarea').fill('UI polish conflict draft')
      await page.route(patchRoute, async route => { if (route.request().method() === 'PATCH') await route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"synthetic conflict"}' }); else await route.continue() })
      await dialog.locator('[data-checklist-save]').click(); await dialog.locator('[data-state=conflict]').waitFor(); await page.unroute(patchRoute)
      assert.equal(await dialog.isVisible(), true); assert.equal(await dialog.locator('textarea').inputValue(), 'UI polish conflict draft')
      await dialog.locator('[data-state=conflict] button').click()
      await page.waitForFunction(() => !document.querySelector('[role=dialog] [data-state=conflict]'))
      await dialog.locator('textarea').fill('UI polish after reload'); await dialog.locator('[data-checklist-save]').click(); await dialog.waitFor({ state: 'hidden' })
      assert.equal((await get()).items.find(item => item.name === 'Paszport').note, 'UI polish after reload')
    })
    await check('file action blocks overlapping Save and preserves relation after final Save closes', async () => {
      const extra = await db.caseDocument.create({ data: { caseId: current.id, name: 'UI polish harmless relation.pdf', fileType: 'pdf' } })
      await page.reload(); await openPassport(); const dialog = page.getByRole('dialog')
      await dialog.locator('select').last().selectOption(String(extra.id))
      let release, started, writes = 0
      const gate = new Promise(resolve => { release = resolve }), requestStarted = new Promise(resolve => { started = resolve })
      const fileRoute = `**${listUrl}/*/files`
      await page.route(fileRoute, async route => { writes++; started(); await gate; await route.continue() })
      await dialog.getByRole('button', { name: 'Пов’язати файл', exact: true }).click(); await requestStarted
      assert.equal(await dialog.locator('[data-checklist-save]').isDisabled(), true)
      release(); await page.waitForFunction(() => !document.querySelector('[data-checklist-save]:disabled')); await page.unroute(fileRoute)
      assert.equal(await dialog.isVisible(), true); await dialog.locator('[data-checklist-save]').click(); await dialog.waitFor({ state: 'hidden' })
      assert.equal(writes, 1); assert.equal((await get()).items.find(item => item.name === 'Paszport').files.length, 2)
    })
    await check('RU/UA/PL × Light/Dark/Slate × 390/414/430/1024/1280/1440/1920 responsive polish and no overflow', async () => {
      const screenshotDir = path.join(process.env.TEMP, 'legalhub-document-checklist-v2-screenshots'); await fs.mkdir(screenshotDir, { recursive: true })
      for (const width of [390, 414, 430, 1024, 1280, 1440, 1920]) for (const lang of ['ru', 'uk', 'pl']) for (const theme of ['light', 'dark', 'slate']) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(origin + `/cases/${current.id}?tab=docs`)
        await page.evaluate(({ lang, theme }) => { localStorage.setItem('rezi_lang', lang); localStorage.setItem('rezi_theme', theme); document.documentElement.dataset.theme = theme; window.dispatchEvent(new CustomEvent('langchange', { detail: lang })) }, { lang, theme })
        const root = page.locator('[data-document-checklist=documents]:visible'); await root.waitFor(); await root.locator('[data-checklist-item]').first().waitFor()
        assert.equal(await page.evaluate(() => innerWidth), width)
        assert.equal(await root.locator('progress').evaluate(el => Math.round(el.getBoundingClientRect().height)), width < 769 ? 8 : 10)
        const clientDocs = page.locator('[data-client-documents]:visible')
        assert.equal(await clientDocs.evaluate((el, checklist) => !!(el.compareDocumentPosition(checklist) & Node.DOCUMENT_POSITION_FOLLOWING), await root.elementHandle()), true)
        for (const item of (await get()).items.filter(item => item.active)) {
          const row = root.locator('[data-checklist-item]').filter({ has: page.locator(`[data-checklist-status-control=${item.status === 'NEEDED' ? 'unchecked' : 'checked'}]`) }).filter({ hasText: item.name })
          assert.equal(await row.count(), 1)
          await metadataVisible(row, item, lang)
          const shape = await row.locator('[data-checklist-status-control]').evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, radius: getComputedStyle(el).borderRadius }))
          assert.ok(Math.abs(shape.width - 22) < 0.1 && Math.abs(shape.height - 22) < 0.1); assert.equal(shape.radius, '4px')
          assert.ok((await row.boundingBox()).height >= 44)
        }
        const collapse = root.locator('button[aria-expanded]').first()
        await collapse.focus(); await page.keyboard.press('Space'); assert.equal(await collapse.getAttribute('aria-expanded'), 'false')
        assert.equal(await root.locator('progress').isVisible(), true); assert.equal(await root.locator('[data-checklist-item]').first().isVisible(), false); assert.equal(await root.locator('[data-checklist-add]').isVisible(), false)
        await page.keyboard.press('Enter'); assert.equal(await collapse.getAttribute('aria-expanded'), 'true')
        const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
        assert.equal(await overflow(), false, `documents ${width} ${lang} ${theme}`)
        await root.locator('[data-checklist-item=Paszport]').click(); await page.getByRole('dialog').waitFor(); assert.equal(await overflow(), false, 'item editor')
        if (lang === 'uk' && theme === 'slate' && [390, 1440].includes(width)) await page.screenshot({ path: path.join(screenshotDir, `editor-${width}.png`) })
        await page.getByRole('dialog').locator('button').first().click()
        await page.goto(origin + `/cases/${current.id}`)
        if (width < 769) {
          await page.locator('[data-checklist-summary-accordion] button[aria-expanded]').click()
          await page.locator('[data-checklist-summary]:visible').waitFor()
          assert.equal(await page.locator('[data-checklist-summary]:visible progress').evaluate(el => Math.round(el.getBoundingClientRect().height)), 8)
        } else {
          const details = page.locator('[data-collapsible-scope=case-details]:visible'), basic = details.locator('[data-section-key=case-basic]')
          await basic.waitFor(); assert.equal(await details.locator('[data-checklist-summary]').count(), 0)
          assert.equal(await details.evaluate(el => Array.from(el.children).find(child => child.getBoundingClientRect().height > 0)?.getAttribute('data-section-key')), 'case-basic')
          assert.ok(Math.abs((await basic.boundingBox()).y - (await details.boundingBox()).y) < 1, 'basic section starts at Details top without an empty gap')
        }
        assert.equal(await overflow(), false, `Details ${width} ${lang} ${theme}`)
        if (width < 769) await page.locator('[data-mobile-case-detail] [data-section-key=case-mos] button[aria-expanded]').click()
        else { const heading = page.locator('[data-collapse-key=case-mos] .section-title').first(); if (!await page.locator('[data-document-checklist=mos]:visible').count()) await heading.locator('button').click() }
        await page.locator('[data-document-checklist=mos]:visible').waitFor(); assert.equal(await overflow(), false, `MOS ${width} ${lang} ${theme}`)
        const mos = page.locator('[data-document-checklist=mos]:visible'), live = await get()
        for (const [group, items] of [['submitted', live.items.filter(item => item.active && item.forMos && item.status === 'SUBMITTED_TO_MOS')], ['needed', live.items.filter(item => item.active && item.forMos && item.status !== 'SUBMITTED_TO_MOS')]]) {
          assert.equal(await mos.locator(`[data-checklist-mos-group=${group}] [data-checklist-item]`).count(), items.length)
          for (const item of items) { const row = mos.locator(`[data-checklist-mos-group=${group}] [data-checklist-item]`).filter({ hasText: item.name }); assert.equal(await row.count(), 1); await metadataVisible(row, item, lang) }
        }
        const boxes = await mos.locator('[data-checklist-mos-group]').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()))
        assert.equal(width < 769 ? boxes[1].top > boxes[0].top : Math.abs(boxes[1].top - boxes[0].top) < 1, true)
        await page.goto(origin + '/settings/services'); const serviceRow = page.locator('.card').filter({ hasText: 'Document checklist service' }).first(); await serviceRow.getByRole('button', { name: lang === 'pl' ? 'Dokumenty' : lang === 'uk' ? 'Документи' : 'Документы', exact: true }).first().click()
        await page.locator('[data-service-document-template] input').first().waitFor(); assert.equal(await overflow(), false, `template ${width} ${lang} ${theme}`)
        if (lang === 'uk' && theme === 'slate' && [390, 1440].includes(width)) await page.screenshot({ path: path.join(screenshotDir, `templates-${width}.png`), fullPage: true })
        report.viewports.push({ width, lang, theme, progressHeight: width < 769 ? 8 : 10, clientDocumentsFirst: 'PASS', collapseKeyboard: 'PASS', squareControls: 'PASS', documents: 'PASS', editor: 'PASS', summary: width < 769 ? 'mobile unchanged PASS' : 'desktop removed; no gap PASS', mos: 'PASS', template: 'PASS' })
      }
      report.screenshotDir = screenshotDir
    })
    await check('Details summary breakpoint 768/769: mobile retained; desktop absent without empty gap', async () => {
      report.detailsBoundary = []
      for (const width of [768, 769]) for (const lang of ['ru', 'uk', 'pl']) for (const theme of ['light', 'dark', 'slate']) {
        await page.setViewportSize({ width, height: 1000 }); await page.goto(origin + `/cases/${current.id}`)
        await page.evaluate(({ lang, theme }) => { localStorage.setItem('rezi_lang', lang); localStorage.setItem('rezi_theme', theme); document.documentElement.dataset.theme = theme; window.dispatchEvent(new CustomEvent('langchange', { detail: lang })) }, { lang, theme })
        if (width === 768) {
          await page.locator('[data-checklist-summary-accordion] button[aria-expanded]').click()
          await page.locator('[data-checklist-summary]:visible').waitFor()
          assert.equal(await page.locator('[data-checklist-summary]:visible progress').evaluate(el => Math.round(el.getBoundingClientRect().height)), 8)
        } else {
          const details = page.locator('[data-collapsible-scope=case-details]:visible'), basic = details.locator('[data-section-key=case-basic]')
          await basic.waitFor(); assert.equal(await details.locator('[data-checklist-summary]').count(), 0)
          assert.ok(Math.abs((await basic.boundingBox()).y - (await details.boundingBox()).y) < 1)
        }
        report.detailsBoundary.push({ width, lang, theme, summary: width === 768 ? 'mobile retained PASS' : 'desktop removed; no gap PASS' })
      }
    })
    await check('desktop Details starts at basic section; mobile summary retained; Documents and MOS screenshots', async () => {
      await page.evaluate(() => { localStorage.setItem('rezi_lang', 'uk'); localStorage.setItem('rezi_theme', 'light') })
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin + `/cases/${current.id}`)
      await page.locator('[data-collapsible-scope=case-details]:visible [data-section-key=case-basic]').waitFor(); await page.screenshot({ path: path.join(detailsDir, '01-desktop-details.png'), animations: 'disabled' })
      const heading = page.locator('[data-collapse-key=case-mos] .section-title').first(); if (!await page.locator('[data-document-checklist=mos]:visible').count()) await heading.locator('button').click()
      await page.locator('[data-collapse-key=case-mos]').screenshot({ path: path.join(polishDir, '05-compact-mos.png') })
      await page.setViewportSize({ width: 390, height: 1000 }); await page.goto(origin + `/cases/${current.id}`)
      await page.locator('[data-checklist-summary-accordion] button[aria-expanded]').click(); await page.locator('[data-checklist-summary]:visible').scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(detailsDir, '02-mobile-details.png'), animations: 'disabled' })
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin + `/cases/${current.id}?tab=docs`)
      const root = docsRoot(); await root.locator('[data-checklist-item]').first().waitFor(); await root.locator('button[aria-expanded]').click()
      await root.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(polishDir, '03-documents-collapsed.png') })
      await root.locator('button[aria-expanded]').click(); await root.screenshot({ path: path.join(polishDir, '04-checklist-expanded.png') })
      report.polishScreenshotDir = polishDir; report.polishScreenshots = (await fs.readdir(polishDir)).filter(name => name.endsWith('.png')).sort()
      assert.equal(report.polishScreenshots.length, 5)
      report.detailsScreenshots = ['01-desktop-details.png', '02-mobile-details.png'].map(name => path.relative(process.cwd(), path.join(detailsDir, name)).replaceAll('\\', '/'))
    })
    await check('service-change prompt and add-document editor on all five widths; explicit Keep persists', async () => {
      for (const width of [390, 414, 430, 1024, 1440]) {
        const c = await req('get', `/api/cases/${current.id}`), nextService = c.serviceId === service.id ? secondService.id : service.id
        await req('patch', `/api/cases/${current.id}`, { expectedUpdatedAt: c.updatedAt, serviceId: nextService })
        await page.setViewportSize({ width, height: 1000 }); await page.goto(origin + `/cases/${current.id}?tab=docs`)
        const prompt = page.locator('[data-checklist-service-prompt]:visible'); await prompt.waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
        await prompt.locator('button').nth(1).click(); await prompt.waitFor({ state: 'hidden' })
        const root = page.locator('[data-document-checklist=documents]:visible'); await root.locator('[data-checklist-add]').click()
        await page.getByRole('dialog').waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
        await page.getByRole('dialog').locator('button').first().click()
        const list = await get(); assert.equal(list.templateServiceId, nextService)
      }
    })
    await check('actual UI autosave note/status and immediate close persists; date downgrade safe', async () => {
      await page.setViewportSize({ width: 390, height: 1000 }); await page.goto(origin + `/cases/${current.id}?tab=docs`)
      await page.locator('[data-document-checklist=documents]:visible [data-checklist-item=Paszport]').click()
      const dialog = page.getByRole('dialog'); await dialog.locator('textarea').fill('UI autosave note'); await dialog.locator('select').first().selectOption('RECEIVED')
      await dialog.locator('button').first().click(); await dialog.waitFor({ state: 'hidden' })
      const row = (await get()).items.find(item => item.name === 'Paszport'); assert.equal(row.note, 'UI autosave note'); assert.equal(row.status, 'RECEIVED'); assert.equal(row.mosSubmittedAt, null)
      await page.reload(); await page.locator('[data-checklist-item=Paszport]:visible').waitFor()
    })
    assert.deepEqual(report.errors, [])
  } finally {
    await fs.writeFile('docs/document-checklist-v2-qa.json', JSON.stringify(report, null, 2) + '\n')
    await browser.close()
    // Fixture data is intentionally retained in the disposable local DB for dry-run and review.
    await db.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
