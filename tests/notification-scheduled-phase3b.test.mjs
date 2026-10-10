import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID, randomBytes, createECDH } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server.js'
import { evaluateNotificationPage, parseEvaluationCursor } from '../src/lib/notificationJobs.ts'
import { reminderTimestamp, caseOccurrences, taskOccurrences, leadContactOccurrence, notificationPreferences } from '../src/lib/notificationPolicy.ts'
import { authorizedNotification, notificationUser, markNotificationsRead, unreadNotificationCount } from '../src/lib/notifications.ts'
import { deliverNotificationPush, pushPayload } from '../src/lib/notificationPush.ts'
import { encryptSubscription, endpointHash, subscriptionAAD } from '../src/lib/pushSecurity.ts'
import { runNotificationJob } from '../scripts/run-notification-job.mjs'
import { parseWarsawDateTime, warsawDateTimeLocal } from '../src/lib/warsawDateTime.ts'
import { normalizeLeadBody } from '../src/lib/leads.ts'

const now = new Date('2026-10-10T10:00:00Z')
test('Warsaw DST fold/gap and calendar deadlines remain stable across host timezones', () => {
  assert.equal(new Date(reminderTimestamp('2026-03-29T02:30')).toISOString(), '2026-03-29T01:30:00.000Z')
  assert.equal(new Date(reminderTimestamp('2026-10-25T02:30')).toISOString(), '2026-10-25T00:30:00.000Z')
  assert.equal(reminderTimestamp('2026-10-25T02:30:00+01:00'), Date.parse('2026-10-25T01:30Z'))
  assert.equal(new Date(reminderTimestamp('2026-10-10T13:00:00.123')).toISOString(), '2026-10-10T11:00:00.123Z')
  for (const timezone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
    const saved = process.env.TZ; process.env.TZ = timezone
    try {
      assert.equal(taskOccurrences({ status: 'todo', dueDate: '2026-10-11' }, now)[0].type, 'task_due')
      assert.equal(taskOccurrences({ status: 'todo', dueDate: '2026-10-09' }, now)[0].type, 'task_overdue')
      assert.equal(taskOccurrences({ status: 'todo', dueDate: '2026-10-11', description: JSON.stringify({ reminderAt: '2026-10-10T13:00' }) }, now).length, 0)
      for (const [wall, instant] of [['2026-12-10T09:00', '2026-12-10T08:00:00.000Z'], ['2026-07-10T09:00', '2026-07-10T07:00:00.000Z']]) {
        assert.equal(normalizeLeadBody({ nextContactAt: wall, lastContactAt: wall }).nextContactAt.toISOString(), instant)
        assert.equal(warsawDateTimeLocal(instant), wall)
        assert.equal(parseWarsawDateTime(warsawDateTimeLocal(instant)).toISOString(), instant)
        assert.equal(normalizeLeadBody({ nextContactAt: instant }).nextContactAt.toISOString(), instant)
      }
    } finally { if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved }
  }
})
test('scheduled policy excludes terminal/retired/disabled/historical and semantic duplicates', () => {
  for (const status of ['done', ' COMPLETED ', 'cancelled', 'inactive']) assert.deepEqual(taskOccurrences({ status, dueDate: '2026-10-09' }, now), [])
  for (const key of ['leadReminder', 'caseImportantDate', 'fingerprintsAppointment', 'predictedDecision']) assert.deepEqual(taskOccurrences({ status: 'todo', dueDate: '2026-10-11', description: JSON.stringify({ [key]: { id: 'synthetic' } }) }, now), [])
  for (const status of ['Архив', 'Closed', 'Відмова', 'Zamknięty']) assert.deepEqual(caseOccurrences({ status, cardPickupDate: '2026-10-11' }, now), [])
  assert.deepEqual(caseOccurrences({ filingDate: '2026-10-11', mosSentAt: '2026-10-11', fingerprintsDate: '2026-10-09', customDates: [{ id: 1, date: null }] }, now), [])
  assert.deepEqual(caseOccurrences({ personalAppearDate: '2026-10-10', statusHistory: [{ fromStatus: 'Новый', changedAt: now }] }, now), [])
  const events = caseOccurrences({ cardPickupDate: '2026-10-11', customDates: [{ id: 3, label: 'Получение карты', date: '2026-10-11' }, { id: 4, label: 'Synthetic appointment', date: '2026-10-11' }, { id: 5, label: 'Synthetic appointment', date: '2026-10-11' }, { id: 6, label: 'Distinct appointment', date: '2026-10-11' }] }, now)
  assert.equal(events.length, 3)
  for (const status of ['не подходит', 'Клиент', 'Closed', 'Архів', 'lost', 'cancelled']) assert.equal(leadContactOccurrence({ status, nextContactAt: now }, now), null)
  assert.equal(leadContactOccurrence({ nextContactAt: 'invalid' }, now), null)
  assert.equal(leadContactOccurrence({ nextContactAt: now, lastContactAt: now }, now), null)
})

const require = createRequire(import.meta.url)
function loadRoute(overrides, entry = 'src/app/api/internal/notifications/route', method = 'GET') {
  const cache = new Map()
  const load = file => {
    const normalized = file.replaceAll('\\', '/').replace(/\.(ts|js)$/, '')
    if (overrides[normalized]) return overrides[normalized]
    if (cache.has(normalized)) return cache.get(normalized)
    const filename = normalized + '.ts', exports = {}; cache.set(normalized, exports)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
    new Function('require', 'exports', code)(id => id.startsWith('@/') ? load('src/' + id.slice(2)) : id.startsWith('.') ? load(path.join(path.dirname(filename), id)) : require(id), exports)
    return exports
  }
  return load(entry)[method]
}
test('actual internal endpoint rejects unauthenticated and invalid cursors; transient failure is safely retryable', async () => {
  const previous = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-secret-never-production-123456789'
  let evaluations = 0, pushes = 0, failure = false
  const get = loadRoute({ 'src/lib/notificationJobs': { parseEvaluationCursor, evaluateNotificationPage: async () => { evaluations++; if (failure) throw new Error('PRIVATE_ERROR'); return { evaluated: 1, nextCursor: null } } }, 'src/lib/notificationPush': { deliverNotificationPush: async () => { pushes++; return { processed: 0, delivered: 0 } } } })
  const send = (query = '', auth = `Bearer ${process.env.CRON_SECRET}`) => get(new NextRequest(`http://localhost/api/internal/notifications${query}`, { headers: auth ? { authorization: auth } : {} }))
  try {
    for (const auth of ['', 'Bearer wrong', `Bearer ${process.env.CRON_SECRET}x`]) assert.equal((await send('', auth)).status, 401)
    assert.equal(evaluations, 0); assert.equal(pushes, 0)
    assert.equal((await send('?cursor=task:https://foreign.test')).status, 400)
    assert.equal((await send('?cursor=case:')).status, 200)
    failure = true
    const response = await send(); assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '15'); assert.ok(!(await response.text()).includes('PRIVATE_ERROR'))
    assert.equal(pushes, 1)
  } finally { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous }
})
test('bounded runner resumes persisted cursor, retries exact page and drains delivery separately', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'notification-job-'))
  const checkpoint = path.join(directory, 'checkpoint.json'), calls = []
  let failed = false
  const fetchPage = async url => {
    calls.push(url.search)
    if (url.searchParams.get('cursor') === 'case:' && !failed) { failed = true; return new Response('', { status: 503 }) }
    const result = !url.search ? { evaluated: 25, notificationsCreated: 2, nextCursor: 'case:', push: { processed: 0, delivered: 0 } }
      : url.searchParams.get('cursor') === 'case:' ? { evaluated: 1, nextCursor: null, push: { processed: 20, delivered: 20 } }
      : { evaluated: 0, nextCursor: null, push: { processed: 0, delivered: 0 } }
    return Response.json(result)
  }
  const config = { origin: 'http://localhost', secret: 'synthetic-secret-12345678901234567890', checkpoint, fetchPage, pause: async () => {} }
  try {
    const first = await runNotificationJob({ ...config, maxPages: 1 }); assert.equal(first.complete, false)
    const second = await runNotificationJob(config); assert.equal(second.complete, true)
    assert.deepEqual(calls, ['', '?cursor=case%3A', '?cursor=case%3A', '?delivery=only'])
    await assert.rejects(runNotificationJob({ ...config, origin: 'http://foreign.test' }), /HTTPS/)
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('notification-job-'))
    await rm(directory, { recursive: true, force: true })
  }
})

const databaseUrl = process.env.NOTIFICATIONS_TEST_DATABASE_URL
test('Phase 3B real PostgreSQL: dates, access, atomic outbox, pool=1, failures and performance', { skip: !databaseUrl }, async t => {
  const target = new URL(databaseUrl)
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname.includes('notifications_qa'))
  target.searchParams.set('connection_limit', '1'); target.searchParams.set('pool_timeout', '30')
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [{ emit: 'event', level: 'query' }] })
  let queryCount = 0; db.$on('query', () => queryCount++)
  const prefix = randomUUID(), orgIds = [], saved = { ...process.env }
  const org = await db.organization.create({ data: { name: 'Synthetic Phase3B', slug: `scheduled-${prefix}` } }); orgIds.push(org.id)
  const other = await db.organization.create({ data: { name: 'Synthetic excluded tenant', slug: `excluded-${prefix}` } }); orgIds.push(other.id)
  const user = (organizationId, role = 'employee') => db.user.create({ data: { organizationId, role, email: `${randomUUID()}@example.test`, name: 'Synthetic user', password: 'not-a-login-hash', restrictedAccess: false } })
  const own = await user(org.id), next = await user(org.id), owner = await user(org.id, 'owner'), mine = await user(org.id, 'admin'), stranger = await user(other.id)
  const staff = await db.employee.create({ data: { organizationId: org.id, userId: own.id, name: 'Synthetic responsible' } })
  const nextStaff = await db.employee.create({ data: { organizationId: org.id, userId: next.id, name: 'Synthetic next' } })
  const client = await db.client.create({ data: { organizationId: org.id, firstName: 'Synthetic', lastName: 'Client' } })
  for (const u of [own, next, owner, mine]) await db.notificationPreference.create({ data: { organizationId: org.id, userId: u.id, scope: u.id === owner.id || u.id === next.id ? 'team' : 'mine', pushEnabled: true } })
  Object.assign(process.env, { NOTIFICATIONS_ENABLED: 'true', NOTIFICATION_EVENTS_ENABLED: 'true', NOTIFICATION_SCHEDULED_EVENTS_ENABLED: 'true', NOTIFICATION_EVENTS_PILOT_ORG_IDS: org.id, NOTIFICATION_EVENTS_PILOT_USER_IDS: [own.id, next.id, owner.id, mine.id, stranger.id].join(','), WEB_PUSH_ENABLED: 'true', PUSH_ENVIRONMENT: process.env.VERCEL_ENV || 'development', PUSH_TEST_USER_ID: String(own.id) })
  delete process.env.WEB_PUSH_PILOT_USER_IDS
  const pair = createECDH('prime256v1'); pair.generateKeys()
  Object.assign(process.env, { VAPID_PUBLIC_KEY: pair.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY: pair.getPrivateKey().toString('base64url'), VAPID_SUBJECT: 'mailto:qa@example.test', PUSH_SUBSCRIPTION_ENCRYPTION_KEY: randomBytes(32).toString('hex') })
  const raw = { endpoint: `https://fcm.googleapis.com/fcm/send/synthetic-${prefix}`, keys: { p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64url'), auth: randomBytes(16).toString('base64url') } }
  const identity = { organizationId: org.id, userId: own.id, endpointHash: endpointHash(raw.endpoint) }
  await db.pushSubscription.create({ data: { ...identity, encryptedSubscription: encryptSubscription(raw, subscriptionAAD(identity)), deviceLabel: 'Synthetic local only', createdAt: new Date(0) } })
  t.after(async () => {
    await db.notification.deleteMany({ where: { organizationId: { in: orgIds } } })
    for (const model of ['pushSubscription', 'task', 'lead', 'case', 'client', 'employee', 'user']) await db[model].deleteMany({ where: { organizationId: { in: orgIds } } })
    await db.organization.deleteMany({ where: { id: { in: orgIds } } }); await db.$disconnect()
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  })
  const clear = async () => { await db.notification.deleteMany({ where: { organizationId: org.id } }); for (const kind of ['task', 'case', 'lead']) await db[kind].deleteMany({ where: { organizationId: org.id } }) }
  const task = (extra = {}) => db.task.create({ data: { organizationId: org.id, assignedToId: own.id, title: 'PRIVATE_SYNTHETIC_TITLE', dueDate: new Date('2026-10-11'), ...extra } })
  const lead = (extra = {}) => db.lead.create({ data: { organizationId: org.id, assignedToId: own.id, employeeId: staff.id, fullName: 'PRIVATE_SYNTHETIC_NAME', nextContactAt: new Date('2026-10-10T09:00Z'), ...extra } })
  const caseRecord = (extra = {}) => db.case.create({ data: { organizationId: org.id, assignedToId: own.id, employeeId: staff.id, clientId: client.id, cardPickupDate: new Date('2026-10-17'), ...extra } })
  const page = (kind, database = db, time = now) => evaluateNotificationPage({ kind, after: '' }, time, database)
  const count = (entityId, extra = {}) => db.notification.count({ where: { entityId, ...extra } })
  await t.test('Task due/overdue/completed/default/exact reminder, rescheduling, channel preferences and own/team copies', async () => {
    const due = await task(), overdue = await task({ dueDate: new Date('2026-10-09') }), done = await task({ status: 'done' }), precise = await task({ description: JSON.stringify({ reminderAt: '2026-10-10T13:00' }) })
    await page('task'); await page('task')
    assert.equal(await count(due.id), 2); assert.equal(await count(overdue.id), 2); assert.equal(await count(done.id), 0); assert.equal(await count(precise.id), 0)
    assert.equal(await count(due.id, { userId: next.id }), 0); assert.equal(await count(due.id, { userId: mine.id }), 0)
    await db.task.update({ where: { id: overdue.id }, data: { dueDate: new Date('2026-10-08') } }); await page('task')
    assert.equal(await count(overdue.id, { type: 'task_overdue' }), 4)
    await db.task.update({ where: { id: overdue.id }, data: { dueDate: new Date('2026-10-20') } }); await page('task'); assert.equal(await count(overdue.id), 4)
    await db.task.update({ where: { id: overdue.id }, data: { dueDate: new Date('2026-10-09') } }); await page('task'); assert.equal(await count(overdue.id), 4)
    await page('task', db, new Date('2026-10-10T11:01Z')); assert.equal(await count(precise.id), 2)
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: own.id, organizationId: org.id } }, data: { events: { task_due: { inApp: false, push: true } } } })
    const pushOnly = await task(); await page('task')
    const row = await db.notification.findFirst({ where: { entityId: pushOnly.id, userId: own.id } }); assert.equal(row.inApp, false); assert.equal(row.pushRequested, true)
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: own.id, organizationId: org.id } }, data: { events: { task_due: { inApp: true, push: false } } } })
    const inAppOnly = await task(); await page('task'); assert.equal(await db.notificationPushDelivery.count({ where: { notification: { entityId: inAppOnly.id } } }), 0)
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: own.id, organizationId: org.id } }, data: { events: { task_due: { inApp: false, push: false } } } })
    const off = await task(); await page('task'); assert.equal(await count(off.id, { userId: own.id }), 0)
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: own.id, organizationId: org.id } }, data: { events: {} } })
  })
  await t.test('Case +7/+1, custom dates, duplicated labels and generated Tasks, retired/closed/historical/rescheduled', async () => {
    await clear()
    const record = await caseRecord({ customDates: { create: [{ label: 'Получение карты', date: new Date('2026-10-17') }, { label: 'Synthetic appointment', date: new Date('2026-10-17') }, { label: 'Synthetic appointment', date: new Date('2026-10-17') }, { label: 'Disabled', date: null }] } })
    const historic = await caseRecord({ cardPickupDate: null, filingDate: new Date('2026-10-17'), fingerprintsDate: new Date('2026-10-09') }), closed = await caseRecord({ status: 'Архив' })
    await task({ description: JSON.stringify({ caseImportantDate: { caseId: record.id, kind: 'cardPickupDate' }, reminderAt: '2026-10-10T09:00' }) })
    await page('case'); await page('case'); await page('task')
    assert.equal(await count(record.id), 4); assert.equal(await count(historic.id), 0); assert.equal(await count(closed.id), 0)
    await page('case', db, new Date('2026-10-16T10:00Z')); await page('case', db, new Date('2026-10-16T10:00Z')); assert.equal(await count(record.id), 8)
    await db.case.update({ where: { id: record.id }, data: { cardPickupDate: new Date('2026-10-18') } }); await page('case', db, new Date('2026-10-17T10:00Z')); assert.equal(await count(record.id), 12) // new standard date + formerly duplicated custom date
    const retired = await caseRecord({ cardPickupDate: null, personalAppearDate: new Date('2026-10-10') })
    await db.statusHistory.create({ data: { caseId: retired.id, fromStatus: 'Новый', toStatus: 'В работе', changedBy: 'Synthetic QA', changedAt: now } }); await page('case'); assert.equal(await count(retired.id), 0)
  })
  await t.test('Lead reached/contacted/converted/closed/reassigned/unlinked/changed occurrence and tenant isolation', async () => {
    await clear()
    const reached = await lead(), contacted = await lead({ lastContactAt: now }), converted = await lead({ convertedAt: now }), closed = await lead({ status: 'Closed' }), missing = await lead({ employeeId: null, assignedToId: null }), unlinked = await lead({ employeeId: nextStaff.id })
    await db.lead.create({ data: { organizationId: other.id, assignedToId: stranger.id, fullName: 'Synthetic foreign', nextContactAt: new Date('2026-10-10T09:00Z') } })
    await page('lead'); await page('lead'); assert.equal(await count(reached.id), 2)
    for (const row of [contacted, converted, closed, missing, unlinked]) assert.equal(await count(row.id), 0)
    assert.equal(await db.notification.count({ where: { organizationId: other.id } }), 0)
    await db.lead.update({ where: { id: reached.id }, data: { assignedToId: next.id, employeeId: nextStaff.id } }); await page('lead')
    assert.equal(await count(reached.id), 3); assert.equal(await count(reached.id, { userId: next.id }), 1)
    const old = await db.notification.findFirst({ where: { entityId: reached.id, userId: own.id } }); assert.equal(await authorizedNotification(await notificationUser(own.id, org.id, db), old.id, db), null)
    await db.lead.update({ where: { id: reached.id }, data: { nextContactAt: new Date('2026-10-10T09:30Z') } }); await page('lead'); assert.equal(await count(reached.id), 5)
    const pending = await lead(); await page('lead'); await db.employee.update({ where: { id: staff.id }, data: { userId: null } })
    const note = await db.notification.findFirst({ where: { entityId: pending.id, userId: own.id } }); assert.equal(await authorizedNotification(await notificationUser(own.id, org.id, db), note.id, db), null)
    const suppressed = await lead(); await page('lead'); assert.equal(await count(suppressed.id), 0)
    await db.employee.update({ where: { id: staff.id }, data: { userId: own.id } })
  })
  await t.test('actual contact API and Lead autosave preserve Warsaw/ISO dates without timezone drift', async () => {
    await clear(); const record = await lead()
    const post = loadRoute({ 'src/lib/prisma': { prisma: db }, 'src/lib/auth': { getUser: async () => own, getOrganizationId: u => u.organizationId } }, 'src/app/api/leads/[id]/contacts/route', 'POST')
    const send = body => post(new NextRequest('http://localhost/api/leads/synthetic/contacts', { method: 'POST', body: JSON.stringify({ note: 'Synthetic contact', ...body }), headers: { 'Content-Type': 'application/json' } }), { params: { id: record.id } })
    let response = await send({ contactAt: '2026-03-28T12:00', nextContactAt: '2026-03-29T02:30' }); assert.equal(response.status, 200)
    let updated = await db.lead.findUnique({ where: { id: record.id } }); assert.equal(updated.nextContactAt.toISOString(), '2026-03-29T01:30:00.000Z'); assert.equal(updated.lastContactAt.toISOString(), '2026-03-28T11:00:00.000Z')
    assert.equal(leadContactOccurrence(updated, new Date('2026-03-29T01:29Z')), null); assert.ok(leadContactOccurrence(updated, new Date('2026-03-29T01:30Z')))
    response = await send({ contactAt: '2026-10-24T10:00:00Z', nextContactAt: '2026-10-25T02:30:00+01:00' }); assert.equal(response.status, 200)
    updated = await db.lead.findUnique({ where: { id: record.id } }); assert.equal(updated.nextContactAt.toISOString(), '2026-10-25T01:30:00.000Z')
    assert.equal((await send({ contactAt: 'invalid' })).status, 400)
    const patch = loadRoute({ 'src/lib/prisma': { prisma: db }, 'src/lib/auth': { getUser: async () => own, getOrganizationId: u => u.organizationId }, 'src/lib/assignmentDelivery': { dispatchAssignmentPush: async () => {} } }, 'src/app/api/leads/[id]/route', 'PATCH')
    const responseToEdit = await patch(new NextRequest('http://localhost/api/leads/synthetic', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-LegalHub-Entity-Write': 'versioned' }, body: JSON.stringify({ notes: 'Synthetic ordinary autosave', expectedUpdatedAt: updated.updatedAt.toISOString() }) }), { params: { id: record.id } })
    assert.equal(responseToEdit.status, 200)
    const saved = await db.lead.findUnique({ where: { id: record.id } }); assert.equal(saved.nextContactAt.toISOString(), updated.nextContactAt.toISOString()); assert.equal(saved.lastContactAt.toISOString(), updated.lastContactAt.toISOString())
  })
  await t.test('four concurrent schedulers across two clients, each pool=1, create one copy/outbox per recipient', async () => {
    await clear(); const record = await task()
    const secondClient = new PrismaClient({ datasources: { db: { url: target.href } } })
    try { await Promise.all([page('task'), page('task', secondClient), page('task'), page('task', secondClient)]) } finally { await secondClient.$disconnect() }
    assert.equal(await count(record.id), 2); assert.equal(await db.notificationPushDelivery.count({ where: { notification: { entityId: record.id } } }), 1)
    const result = await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = current_setting(\'application_name\') AND pid = pg_backend_pid()'); assert.equal(result[0].count, 1)
  })
  await t.test('real per-query PostgreSQL latency uses transaction client only and stays under transaction timeout', async () => {
    await clear(); const record = await task(); let inside = false
    const wrap = tx => new Proxy(tx, { get(target, key) {
      const value = target[key]
      if (typeof value === 'function') return value.bind(target)
      if (value && typeof value === 'object') return new Proxy(value, { get(model, method) { if (typeof model[method] !== 'function') return model[method]; return async (...args) => { await tx.$queryRawUnsafe('SELECT 1::int FROM pg_sleep(0.04)'); return model[method](...args) } } })
      return value
    } })
    const guarded = new Proxy(db, { get(target, key) {
      if (key === '$transaction') return (callback, options) => target.$transaction(async tx => { inside = true; try { return await callback(wrap(tx)) } finally { inside = false } }, options)
      assert.equal(inside, false, 'A global Prisma operation occurred inside a transaction')
      return typeof target[key] === 'function' ? target[key].bind(target) : target[key]
    } })
    const start = Date.now(); await page('task', guarded); assert.equal(await count(record.id), 2)
    const duration = Date.now() - start; assert.ok(duration >= 120 && duration < 10000); console.log(JSON.stringify({ latencyQaMs: duration, connectionLimit: 1 }))
  })
  await t.test('Owner/Admin mine receives own events; team event OFF/master push OFF and foreign responsible deny access', async () => {
    await clear()
    const mineTask = await task({ assignedToId: mine.id }), foreignResponsible = await task({ assignedToId: stranger.id })
    await page('task'); assert.equal(await count(mineTask.id, { userId: mine.id }), 1); assert.equal(await count(foreignResponsible.id), 0)
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: owner.id, organizationId: org.id } }, data: { events: { task_due: { inApp: false, push: false } } } })
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: own.id, organizationId: org.id } }, data: { pushEnabled: false } })
    const record = await task(); await page('task'); assert.equal(await count(record.id), 1); assert.equal(await db.notificationPushDelivery.count({ where: { notification: { entityId: record.id } } }), 0)
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: owner.id, organizationId: org.id } }, data: { events: {} } })
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: own.id, organizationId: org.id } }, data: { pushEnabled: true } })
  })
  await t.test('DB SQLSTATE 40001 after writes rolls back notification AND outbox, retry fills missing once', async () => {
    await clear(); const record = await task(); let fail = true
    const failing = new Proxy(db, { get(target, key) {
      if (key === '$transaction') return (callback, options) => target.$transaction(async tx => { const result = await callback(tx); if (fail) { fail = false; await tx.$executeRawUnsafe("DO $$ BEGIN RAISE EXCEPTION 'synthetic transient' USING ERRCODE = '40001'; END $$") } return result }, options)
      return typeof target[key] === 'function' ? target[key].bind(target) : target[key]
    } })
    await assert.rejects(page('task', failing)); assert.equal(await count(record.id), 0); assert.equal(await db.notificationPushDelivery.count({ where: { organizationId: org.id } }), 0)
    await page('task', failing); await page('task', failing); assert.equal(await count(record.id), 2); assert.equal(await db.notificationPushDelivery.count({ where: { organizationId: org.id } }), 1)
  })
  await t.test('interrupt after two committed entities resumes same batch without repeating copies', async () => {
    await clear(); const records = await Promise.all(Array.from({ length: 5 }, () => task())); let calls = 0
    const interrupted = new Proxy(db, { get(target, key) {
      if (key === '$transaction') return (callback, options) => { if (++calls === 3) throw new Error('Synthetic interruption'); return target.$transaction(callback, options) }
      return typeof target[key] === 'function' ? target[key].bind(target) : target[key]
    } })
    await assert.rejects(page('task', interrupted)); assert.equal(await db.notification.count({ where: { organizationId: org.id } }), 4)
    await page('task'); await page('task'); for (const row of records) assert.equal(await count(row.id), 2)
    assert.equal(await db.notificationPushDelivery.count({ where: { organizationId: org.id } }), 5)
  })
  await t.test('scheduled transport provider failure/retry, privacy OFF, safe resolver, read/badge and revoked role/access/deleted entity', async () => {
    await clear(); const record = await task(), contact = await lead(), date = await caseRecord(); await page('task'); await page('lead'); await page('case')
    let payloads = []
    await deliverNotificationPush(db, async (_sub, body) => { payloads.push(JSON.parse(body)); throw Object.assign(new Error('Synthetic provider transient'), { statusCode: 503 }) })
    assert.equal(payloads.length, 3)
    for (const payload of payloads) { assert.ok(!JSON.stringify(payload).includes('PRIVATE_SYNTHETIC')); assert.match(payload.url, /^\/notifications\/open\/[a-zA-Z0-9_-]+$/) }
    await db.notificationPushDelivery.updateMany({ where: { organizationId: org.id }, data: { nextAttemptAt: new Date(0) } }); payloads = []
    await deliverNotificationPush(db, async (_sub, body) => payloads.push(JSON.parse(body))); await deliverNotificationPush(db, async (_sub, body) => payloads.push(JSON.parse(body))); assert.equal(payloads.length, 3)
    const account = await notificationUser(own.id, org.id, db); const before = await unreadNotificationCount(account, db)
    const note = await db.notification.findFirst({ where: { entityId: record.id, userId: own.id } }); await markNotificationsRead(account, note.id, db); assert.equal(await unreadNotificationCount(account, db), before - 1)
    const teamNote = await db.notification.findFirst({ where: { entityId: record.id, userId: owner.id } }); await db.user.update({ where: { id: owner.id }, data: { role: 'employee', restrictedAccess: false } }); assert.equal(await authorizedNotification(await notificationUser(owner.id, org.id, db), teamNote.id, db), null)
    await db.user.update({ where: { id: owner.id }, data: { role: 'owner' } }); await db.task.delete({ where: { id: record.id } }); assert.equal(await authorizedNotification(account, note.id, db), null)
    await db.lead.update({ where: { id: contact.id }, data: { nextContactAt: new Date('2026-10-20T09:00Z') } })
    const nextContactNote = await db.notification.findFirst({ where: { entityId: contact.id, userId: own.id } })
    const data = pushPayload(nextContactNote, notificationPreferences({ pushEnabled: true }), 'PRIVATE_SYNTHETIC', 1); assert.ok(!data.body.includes('PRIVATE_SYNTHETIC'))
  })
  await t.test('blank/invalid allowlist and disabled scheduled gate deny all without a DB read', async () => {
    const failDb = new Proxy({}, { get() { throw new Error('DB must not be touched') } })
    for (const value of ['', 'valid,https://foreign.test']) { process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = value; assert.equal((await page('task', failDb)).evaluated, 0) }
    process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = org.id; process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED = 'false'; assert.equal((await page('task', failDb)).evaluated, 0); process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED = 'true'
  })
  await t.test('synthetic realistic dataset: bounded keyset pages, 2 pilot tenants, 1 excluded tenant', async () => {
    const allowed = [], recipients = []
    for (let tenant = 0; tenant < 2; tenant++) {
      const organization = await db.organization.create({ data: { name: 'Synthetic performance tenant', slug: `performance-${tenant}-${prefix}` } }); orgIds.push(organization.id); allowed.push(organization.id)
      const recipient = await user(organization.id); recipients.push(recipient.id)
      const employee = await db.employee.create({ data: { organizationId: organization.id, userId: recipient.id, name: 'Synthetic performance' } })
      const c = await db.client.create({ data: { organizationId: organization.id, firstName: 'Synthetic', lastName: 'Performance' } })
      await db.task.createMany({ data: Array.from({ length: 100 }, () => ({ organizationId: organization.id, assignedToId: recipient.id, title: 'Synthetic performance', dueDate: new Date('2026-10-11') })) })
      await db.case.createMany({ data: Array.from({ length: 100 }, () => ({ organizationId: organization.id, assignedToId: recipient.id, employeeId: employee.id, clientId: c.id, cardPickupDate: new Date('2026-10-17') })) })
      await db.lead.createMany({ data: Array.from({ length: 100 }, () => ({ organizationId: organization.id, assignedToId: recipient.id, employeeId: employee.id, fullName: 'Synthetic performance', nextContactAt: new Date('2026-10-10T09:00Z') })) })
    }
    await db.task.createMany({ data: Array.from({ length: 300 }, () => ({ organizationId: other.id, assignedToId: stranger.id, title: 'Synthetic excluded performance', dueDate: new Date('2026-10-11') })) })
    process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = allowed.join(','); process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS = recipients.join(',')
    let cursor = parseEvaluationCursor(null), entitiesScanned = 0, notificationsCreated = 0, batches = 0
    const initialQueries = queryCount, start = Date.now()
    while (cursor) {
      const result = await evaluateNotificationPage(cursor, now, db); assert.ok(result.evaluated <= 25); entitiesScanned += result.evaluated; notificationsCreated += result.notificationsCreated; batches++
      cursor = result.nextCursor ? parseEvaluationCursor(result.nextCursor) : null
      assert.ok(batches <= 30)
    }
    const metrics = { runtimeMs: Date.now() - start, tenantsScanned: allowed.length, entitiesScanned, notificationsCreated, queries: queryCount - initialQueries, batches, connectionLimit: 1, excludedEntities: 300 }
    assert.equal(entitiesScanned, 600); assert.equal(notificationsCreated, 600); assert.equal(await db.notification.count({ where: { organizationId: other.id } }), 0)
    console.log(JSON.stringify({ phase3bPerformance: metrics })); await writeFile('.qa/phase3b-performance.json', JSON.stringify(metrics, null, 2))
  })
})
