import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { randomUUID, randomBytes, createECDH, createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server.js'
import { notifyAssignment, notificationUser, unreadNotificationCount, listNotifications, markNotificationsRead, authorizedNotification } from '../src/lib/notifications.ts'
import { assignmentEventsEnabled, notificationEventAllowed } from '../src/lib/notificationEventGate.ts'
import { evaluateNotificationPage } from '../src/lib/notificationJobs.ts'
import { deliverNotificationPush, pushPayload } from '../src/lib/notificationPush.ts'
import { notificationPreferences } from '../src/lib/notificationPolicy.ts'
import { safeNotificationReturn } from '../src/lib/notificationPolicy.ts'
import { encryptSubscription, endpointHash, subscriptionAAD } from '../src/lib/pushSecurity.ts'
import { createTaskFetch } from '../src/lib/createTaskFetch.ts'
import { dispatchAssignmentPush } from '../src/lib/assignmentDelivery.ts'

// Run the actual route/service code with only session, billing and transport
// boundaries injected. All entity, routing, dedupe and authorization use PostgreSQL.
const require = createRequire(import.meta.url)
function loader(db, user, dispatched) {
  const cache = new Map()
  const overrides = {
    'src/lib/prisma': { prisma: db },
    'src/lib/auth': { getUser: async () => user.current, getOrganizationId: u => u.organizationId },
    'src/lib/billing': { assertBillingLimit: async () => {}, isBillingLimitError: () => false },
    'src/lib/assignmentDelivery': { dispatchAssignmentPush: async (org, ids) => {
      // A rollback/unfinished transaction cannot make its notifications visible here.
      const count = await db.notification.count({ where: { organizationId: org, entityId: { in: ids } } })
      dispatched.push({ org, ids, count })
    } },
  }
  function load(file) {
    const normalized = file.replaceAll('\\', '/').replace(/\.(ts|js)$/, '')
    if (overrides[normalized]) return overrides[normalized]
    if (cache.has(normalized)) return cache.get(normalized)
    const filename = fs.existsSync(normalized + '.ts') ? normalized + '.ts' : normalized + '.js'
    if (filename.endsWith('.js')) return require(path.resolve(filename))
    const exports = {}; cache.set(normalized, exports)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
    new Function('require', 'exports', code)(id => id.startsWith('@/') ? load('src/' + id.slice(2)) : id.startsWith('.') ? load(path.join(path.dirname(filename), id)) : require(id), exports)
    return exports
  }
  return load
}
const url = process.env.NOTIFICATIONS_TEST_DATABASE_URL
test('Task client keeps identity after a lost response, then starts a fresh operation', async () => {
  const before = globalThis.fetch, keys = []
  globalThis.fetch = async (_url, options) => {
    keys.push(options.headers.get('X-LegalHub-Create-Request'))
    if (keys.length === 1) throw new Error('Synthetic lost response')
    if (keys.length === 2) return new Response('{', { status: 200 }) // Lost JSON body also keeps the key.
    return Response.json({ id: 'synthetic-created-task' })
  }
  try {
    const options = { method: 'POST', body: JSON.stringify({ title: 'Retry synthetic' }) }
    await assert.rejects(createTaskFetch(options))
    await createTaskFetch(options); await createTaskFetch(options); await createTaskFetch(options)
    assert.equal(keys[0], keys[1]); assert.equal(keys[0], keys[2]); assert.notEqual(keys[0], keys[3])
  } finally { globalThis.fetch = before }
})
test('Phase 3A: real assignment routes, ingestion replay, scoped outbox and security', { skip: !url }, async t => {
  const target = new URL(url)
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname.includes('notifications_qa'))
  const db = new PrismaClient({ datasources: { db: { url } } })
  const orgs = []
  t.after(async () => {
    for (const organizationId of orgs) {
      await db.lead.deleteMany({ where: { organizationId } }); await db.task.deleteMany({ where: { organizationId } })
      await db.leadChannelRoute.deleteMany({ where: { organizationId } }); await db.employee.deleteMany({ where: { organizationId } })
      await db.user.deleteMany({ where: { organizationId } }); await db.organization.delete({ where: { id: organizationId } })
    }
    await db.$disconnect()
  })
  const org = await db.organization.create({ data: { name: 'Phase 3 synthetic QA', slug: 'phase3-' + randomUUID(), settings: { leadWebhookKey: 'synthetic-webhook-key', leadWebhookEnabled: true } } }); orgs.push(org.id)
  const other = await db.organization.create({ data: { name: 'Other synthetic tenant', slug: 'phase3-' + randomUUID() } }); orgs.push(other.id)
  const makeUser = (organizationId, role = 'employee', restrictedAccess = true) => db.user.create({ data: { organizationId, role, restrictedAccess, name: 'Synthetic user', email: randomUUID() + '@example.test', password: 'no-login' } })
  const first = await makeUser(org.id), second = await makeUser(org.id), owner = await makeUser(org.id, 'owner', false), outsider = await makeUser(other.id)
  const employees = await Promise.all([first, second].map(u => db.employee.create({ data: { organizationId: org.id, name: 'Synthetic employee', userId: u.id } })))
  const user = { current: owner }, dispatched = [], load = loader(db, user, dispatched)
  const leadPost = load('src/app/api/leads/route').POST, leadPatch = load('src/app/api/leads/[id]/route').PATCH
  const taskPost = load('src/app/api/tasks/route').POST, taskPatch = load('src/app/api/tasks/[id]/route').PATCH
  const webhook = load('src/lib/leadWebhookHandler').handleLeadWebhookPost
  const bulk = load('src/lib/bulkActionServices').executeLeadBulkAction
  const req = (body, headers = {}, method = 'POST') => new NextRequest('http://localhost/api/qa', { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const patch = async (route, record, data) => {
    const response = await route(req({ ...data, expectedUpdatedAt: record.updatedAt }, { 'X-LegalHub-Entity-Write': 'versioned' }, 'PATCH'), { params: { id: record.id } })
    assert.equal(response.status, 200); return response.json()
  }
  process.env.NOTIFICATIONS_ENABLED = 'true'; process.env.NOTIFICATION_EVENTS_ENABLED = 'true'
  process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED = 'false'
  process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = org.id
  process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS = [first.id, second.id, owner.id].join(',')
  await t.test('Fail-closed org/recipient gates and scheduled events OFF', async () => {
    assert.ok(assignmentEventsEnabled(org.id)); assert.equal(assignmentEventsEnabled(other.id), false)
    assert.equal(notificationEventAllowed('lead_assigned', org.id, outsider.id), false)
    for (const type of ['task_due', 'task_overdue', 'case_date', 'lead_contact', 'invalid']) assert.equal(notificationEventAllowed(type, org.id, first.id), false)
    assert.equal((await evaluateNotificationPage(undefined, new Date(), db)).evaluated, 0)
    for (const value of ['', '12,,13', '1.5', '-1', '1,invalid']) { process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS = value; assert.equal(assignmentEventsEnabled(org.id), false) }
    process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS = [first.id, second.id, owner.id].join(',')
    for (const value of ['', org.id + ',bad id', org.id + ',']) { process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = value; assert.equal(assignmentEventsEnabled(org.id), false) }
    process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = org.id
    const denied = await db.task.create({ data: { organizationId: other.id, assignedToId: outsider.id, title: 'Other tenant' } })
    await notifyAssignment(db, 'task', denied); assert.equal(await db.notification.count({ where: { organizationId: other.id } }), 0)
  })
  let lead, task
  await t.test('Manual Lead create, actual reassignment, same assignee and ordinary autosave', async () => {
    const response = await leadPost(req({ fullName: 'Synthetic private name', employeeId: employees[0].id }))
    assert.equal(response.status, 200); lead = await response.json()
    assert.equal(lead.assignedToId, first.id)
    assert.equal(await db.notification.count({ where: { entityId: lead.id } }), 1)
    lead = await patch(leadPatch, lead, { fullName: 'Edited synthetic name' })
    lead = await patch(leadPatch, lead, { employeeId: employees[0].id })
    assert.equal(await db.notification.count({ where: { entityId: lead.id } }), 1)
    lead = await patch(leadPatch, lead, { employeeId: employees[1].id })
    assert.equal(await db.notification.count({ where: { entityId: lead.id, userId: second.id } }), 1)
    const old = await db.notification.findFirst({ where: { entityId: lead.id, userId: first.id } })
    assert.equal(await authorizedNotification(await notificationUser(first.id, org.id, db), old.id, db), null)
    await Promise.all(Array.from({ length: 6 }, () => notifyAssignment(db, 'lead', { ...lead, updatedAt: new Date(lead.updatedAt) }, { assignedToId: first.id })))
    assert.equal(await db.notification.count({ where: { entityId: lead.id } }), 2)
  })
  await t.test('Task create concurrent identical request, reassign, same assignee and title/date/priority edit', async () => {
    const key = randomUUID(), data = { title: 'Synthetic task', assignedToId: first.id }
    const replies = await Promise.all(Array.from({ length: 5 }, () => taskPost(req(data, { 'X-LegalHub-Create-Request': key }))))
    const rows = await Promise.all(replies.map(r => { assert.equal(r.status, 200); return r.json() }))
    assert.equal(new Set(rows.map(r => r.id)).size, 1); task = rows[0]
    assert.equal(await db.notification.count({ where: { entityId: task.id } }), 1)
    assert.equal((await taskPost(req({ ...data, title: 'Changed payload' }, { 'X-LegalHub-Create-Request': key }))).status, 409)
    assert.equal((await taskPost(req(data, { 'X-LegalHub-Create-Request': 'bad' }))).status, 400)
    assert.equal((await taskPost(req(data))).status, 428, 'Pilot must reject ambiguous keyless creates')
    task = await patch(taskPatch, task, { title: 'Edited title', priority: 'Высоко', dueDate: '2026-10-20' })
    task = await patch(taskPatch, task, { assignedToId: first.id })
    assert.equal(await db.notification.count({ where: { entityId: task.id } }), 1)
    task = await patch(taskPatch, task, { assignedToId: second.id })
    assert.equal(await db.notification.count({ where: { entityId: task.id } }), 2)
    assert.ok(dispatched.every(call => call.count > 0), 'Dispatch after committed notification')
  })
  await t.test('Owner mine/team and employee own-only, preferences cannot expand access', async () => {
    assert.equal(await db.notification.count({ where: { userId: owner.id } }), 0)
    await db.notificationPreference.create({ data: { organizationId: org.id, userId: owner.id, scope: 'team' } })
    await db.notificationPreference.create({ data: { organizationId: org.id, userId: first.id, scope: 'team' } })
    const created = await db.task.create({ data: { organizationId: org.id, title: 'Team task', assignedToId: second.id } })
    await notifyAssignment(db, 'task', created)
    assert.equal(await db.notification.count({ where: { entityId: created.id, userId: owner.id } }), 1)
    assert.equal(await db.notification.count({ where: { entityId: created.id, userId: first.id } }), 0)
    user.current = first
    const forbidden = await taskPatch(req({ title: 'Forbidden', expectedUpdatedAt: created.updatedAt }, {}, 'PATCH'), { params: { id: created.id } })
    assert.equal(forbidden.status, 404)
    user.current = owner
    assert.equal(await db.notification.count({ where: { userId: outsider.id } }), 0)
  })
  await t.test('Channel round-robin, explicit assignment, webhook concurrent replay does not advance cursor', async () => {
    const route = await db.leadChannelRoute.create({ data: { organizationId: org.id, sourceKey: 'website', employeeId: employees[0].id } })
    await db.leadChannelRouteMember.create({ data: { organizationId: org.id, routeId: route.id, employeeId: employees[1].id, position: 1 } })
    const payload = { fullName: 'Synthetic webhook name only', source: 'website', eventId: randomUUID() }
    const send = body => webhook(req(body, { 'x-reziflow-key': 'synthetic-webhook-key' }), org.slug)
    const replies = await Promise.all(Array.from({ length: 6 }, () => send(payload)))
    const rows = await Promise.all(replies.map(r => { assert.equal(r.status, 201); return r.json() }))
    assert.equal(new Set(rows.map(r => r.leadId)).size, 1)
    assert.equal(rows[0].lead.assignedToId, first.id)
    assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, 1)
    assert.equal(await db.notification.count({ where: { entityId: rows[0].leadId, userId: first.id } }), 1)
    const next = await (await send({ ...payload, eventId: randomUUID() })).json()
    assert.equal(next.lead.assignedToId, second.id)
    const explicit = await (await send({ ...payload, eventId: randomUUID(), assignedToId: first.id })).json()
    assert.equal(explicit.lead.assignedToId, first.id)
    assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, 2)
    const fingerprint = { fullName: 'Synthetic no external event key', source: 'website' }
    const stable = await Promise.all([send(fingerprint), send({ source: 'website', fullName: fingerprint.fullName })])
    assert.equal((await stable[0].json()).leadId, (await stable[1].json()).leadId)
    await db.lead.delete({ where: { id: rows[0].leadId } })
    assert.equal((await (await send(payload)).json()).leadId, null, 'Replay tombstone must not recreate a deleted lead')
  })
  await t.test('Bulk assignment concurrent repeats and Employee link validation', async () => {
    const records = await Promise.all(Array.from({ length: 3 }, () => db.lead.create({ data: { organizationId: org.id, fullName: 'Bulk synthetic' } })))
    const input = { action: 'assign_employee', employeeId: employees[0].id, selection: { mode: 'ids', ids: records.map(row => row.id) } }
    await Promise.all([bulk({ organizationId: org.id, user: owner, scope: { restricted: false, userId: owner.id }, input }), bulk({ organizationId: org.id, user: owner, scope: { restricted: false, userId: owner.id }, input })])
    assert.equal(await db.notification.count({ where: { entityId: { in: input.selection.ids }, userId: first.id } }), 3)
    const inconsistent = await db.lead.create({ data: { organizationId: org.id, employeeId: employees[0].id, assignedToId: second.id, fullName: 'Bad legacy link' } })
    await notifyAssignment(db, 'lead', inconsistent)
    assert.equal(await db.notification.count({ where: { entityId: inconsistent.id } }), 0)
    const unlinked = await db.lead.create({ data: { organizationId: org.id, assignedToId: owner.id, fullName: 'Unlinked assignee' } })
    await notifyAssignment(db, 'lead', unlinked); assert.equal(await db.notification.count({ where: { entityId: unlinked.id } }), 0)
    await db.employee.update({ where: { id: employees[0].id }, data: { active: false } })
    await notifyAssignment(db, 'lead', { ...inconsistent, assignedToId: first.id }); assert.equal(await db.notification.count({ where: { entityId: inconsistent.id } }), 0)
    await db.employee.update({ where: { id: employees[0].id }, data: { active: true } })
  })
  await t.test('Telegram and signed Meta Lead/messages/sync concurrent replay routes', async () => {
    const settings = { leadWebhookKey: 'synthetic-webhook-key', leadWebhookEnabled: true, leadWebhookAssignmentMode: 'single', leadWebhookAssignmentUserId: first.id, facebookLeadEnabled: true, facebookMessagesEnabled: true, facebookLeadPageAccessToken: 'synthetic-token' }
    await db.organization.update({ where: { id: org.id }, data: { settings } })
    const telegram = load('src/app/api/webhooks/telegram/leads/[slug]/[key]/route').POST
    const data = { message: { chat: { id: 'synthetic-chat' }, message_id: 1, text: 'Synthetic Tester +48123456789' } }
    const results = await Promise.all(Array.from({ length: 4 }, () => telegram(req(data), { params: { slug: org.slug, key: settings.leadWebhookKey } })))
    const ids = await Promise.all(results.map(async r => { assert.ok([200, 201].includes(r.status)); return (await r.json()).leadId }))
    assert.equal(new Set(ids).size, 1)
    assert.equal(await db.notification.count({ where: { entityId: ids[0], userId: first.id } }), 1)
    const meta = load('src/app/api/webhooks/meta/leads/[slug]/route').POST
    const messages = load('src/app/api/webhooks/meta/messages/[slug]/route').POST
    process.env.META_APP_SECRET = 'synthetic-meta-secret'; delete process.env.INSTAGRAM_APP_SECRET
    const signed = body => req(body, { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET).update(JSON.stringify(body)).digest('hex') })
    const fetchBefore = globalThis.fetch
    globalThis.fetch = async rawUrl => {
      const url = new URL(rawUrl); assert.equal(url.hostname, 'graph.facebook.com')
      if (url.pathname.endsWith('/conversations')) {
        const participantId = url.searchParams.get('user_id')
        return Response.json({ data: [{ messages: { data: [{ id: 'sync-' + participantId, message: 'Synthetic sync', from: { id: participantId }, created_time: '2026-10-10T12:00:00Z' }] } }] })
      }
      return Response.json({ id: 'synthetic-meta-lead', name: 'Synthetic Profile', field_data: [{ name: 'full_name', values: ['Synthetic Meta Tester'] }] })
    }
    try {
      const body = { object: 'page', entry: [{ id: 'synthetic-page', changes: [{ field: 'leadgen', value: { leadgen_id: 'synthetic-meta-lead' } }] }] }
      const replies = await Promise.all(Array.from({ length: 4 }, () => meta(signed(body), { params: { slug: org.slug } })))
      assert.ok(replies.every(r => r.status === 200))
      const record = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta:synthetic-meta-lead' } })
      assert.ok(record); assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: record.messengerId } }), 1)
      assert.equal(await db.notification.count({ where: { entityId: record.id, userId: first.id } }), 1)
      assert.equal((await meta(req(body), { params: { slug: org.slug } })).status, 401)
      for (const kind of ['message', 'read']) {
        const event = { sender: { id: 'synthetic-' + kind }, recipient: { id: 'synthetic-page' }, timestamp: 1791633600000, ...(kind === 'message' ? { message: { mid: 'synthetic-mid', text: 'Synthetic message' } } : { read: { watermark: 1791633600000 } }) }
        const payload = { object: 'page', entry: [{ id: 'synthetic-page', messaging: [event] }] }
        const replies = await Promise.all(Array.from({ length: 4 }, () => messages(signed(payload), { params: { slug: org.slug } })))
        assert.ok(replies.every(r => r.status === 200))
        const record = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'facebook:synthetic-' + kind } })
        assert.ok(record, kind + ' lead created'); assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: record.messengerId } }), 1)
        assert.equal(await db.notification.count({ where: { entityId: record.id, userId: first.id } }), 1)
        assert.equal(await db.leadMessage.count({ where: { organizationId: org.id, leadId: record.id } }), 1)
      }
    } finally { globalThis.fetch = fetchBefore }
  })
  await t.test('Legacy fallback round robin uses the latest locked cursor, tenant dedupe stays independent', async () => {
    await db.organization.update({ where: { id: org.id }, data: { settings: { leadWebhookKey: 'synthetic-webhook-key', leadWebhookEnabled: true, leadWebhookAssignmentMode: 'round_robin', leadWebhookAssignmentUserIds: [first.id, second.id], leadWebhookAssignmentCursor: 0 } } })
    const payloads = Array.from({ length: 3 }, () => ({ eventId: randomUUID(), source: 'fallback', fullName: 'Fallback synthetic' }))
    const replies = await Promise.all(payloads.map(body => webhook(req(body, { 'x-reziflow-key': 'synthetic-webhook-key' }), org.slug)))
    const assigned = await Promise.all(replies.map(async r => { assert.equal(r.status, 201); return (await r.json()).lead.assignedToId }))
    assert.equal(assigned.filter(id => id === first.id).length, 2); assert.equal(assigned.filter(id => id === second.id).length, 1)
    assert.equal((await db.organization.findUnique({ where: { id: org.id } })).settings.leadWebhookAssignmentCursor, 3)
    await db.organization.update({ where: { id: other.id }, data: { settings: { leadWebhookKey: 'synthetic-webhook-key', leadWebhookEnabled: true } } })
    const foreign = await webhook(req(payloads[0], { 'x-reziflow-key': 'synthetic-webhook-key' }), other.slug)
    assert.equal(foreign.status, 201); assert.equal((await foreign.json()).lead.organizationId, other.id)
    assert.equal(await db.notification.count({ where: { organizationId: other.id } }), 0)
  })
  await t.test('In-app/push independent, automatic delivery scopes, privacy, read/badge and deep link authorization', async () => {
    process.env.WEB_PUSH_ENABLED = 'true'; process.env.PUSH_ENVIRONMENT = process.env.VERCEL_ENV || 'development'
    process.env.WEB_PUSH_PILOT_USER_IDS = String(first.id)
    const pair = createECDH('prime256v1'); pair.generateKeys()
    process.env.VAPID_PUBLIC_KEY = pair.getPublicKey().toString('base64url'); process.env.VAPID_PRIVATE_KEY = pair.getPrivateKey().toString('base64url'); process.env.VAPID_SUBJECT = 'https://qa.example.test/contact'; process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY = randomBytes(32).toString('hex')
    const raw = { endpoint: 'https://web.push.apple.com/' + randomUUID(), keys: { p256dh: pair.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
    const fields = { organizationId: org.id, userId: first.id, endpointHash: endpointHash(raw.endpoint), deviceLabel: 'Synthetic' }
    await db.pushSubscription.create({ data: { ...fields, encryptedSubscription: encryptSubscription(raw, subscriptionAAD(fields)) } })
    const events = { task_assigned: { inApp: false, push: true } }
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: first.id, organizationId: org.id } }, data: { pushEnabled: true, events } })
    const record = await db.task.create({ data: { organizationId: org.id, assignedToId: first.id, title: 'Secret synthetic name', clientName: 'Secret PII' } })
    await notifyAssignment(db, 'task', record)
    const hidden = await db.notification.findFirst({ where: { entityId: record.id, userId: first.id } })
    const own = await notificationUser(first.id, org.id, db)
    assert.equal(hidden.inApp, false); assert.equal(hidden.pushRequested, true)
    assert.ok(!(await listNotifications(own, null, db)).items.some(row => row.id === hidden.id))
    assert.ok(await authorizedNotification(own, hidden.id, db)); assert.equal(await authorizedNotification(await notificationUser(outsider.id, other.id, db), hidden.id, db), null)
    const sent = []; const sender = async (_sub, payload) => sent.push(JSON.parse(payload))
    const delivered = await deliverNotificationPush(db, sender, new Date(), undefined, { organizationId: org.id, entityIds: [record.id] })
    assert.equal(delivered.delivered, 1); assert.equal(sent.length, 1)
    assert.match(sent[0].body, /^Нове завдання призначено вам/); assert.ok(!JSON.stringify(sent).includes('Secret')); assert.equal(sent[0].pilotDiagnostics, false)
    assert.equal(sent[0].url, '/notifications/open/' + hidden.id)
    assert.equal((await deliverNotificationPush(db, sender, new Date(), undefined, { organizationId: other.id, entityIds: [record.id] })).processed, 0)
    assert.equal((await deliverNotificationPush(db, sender, new Date(), undefined, { organizationId: org.id, entityIds: [record.id] })).delivered, 0)
    const leadCopy = pushPayload({ ...hidden, type: 'lead_assigned' }, notificationPreferences(null), 'Secret PII', 0)
    assert.match(leadCopy.body, /^Новий лід призначено вам/); assert.ok(!leadCopy.body.includes('Secret'))
    const open = load('src/app/notifications/open/[id]/route').GET
    user.current = first
    const clicked = await open(new NextRequest('http://localhost/notifications/open/' + hidden.id), { params: { id: hidden.id } })
    assert.equal(clicked.headers.get('Location'), '/tasks?notificationTask=' + record.id)
    const readAt = (await db.notification.findUnique({ where: { id: hidden.id } })).readAt
    assert.ok(readAt, 'Push-only click marks read')
    await open(new NextRequest('http://localhost/notifications/open/' + hidden.id), { params: { id: hidden.id } })
    assert.equal((await db.notification.findUnique({ where: { id: hidden.id } })).readAt.getTime(), readAt.getTime(), 'Duplicate click does not rewrite read state')
    user.current = outsider
    assert.equal((await open(new NextRequest('http://localhost/notifications/open/' + hidden.id), { params: { id: hidden.id } })).headers.get('Location'), '/dashboard')
    user.current = null
    const loginLocation = (await open(new NextRequest('http://localhost/notifications/open/' + hidden.id), { params: { id: hidden.id } })).headers.get('Location')
    assert.ok(loginLocation.startsWith('/login?next='))
    const returnPath = safeNotificationReturn(new URL(loginLocation, 'http://localhost').searchParams.get('next'))
    assert.equal(returnPath, '/notifications/open/' + hidden.id)
    user.current = first
    assert.equal((await open(new NextRequest('http://localhost' + returnPath), { params: { id: hidden.id } })).headers.get('Location'), '/tasks?notificationTask=' + record.id)
    user.current = second
    const leadNotification = await db.notification.findFirst({ where: { entityId: lead.id, userId: second.id } })
    assert.equal((await open(new NextRequest('http://localhost/notifications/open/' + leadNotification.id), { params: { id: leadNotification.id } })).headers.get('Location'), '/leads/' + lead.id)
    user.current = first
    const inaccessible = await db.notification.findFirst({ where: { entityId: lead.id, userId: first.id } })
    assert.equal((await open(new NextRequest('http://localhost/notifications/open/' + inaccessible.id), { params: { id: inaccessible.id } })).headers.get('Location'), '/dashboard', 'Reassigned Lead cannot be opened by its old recipient')
    await db.task.delete({ where: { id: record.id } })
    assert.equal((await open(new NextRequest('http://localhost/notifications/open/' + hidden.id), { params: { id: hidden.id } })).headers.get('Location'), '/dashboard', 'Deleted Task has no stale deep link')
    user.current = owner
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: first.id, organizationId: org.id } }, data: { events: { task_assigned: { inApp: true, push: false } } } })
    const visible = await db.task.create({ data: { organizationId: org.id, assignedToId: first.id, title: 'In-app only' } }); await notifyAssignment(db, 'task', visible)
    assert.equal(await db.notificationPushDelivery.count({ where: { notification: { entityId: visible.id }, userId: first.id } }), 0)
    const before = await unreadNotificationCount(own, db); const row = await db.notification.findFirst({ where: { entityId: visible.id, userId: first.id } })
    await markNotificationsRead(own, row.id, db); assert.equal(await unreadNotificationCount(own, db), before - 1)
    assert.equal(await markNotificationsRead(await notificationUser(outsider.id, other.id, db), row.id, db), 0)
    await markNotificationsRead(own, undefined, db); assert.equal(await unreadNotificationCount(own, db), 0)
    const linkedLead = await db.lead.create({ data: { organizationId: org.id, employeeId: employees[0].id, assignedToId: first.id, fullName: 'Private synthetic lead' } })
    await notifyAssignment(db, 'lead', linkedLead)
    await db.employee.update({ where: { id: employees[0].id }, data: { active: false } })
    assert.equal((await deliverNotificationPush(db, sender, new Date(), undefined, { organizationId: org.id, entityIds: [linkedLead.id] })).delivered, 0, 'Delivery rechecks a disabled Employee link')
    assert.ok((await db.notificationPushDelivery.findFirst({ where: { notification: { entityId: linkedLead.id }, userId: first.id } })).terminalAt)
    await db.employee.update({ where: { id: employees[0].id }, data: { active: true } })
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: first.id, organizationId: org.id } }, data: { events: { task_assigned: { inApp: true, push: true } } } })
    const bulkRecords = await Promise.all(Array.from({ length: 21 }, async () => {
      const record = await db.task.create({ data: { organizationId: org.id, assignedToId: first.id, title: 'Automatic page QA' } })
      await notifyAssignment(db, 'task', record); return record
    }))
    const provider = require('web-push'), originalSender = provider.sendNotification
    let calls = 0; provider.sendNotification = async () => { calls++ }
    try {
      await Promise.all([dispatchAssignmentPush(org.id, bulkRecords.map(r => r.id), db), dispatchAssignmentPush(org.id, bulkRecords.map(r => r.id), db)])
      assert.equal(calls, 21, 'After-commit dispatcher drains pages without duplicate sends')
      assert.equal(await db.notificationPushDelivery.count({ where: { notification: { entityId: { in: bulkRecords.map(r => r.id) } }, deliveredAt: { not: null } } }), 21)
    } finally { provider.sendNotification = originalSender }
  })
})
