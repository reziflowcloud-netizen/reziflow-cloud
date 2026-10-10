import assert from 'node:assert/strict'
import test from 'node:test'
import { createECDH, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { authorizedNotification, emitNotification, entityContext, listNotifications, markNotificationsRead, notificationUser, notifyAssignment, unreadNotificationCount } from '../src/lib/notifications.ts'
import { deliverNotificationPush } from '../src/lib/notificationPush.ts'
import { notificationPreferences } from '../src/lib/notificationPolicy.ts'
import { encryptSubscription, endpointHash, subscriptionAAD } from '../src/lib/pushSecurity.ts'
import { evaluateNotificationPage } from '../src/lib/notificationJobs.ts'

const databaseUrl = process.env.NOTIFICATIONS_TEST_DATABASE_URL
test('notification DB isolation, assignment, dedupe, scheduling and delivery', { skip: !databaseUrl }, async t => {
  const target = new URL(databaseUrl)
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && target.pathname.includes('notifications_qa'), 'Only isolated local notification QA DB is allowed')
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] })
  t.after(() => db.$disconnect())
  process.env.NOTIFICATIONS_ENABLED = 'true'; process.env.NOTIFICATION_EVENTS_ENABLED = 'true'
  process.env.WEB_PUSH_ENABLED = 'true'; process.env.PUSH_ENVIRONMENT = process.env.VERCEL_ENV || 'development'
  const vapidPair = createECDH('prime256v1'); vapidPair.generateKeys()
  process.env.VAPID_PUBLIC_KEY = vapidPair.getPublicKey().toString('base64url'); process.env.VAPID_PRIVATE_KEY = vapidPair.getPrivateKey().toString('base64url'); process.env.VAPID_SUBJECT = 'mailto:qa@example.test'
  process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY = randomBytes(32).toString('hex')
  const suffix = randomBytes(6).toString('hex')
  const a = await db.organization.create({ data: { name: 'Notification QA A', slug: `notification-qa-a-${suffix}` } })
  const b = await db.organization.create({ data: { name: 'Notification QA B', slug: `notification-qa-b-${suffix}` } })
  const makeUser = (organizationId, role = 'employee', restrictedAccess = true) => db.user.create({ data: { organizationId, email: `${role}-${randomBytes(6).toString('hex')}@example.test`, password: 'not-a-login-hash', name: 'QA User', role, restrictedAccess } })
  const employee = await makeUser(a.id), next = await makeUser(a.id), owner = await makeUser(a.id, 'owner', false), outsider = await makeUser(b.id)
  process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = a.id
  process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS = [employee.id, next.id, owner.id].join(',')
  process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED = 'true' // Existing evaluator regression only; Phase 3A tests leave this OFF.
  process.env.PUSH_TEST_USER_ID = String(employee.id)
  const linked = await db.employee.create({ data: { organizationId: a.id, userId: employee.id, name: 'QA Employee' } })
  const user = await notificationUser(employee.id, a.id, db)
  const createTask = async (assignedToId = employee.id, extra = {}) => db.$transaction(async tx => {
    const record = await tx.task.create({ data: { organizationId: a.id, assignedToId, title: 'Synthetic QA task', ...extra } })
    await notifyAssignment(tx, 'task', record)
    return record
  })
  const task = await createTask()
  await t.test('Owner mine mode, linked Employee and ordinary edits', async () => {
    assert.equal(await unreadNotificationCount(user, db), 1)
    assert.equal(await db.notification.count({ where: { userId: owner.id } }), 0)
    await notifyAssignment(db, 'task', task, task)
    assert.equal(await unreadNotificationCount(user, db), 1)
    const lead = await db.lead.create({ data: { organizationId: a.id, assignedToId: employee.id, employeeId: linked.id, fullName: 'Synthetic Client' } })
    await notifyAssignment(db, 'lead', lead)
    assert.equal(await db.notification.count({ where: { userId: employee.id, entityId: lead.id } }), 1)
  })
  await t.test('Team owner copy and concurrent retries dedupe', async () => {
    await db.notificationPreference.create({ data: { organizationId: a.id, userId: owner.id, scope: 'team' } })
    const record = await createTask()
    await Promise.all([notifyAssignment(db, 'task', record), notifyAssignment(db, 'task', record)])
    assert.equal(await db.notification.count({ where: { entityId: record.id } }), 2)
    assert.equal(await db.notification.count({ where: { userId: outsider.id } }), 0)
  })
  await t.test('List, mark one/all and cross-User read isolation', async () => {
    const feed = await listNotifications(user, null, db)
    assert.equal(feed.unread, 3)
    await markNotificationsRead(user, feed.items[0].id, db)
    assert.equal(await unreadNotificationCount(user, db), 2)
    const foreign = await db.notification.findFirst({ where: { userId: owner.id } })
    assert.equal(await markNotificationsRead(user, foreign.id, db), 0)
    assert.equal(await authorizedNotification(user, foreign.id, db), null)
    await markNotificationsRead(user, undefined, db)
    assert.equal(await unreadNotificationCount(user, db), 0)
  })
  await t.test('Reassignment removes previous access and notifies new assignee', async () => {
    const previousNotification = await db.notification.findFirst({ where: { entityId: task.id, userId: employee.id } })
    const updated = await db.task.update({ where: { id: task.id }, data: { assignedToId: next.id } })
    await notifyAssignment(db, 'task', updated, task)
    assert.equal(await authorizedNotification(user, previousNotification.id, db), null)
    const nextUser = await notificationUser(next.id, a.id, db)
    assert.equal(await unreadNotificationCount(nextUser, db), 1)
  })
  await t.test('Composite FKs reject cross-tenant notifications/preferences/subscriptions', async () => {
    assert.equal(entityContext('case', { organizationId: a.id, caseNumber: 'QA', client: { organizationId: b.id, firstName: 'Foreign', lastName: 'Identity' } }), 'QA')
    await assert.rejects(db.notification.create({ data: { organizationId: b.id, userId: employee.id, type: 'task_assigned', title: 'QA', body: '', entityType: 'task', entityId: task.id, deepLink: '/tasks', dedupeKey: 'foreign' } }), error => error.code === 'P2003')
    await assert.rejects(db.notificationPreference.create({ data: { organizationId: b.id, userId: employee.id } }), error => error.code === 'P2003')
    await assert.rejects(db.pushSubscription.create({ data: { organizationId: b.id, userId: employee.id, endpointHash: 'foreign', encryptedSubscription: '', deviceLabel: 'QA' } }), error => error.code === 'P2003')
  })
  await t.test('Scheduled task, case and contact occurrences retry without duplicates', async () => {
    const now = new Date('2026-10-09T12:00Z')
    await createTask(employee.id, { dueDate: new Date('2026-10-10') })
    await createTask(employee.id, { dueDate: new Date('2026-10-08') })
    const client = await db.client.create({ data: { organizationId: a.id, firstName: 'Synthetic', lastName: 'Client' } })
    await db.case.create({ data: { organizationId: a.id, clientId: client.id, assignedToId: employee.id, legalStayDeadline: new Date('2026-10-10'), filingDate: new Date('2026-10-10') } })
    await db.lead.create({ data: { organizationId: a.id, assignedToId: employee.id, nextContactAt: new Date('2026-10-09T09:00Z'), fullName: 'QA Contact' } })
    for (const kind of ['task', 'case', 'lead']) {
      let cursor = { kind, after: '' }
      while (cursor) {
        const result = await evaluateNotificationPage(cursor, now, db)
        const [nextKind, after] = (result.nextCursor || '').split(':')
        cursor = nextKind === kind ? { kind, after } : null
      }
    }
    const before = await db.notification.count({ where: { organizationId: a.id } })
    for (const kind of ['task', 'case', 'lead']) await evaluateNotificationPage({ kind, after: '' }, now, db)
    assert.equal(await db.notification.count({ where: { organizationId: a.id } }), before)
    for (const type of ['task_due', 'task_overdue', 'case_date', 'lead_contact']) assert.ok(await db.notification.count({ where: { organizationId: a.id, userId: employee.id, type } }))
  })
  await t.test('Pagination is stable and role downgrade immediately revokes team copies', async () => {
    const paginationTask = await createTask()
    await db.notification.createMany({ data: Array.from({ length: 35 }, (_, index) => ({ organizationId: a.id, userId: employee.id, type: 'task_due', title: 'Pagination QA', body: '', entityType: 'task', entityId: paginationTask.id, deepLink: '/tasks', dedupeKey: `page-${index}` })) })
    const first = await listNotifications(user, null, db)
    const second = await listNotifications(user, first.nextCursor, db)
    assert.equal(first.items.length, 30); assert.ok(first.nextCursor)
    assert.ok(!second.items.some(item => first.items.some(previous => previous.id === item.id)))
    const teamNotification = await db.notification.findFirst({ where: { userId: owner.id, entityId: paginationTask.id } })
    await db.user.update({ where: { id: owner.id }, data: { role: 'employee', restrictedAccess: true } })
    const downgraded = await notificationUser(owner.id, a.id, db)
    assert.equal(await authorizedNotification(downgraded, teamNotification.id, db), null)
    const another = await createTask()
    assert.equal(await db.notification.count({ where: { userId: owner.id, entityId: another.id } }), 0)
    await db.user.update({ where: { id: owner.id }, data: { role: 'owner', restrictedAccess: false } })
  })
  const subscriptions = []
  for (let i = 0; i < 2; i++) {
    const raw = { endpoint: `https://fcm.googleapis.com/fcm/send/qa-${suffix}-${i}`, keys: { p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64url'), auth: randomBytes(16).toString('base64url') } }
    const identity = { organizationId: a.id, userId: employee.id, endpointHash: endpointHash(raw.endpoint) }
    subscriptions.push(await db.pushSubscription.create({ data: { ...identity, encryptedSubscription: encryptSubscription(raw, subscriptionAAD(identity)), deviceLabel: 'Synthetic device', createdAt: new Date(0) } }))
  }
  await db.notificationPreference.create({ data: { organizationId: a.id, userId: employee.id, pushEnabled: true } })
  const pushed = await createTask(employee.id, { clientName: 'Private QA Identity', description: 'passport SECRET_NOTES' })
  const captured = []
  await t.test('Concurrent workers deliver once to two devices with privacy OFF', async () => {
    const sender = async (_sub, payload) => { captured.push(JSON.parse(payload)); await new Promise(resolve => setTimeout(resolve, 10)) }
    await Promise.all([deliverNotificationPush(db, sender), deliverNotificationPush(db, sender)])
    assert.equal(captured.length, 2)
    assert.ok(captured.every(payload => !JSON.stringify(payload).includes('Private QA Identity') && !JSON.stringify(payload).includes('SECRET_NOTES')))
    assert.ok(captured.every(payload => payload.url.startsWith('/notifications/open/')))
    assert.equal(await db.notificationPushDelivery.count({ where: { organizationId: a.id, deliveredAt: { not: null } } }), 2)
  })
  await t.test('Privacy ON uses permitted name only; 410 clears expired device keys', async () => {
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: employee.id, organizationId: a.id } }, data: { showClientName: true } })
    await createTask(employee.id, { clientName: 'Private QA Identity', description: 'SECRET_NOTES' })
    const payloads = []
    await deliverNotificationPush(db, async (sub, payload) => {
      payloads.push(JSON.parse(payload))
      if (sub.endpoint.endsWith('-1')) throw Object.assign(new Error('Synthetic expired'), { statusCode: 410 })
    })
    assert.equal(payloads.length, 2)
    assert.ok(payloads.every(payload => payload.body.includes('Private QA Identity') && !payload.body.includes('SECRET_NOTES')))
    const expired = await db.pushSubscription.findUnique({ where: { id: subscriptions[1].id } })
    assert.ok(expired.disabledAt); assert.equal(expired.encryptedSubscription, '')
  })
  await t.test('Transient failures retry only failed delivery and read cancels pending push', async () => {
    const record = await createTask()
    await deliverNotificationPush(db, async () => { throw Object.assign(new Error('Synthetic failure'), { statusCode: 500 }) })
    const delivery = await db.notificationPushDelivery.findFirst({ where: { notification: { entityId: record.id }, terminalAt: null } })
    assert.ok(delivery.nextAttemptAt > new Date()); assert.equal(delivery.attempts, 1)
    await db.notificationPushDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: new Date(0) } })
    let count = 0
    await deliverNotificationPush(db, async () => { count++ }); assert.equal(count, 1)
    const nextRecord = await createTask()
    await markNotificationsRead(user, undefined, db)
    await deliverNotificationPush(db, async () => { count++ }); assert.equal(count, 1)
    assert.ok(await db.notification.count({ where: { entityId: nextRecord.id } }))
  })
  await t.test('Channels remain independent and unsubscribe cascades outbox', async () => {
    const prefs = notificationPreferences({ pushEnabled: true })
    prefs.events.task_assigned = { inApp: false, push: true }
    await db.notificationPreference.update({ where: { userId_organizationId: { userId: employee.id, organizationId: a.id } }, data: { events: prefs.events } })
    const record = await createTask()
    const notification = await db.notification.findFirst({ where: { entityId: record.id, userId: employee.id } })
    assert.equal(notification.inApp, false); assert.equal(notification.pushRequested, true)
    await db.pushSubscription.delete({ where: { id: subscriptions[0].id } })
    assert.equal(await db.notificationPushDelivery.count({ where: { subscriptionId: subscriptions[0].id } }), 0)
  })
})
