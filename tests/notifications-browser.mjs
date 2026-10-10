// Opt-in integration/visual QA. Uses synthetic data and a separately running local app.
import assert from 'node:assert/strict'
import { randomBytes, createECDH } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
const url = process.env.NOTIFICATIONS_QA_ORIGIN || 'http://localhost:3117'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
const databaseUrl = process.env.NOTIFICATIONS_TEST_DATABASE_URL
assert.ok(databaseUrl && ['127.0.0.1', 'localhost'].includes(new URL(databaseUrl).hostname) && new URL(databaseUrl).pathname.includes('notifications_qa'))
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const suffix = randomBytes(6).toString('hex')
const org = await db.organization.create({ data: { name: 'Synthetic Browser QA', slug: `browser-notification-qa-${suffix}`, settings: { staffScopeFilterEnabled: true } } })
const password = 'Synthetic-local-QA-only-123!'
const makeUser = (role, restrictedAccess) => db.user.create({ data: { organizationId: org.id, email: `${role}-${suffix}@example.test`, name: `QA ${role}`, password: bcrypt.hashSync(password, 4), role, restrictedAccess } })
const owner = await makeUser('owner', false), employee = await makeUser('employee', true)
const employeeRecord = await db.employee.create({ data: { organizationId: org.id, userId: employee.id, name: 'QA employee' } })
const ownerRecord = await db.employee.create({ data: { organizationId: org.id, userId: owner.id, name: 'QA owner' } })
const client = await db.client.create({ data: { organizationId: org.id, firstName: 'Synthetic', lastName: 'Identity', assignedToId: owner.id } })
const task = await db.task.create({ data: { organizationId: org.id, assignedToId: owner.id, title: 'Browser QA assigned task' } })
const lead = await db.lead.create({ data: { organizationId: org.id, assignedToId: owner.id, employeeId: ownerRecord.id, fullName: 'Synthetic Identity' } })
const caseRecord = await db.case.create({ data: { organizationId: org.id, assignedToId: owner.id, employeeId: ownerRecord.id, clientId: client.id, caseNumber: 'QA-001' } })
const notificationIds = []
for (const [entityType, entity, type] of [['lead', lead, 'lead_assigned'], ['case', caseRecord, 'case_date'], ['task', task, 'task_overdue']]) {
  const record = await db.notification.create({ data: { organizationId: org.id, userId: owner.id, entityType, entityId: entity.id, type, title: 'Synthetic event', body: 'Synthetic authorized context', deepLink: '/dashboard', dedupeKey: `browser-${entityType}` } })
  notificationIds.push(record.id)
}
const token = async user => new SignJWT({ id: user.id, organizationId: org.id, role: user.role, name: user.name, sessionVersion: 0 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.NOTIFICATIONS_QA_JWT_SECRET || 'local-notification-browser-qa-only'))
const browser = await chromium.launch({ headless: true, channel: process.env.NOTIFICATIONS_QA_BROWSER || 'chromium' })
await mkdir('.qa/screenshots', { recursive: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await context.addCookies([{ name: 'auth-token', value: await token(owner), url }])
const page = await context.newPage()
const errors = []
page.on('pageerror', error => { const entry = { path: new URL(page.url()).pathname, message: error.message }; errors.push(entry); console.log('Runtime error', entry.path, entry.message.slice(0, 80)) })
await page.goto(url + '/settings/notifications')
await page.getByRole('table').waitFor()
const snapshots = []
for (const width of [1440, 1024, 390, 414, 430]) for (const theme of ['light', 'dark', 'slate']) for (const lang of ['ru', 'uk', 'pl']) {
  await page.setViewportSize({ width, height: 1000 })
  await page.evaluate(({ theme, lang }) => { localStorage.setItem('rezi_theme', theme); localStorage.setItem('rezi_lang', lang); document.documentElement.setAttribute('data-theme', theme); window.dispatchEvent(new CustomEvent('langchange', { detail: lang })) }, { theme, lang })
  const bell = page.locator('button[aria-haspopup="dialog"]:visible')
  await bell.waitFor()
  const contrast = await page.locator('.btn-primary').first().evaluate(element => {
    const style = getComputedStyle(element)
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
    }
    const a = luminance(style.color), b = luminance(style.backgroundColor)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })
  assert.ok(contrast >= 4.5, `Push CTA contrast ${width}/${theme}/${lang}: ${contrast}`)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Settings overflow ${width}/${theme}/${lang}`)
  await bell.click()
  const panel = page.getByRole('dialog')
  await panel.waitFor()
  const bounds = await panel.boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
  assert.equal(await panel.locator('article').count(), 3)
  await page.screenshot({ path: `.qa/screenshots/center-${width}-${theme}-${lang}.png` })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `.qa/screenshots/settings-${width}-${theme}-${lang}.png` })
  snapshots.push(`${width}/${theme}/${lang}`)
}
console.log(`Visual matrix PASS: ${snapshots.length} center + settings combinations`)
// Current APIs and real browser read-state behavior.
await page.evaluate(() => { window.dispatchEvent(new CustomEvent('langchange', { detail: 'ru' })) })
await page.locator('button[aria-haspopup="dialog"]:visible').click()
await page.getByRole('button', { name: 'Отметить прочитанным' }).first().click()
await page.waitForFunction(() => Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]')).find(element => element.getClientRects().length)?.getAttribute('aria-label')?.includes('(2)'))
await page.getByRole('button', { name: 'Прочитать все' }).click()
await page.waitForFunction(() => !Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]')).find(element => element.getClientRects().length)?.getAttribute('aria-label')?.includes('('))
await page.keyboard.press('Escape')
// Lead, case, task resolver routes all recheck access and Task opens existing editor.
for (let i = 0; i < notificationIds.length; i++) {
  await page.goto(url + '/notifications/open/' + notificationIds[i])
  assert.ok(page.url().includes(i === 0 ? '/leads/' : i === 1 ? '/cases/' : '/tasks?notificationTask='), page.url())
  if (i === 2) await page.locator('input[value="Browser QA assigned task"]').first().waitFor()
}
const ownerRequest = context.request
for (const width of [390, 414, 430]) for (const path of ['/dashboard', '/leads', `/leads/${lead.id}`, '/cases', `/cases/${caseRecord.id}`, '/clients', `/clients/${client.id}`, '/tasks']) {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto(url + path)
  const bell = page.locator('button[aria-haspopup="dialog"]:visible')
  await bell.waitFor().catch(async error => { await page.screenshot({ path: '.qa/header-failure.png' }); throw new Error(`${path}/${width}: ${error.message}`) })
  const bounds = await bell.boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${path} bell bounds`)
  assert.equal(await page.locator('nav[aria-label="Mobile navigation"] > a, nav[aria-label="Mobile navigation"] > button').count(), 5)
  if (width === 390) await page.screenshot({ path: `.qa/screenshots/header-${path.split('/')[1]}-${path.split('/')[2] ? 'detail' : 'list'}.png`, clip: { x: 0, y: 0, width, height: 180 } })
}
console.log('Mobile header placement PASS across dashboard/leads/cases/clients/tasks; bottom navigation remains 5 items')
const preferenceResponse = await ownerRequest.get(url + '/api/notifications/preferences')
const preference = (await preferenceResponse.json()).preferences
assert.equal(preference.showClientName, false)
assert.equal((await ownerRequest.put(url + '/api/notifications/preferences', { data: { ...preference, scope: 'team', showClientName: true } })).status(), 200)
const created = await ownerRequest.post(url + '/api/tasks', { data: { title: 'New HTTP task', assignedToId: employee.id } })
assert.equal(created.status(), 200)
const createdTask = await created.json()
assert.equal(await db.notification.count({ where: { entityId: createdTask.id } }), 2)
await ownerRequest.patch(url + '/api/tasks/' + createdTask.id, { data: { title: 'Ordinary edit', expectedUpdatedAt: createdTask.updatedAt } })
assert.equal(await db.notification.count({ where: { entityId: createdTask.id } }), 2)
const createdLead = await ownerRequest.post(url + '/api/leads', { data: { fullName: 'Synthetic HTTP lead', employeeId: employeeRecord.id } })
assert.equal(createdLead.status(), 200)
const httpLead = await createdLead.json()
assert.equal(await db.notification.count({ where: { entityId: httpLead.id } }), 2)
const unassigned = await db.lead.create({ data: { organizationId: org.id, fullName: 'Synthetic bulk lead' } })
const bulkPayload = { action: 'assign_employee', selection: { mode: 'ids', ids: [unassigned.id] }, employeeId: employeeRecord.id, staffScope: 'all' }
assert.equal((await ownerRequest.post(url + '/api/leads/bulk', { data: bulkPayload })).status(), 200)
assert.equal((await ownerRequest.post(url + '/api/leads/bulk', { data: bulkPayload })).status(), 200)
assert.equal(await db.notification.count({ where: { entityId: unassigned.id } }), 2)
const webhookKey = 'synthetic-webhook-test-key-12345'
await db.organization.update({ where: { id: org.id }, data: { settings: { leadWebhookEnabled: true, leadWebhookKey: webhookKey } } })
const route = await db.leadChannelRoute.create({ data: { organizationId: org.id, sourceKey: 'website', employeeId: employeeRecord.id } })
await db.leadChannelRouteMember.createMany({ data: [{ routeId: route.id, organizationId: org.id, employeeId: employeeRecord.id, position: 0 }, { routeId: route.id, organizationId: org.id, employeeId: ownerRecord.id, position: 1 }], skipDuplicates: true })
const webhookPayload = { fullName: 'Synthetic webhook identity', email: `webhook-${suffix}@example.test`, source: 'website' }
const webhook = await ownerRequest.post(url + `/api/webhooks/leads/${org.slug}`, { headers: { 'x-reziflow-key': webhookKey }, data: webhookPayload })
assert.equal(webhook.status(), 201)
const webhookLead = await webhook.json()
assert.equal(webhookLead.lead.assignedToId, employee.id)
const duplicateWebhook = await ownerRequest.post(url + `/api/webhooks/leads/${org.slug}`, { headers: { 'x-reziflow-key': webhookKey }, data: webhookPayload })
assert.equal((await duplicateWebhook.json()).leadId, webhookLead.leadId)
assert.equal(await db.notification.count({ where: { entityId: webhookLead.leadId } }), 2)
const externalWebhook = await ownerRequest.post(url + `/api/webhooks/leads/${org.slug}`, { headers: { 'x-reziflow-key': webhookKey }, data: { fullName: 'Synthetic explicit assignment', email: `explicit-${suffix}@example.test`, assignedToId: owner.id, source: 'website' } })
assert.equal(externalWebhook.status(), 201)
assert.equal((await externalWebhook.json()).lead.assignedToId, owner.id)
// Two subscriptions exercise real authenticated routes, using synthetic provider keys.
const ecdh = createECDH('prime256v1'); ecdh.generateKeys()
const subscription = device => ({ endpoint: `https://fcm.googleapis.com/fcm/send/browser-${suffix}-${device}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } })
const first = subscription(1), second = subscription(2)
assert.equal((await ownerRequest.post(url + '/api/notifications/subscriptions', { data: first })).status(), 200)
assert.equal((await ownerRequest.post(url + '/api/notifications/subscriptions', { data: second })).status(), 200)
assert.equal(await db.pushSubscription.count({ where: { userId: owner.id, disabledAt: null } }), 2)
const employeeContext = await browser.newContext()
await employeeContext.addCookies([{ name: 'auth-token', value: await token(employee), url }])
const employeePrefs = (await (await employeeContext.request.get(url + '/api/notifications/preferences')).json()).preferences
assert.equal((await employeeContext.request.put(url + '/api/notifications/preferences', { data: { ...employeePrefs, scope: 'team' } })).status(), 403)
assert.equal((await employeeContext.request.post(url + '/api/notifications/subscriptions', { data: first })).status(), 409)
const foreignLink = await employeeContext.request.get(url + '/notifications/open/' + notificationIds[0], { maxRedirects: 0 })
assert.equal(foreignLink.headers().location, '/dashboard')
assert.equal((await ownerRequest.delete(url + '/api/notifications/subscriptions', { data: first })).status(), 200)
assert.equal(await db.pushSubscription.count({ where: { userId: owner.id } }), 1)
// Expired devices cannot be reactivated past the active-device limit.
for (let device = 3; device <= 12; device++) assert.equal((await ownerRequest.post(url + '/api/notifications/subscriptions', { data: subscription(device) })).status(), device <= 11 ? 200 : 409)
const disabledDevice = subscription(13)
const { createHash } = await import('node:crypto')
await db.pushSubscription.create({ data: { organizationId: org.id, userId: owner.id, endpointHash: createHash('sha256').update(disabledDevice.endpoint).digest('hex'), encryptedSubscription: '', deviceLabel: 'Synthetic expired device', disabledAt: new Date() } })
assert.equal((await ownerRequest.post(url + '/api/notifications/subscriptions', { data: disabledDevice })).status(), 409)
await db.pushSubscription.deleteMany({ where: { userId: owner.id } })
assert.equal((await ownerRequest.post(url + '/api/notifications', { headers: { Origin: 'https://evil.example.test' }, data: { all: true } })).status(), 403)
assert.equal((await ownerRequest.get(url + '/api/internal/notifications')).status(), 401)
const anonymous = await browser.newContext()
const anonymousPage = await anonymous.newPage()
await anonymousPage.goto(url + '/notifications/open/' + notificationIds[0])
assert.ok(anonymousPage.url().includes('/login?next='))
await anonymousPage.locator('input[type=email]').fill(owner.email)
await anonymousPage.locator('input[type=password]').fill(password)
await anonymousPage.locator('button[type=submit]').click()
await anonymousPage.waitForURL('**/leads/' + lead.id)
// Worker registers and controls the origin; permission has never been requested on load.
await page.goto(url + '/settings/notifications')
const permission = await page.evaluate(() => Notification.permission)
assert.equal(permission, 'default')
const worker = await page.evaluate(async () => { const registration = await navigator.serviceWorker.register('/notification-sw.js', { scope: '/' }); await navigator.serviceWorker.ready; return registration.active?.scriptURL })
assert.ok(worker.includes('/notification-sw.js'))
await context.grantPermissions(['notifications'])
await page.reload(); await page.getByRole('table').waitFor()
assert.ok((await page.textContent('body')).includes('Разрешено'))
await context.clearPermissions()
const cdp = await context.newCDPSession(page)
const { targetInfo } = await cdp.send('Target.getTargetInfo')
await cdp.send('Browser.setPermission', { permission: { name: 'notifications' }, setting: 'denied', origin: url, browserContextId: targetInfo.browserContextId })
await page.reload(); await page.getByRole('table').waitFor()
assert.equal(await page.evaluate(() => Notification.permission), 'denied')
assert.ok((await page.textContent('body')).includes('Разрешите уведомления в настройках'))
assert.equal(await page.getByRole('button', { name: 'Включить уведомления', exact: true }).isDisabled(), true)
await cdp.send('Browser.resetPermissions', { browserContextId: targetInfo.browserContextId })
const employeePage = await employeeContext.newPage()
await employeePage.goto(url + '/settings/notifications')
await employeePage.getByRole('table').waitFor()
assert.equal(await employeePage.locator('input[type=radio]').count(), 0)
console.log('HTTP/UI functional QA PASS: read/count, Lead/Case/Task links, auth return, preferences, Employee isolation, manual/bulk/channel/round-robin/external assignment, webhook dedupe, 2 synthetic devices, unsubscribe, SW, permission granted/denied')
assert.deepEqual(errors, [], 'No runtime JS errors')
await writeFile('.qa/browser-results.json', JSON.stringify({ snapshots, runtimeErrors: errors, functional: 'PASS', physicalPush: 'NOT TESTED' }, null, 2))
await browser.close(); await db.$disconnect()
