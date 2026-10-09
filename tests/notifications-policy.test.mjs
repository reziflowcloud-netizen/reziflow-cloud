import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { assignmentOccurrence, canReceiveTeam, caseOccurrences, entityLink, leadContactOccurrence, notificationPreferences, notificationStillActionable, reminderTimestamp, safeNotificationReturn, taskOccurrences, warsawDay } from '../src/lib/notificationPolicy.ts'
import { cronAuthorized, decryptSubscription, encryptSubscription, validPushEndpoint, validatePushSubscription } from '../src/lib/pushSecurity.ts'

test('preferences default privacy off and never elevate Employee to team access', () => {
  assert.equal(notificationPreferences().showClientName, false)
  assert.equal(notificationPreferences().pushEnabled, false)
  assert.equal(notificationPreferences({ scope: 'team' }, false).scope, 'mine')
  assert.equal(canReceiveTeam({ role: 'employee', restrictedAccess: false }), false)
  assert.equal(notificationPreferences({ scope: 'team' }, true).scope, 'team')
})
test('only new assignments create assignment occurrences', () => {
  const record = { assignedToId: 1, updatedAt: new Date('2026-10-09T10:00Z') }
  assert.ok(assignmentOccurrence(record))
  assert.equal(assignmentOccurrence(record, { assignedToId: 1 }), null)
  assert.equal(assignmentOccurrence({ ...record, assignedToId: null }), null)
  assert.ok(assignmentOccurrence(record, { assignedToId: 2 }))
})
test('entity links and login return only accept internal known destinations', () => {
  assert.equal(entityLink('task', 'task-a'), '/tasks?notificationTask=task-a')
  assert.throws(() => entityLink('lead', '../settings'))
  assert.equal(safeNotificationReturn('//evil.test'), '/dashboard')
  assert.equal(safeNotificationReturn('/notifications/open/valid-a'), '/notifications/open/valid-a')
  assert.equal(safeNotificationReturn('/notifications/open/x?next=https://evil.test'), '/dashboard')
})
test('Poland wall-time reminders are timezone independent, including DST', () => {
  assert.equal(new Date(reminderTimestamp('2026-10-09T09:00')).toISOString(), '2026-10-09T07:00:00.000Z')
  assert.equal(new Date(reminderTimestamp('2026-12-09T09:00')).toISOString(), '2026-12-09T08:00:00.000Z')
  assert.equal(new Date(reminderTimestamp('2026-10-09T09:00Z')).toISOString(), '2026-10-09T09:00:00.000Z')
  assert.equal(warsawDay(new Date('2026-10-08T23:00Z')), '2026-10-09')
})
test('task dates preserve date-only deadline, explicit reminder and no generated-event duplicates', () => {
  const now = new Date('2026-10-09T12:00Z')
  assert.equal(taskOccurrences({ status: 'todo', dueDate: '2026-10-09' }, now)[0].type, 'task_due')
  assert.equal(taskOccurrences({ status: 'todo', dueDate: '2026-10-08' }, now)[0].type, 'task_overdue')
  assert.deepEqual(taskOccurrences({ status: 'done', dueDate: '2026-10-08' }, now), [])
  assert.deepEqual(taskOccurrences({ status: 'todo', dueDate: '2026-10-10', description: JSON.stringify({ reminderAt: '2026-10-10T09:00' }) }, now), [])
  assert.deepEqual(taskOccurrences({ dueDate: '2026-10-08', description: JSON.stringify({ leadReminder: { leadId: 'a' } }) }, now), [])
})
test('case dates exclude historical fields and dedupe each reminder window', () => {
  const now = new Date('2026-10-09T12:00Z')
  assert.deepEqual(caseOccurrences({ filingDate: '2026-10-10', mosSentAt: '2026-10-10', personalAppearDate: '2026-10-08' }, now), [])
  assert.deepEqual(caseOccurrences({ status: 'Архив', legalStayDeadline: '2026-10-10' }, now), [])
  assert.deepEqual(caseOccurrences({ personalAppearDate: '2026-10-09', statusHistory: [{ fromStatus: 'В работе', changedAt: now }] }, now), [])
  assert.equal(caseOccurrences({ legalStayDeadline: '2026-10-16' }, now)[0].occurrence, 'legalStayDeadline:2026-10-16:7d')
  assert.equal(caseOccurrences({ legalStayDeadline: '2026-10-16' }, new Date('2026-10-10T12:00Z'))[0].occurrence, 'legalStayDeadline:2026-10-16:7d')
  assert.equal(caseOccurrences({ legalStayDeadline: '2026-10-10' }, now)[0].occurrence, 'legalStayDeadline:2026-10-10:1d')
})
test('contact notifications stop after contact, conversion or terminal status', () => {
  const now = new Date('2026-10-09T12:00Z'), lead = { nextContactAt: '2026-10-09T09:00Z', status: 'Новый' }
  assert.ok(leadContactOccurrence(lead, now))
  assert.equal(leadContactOccurrence({ ...lead, lastContactAt: '2026-10-09T10:00Z' }, now), null)
  assert.equal(leadContactOccurrence({ ...lead, convertedClientId: 'client' }, now), null)
  assert.equal(leadContactOccurrence({ ...lead, status: 'Не подходит' }, now), null)
  assert.equal(leadContactOccurrence({ ...lead, status: 'Przeniesiony do klienta' }, now), null)
})
test('subscription encryption binds ciphertext to User and tenant', () => {
  process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY = randomBytes(32).toString('hex')
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/qa', keys: { p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64url'), auth: randomBytes(16).toString('base64url') } }
  const encrypted = encryptSubscription(subscription, 'org:1:hash')
  assert.ok(!encrypted.includes(subscription.endpoint))
  assert.deepEqual(decryptSubscription(encrypted, 'org:1:hash'), subscription)
  assert.throws(() => decryptSubscription(encrypted, 'org:2:hash'))
  assert.throws(() => validatePushSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'bad' } }))
})
test('delivery cancels completed tasks, changed deadlines and already handled contacts', () => {
  const now = new Date('2026-10-09T12:00Z')
  const due = { type: 'task_due', entityType: 'task', entityId: 'qa', dedupeKey: 'task_due:task:qa:2026-10-10:default' }
  assert.equal(notificationStillActionable(due, { status: 'todo', dueDate: '2026-10-10' }, now), true)
  assert.equal(notificationStillActionable(due, { status: 'done', dueDate: '2026-10-10' }, now), false)
  assert.equal(notificationStillActionable(due, { status: 'todo', dueDate: '2026-10-15' }, now), false)
  assert.equal(notificationStillActionable({ type: 'task_assigned', entityType: 'task', entityId: 'qa', dedupeKey: 'task_assigned:task:qa:1:2026-10-09T09:00:00.000Z' }, { status: 'done', assignedToId: 1 }, now), false)
  const contact = { type: 'lead_contact', entityType: 'lead', entityId: 'qa', dedupeKey: 'lead_contact:lead:qa:2026-10-09T09:00:00.000Z' }
  assert.equal(notificationStillActionable(contact, { nextContactAt: '2026-10-09T09:00Z', lastContactAt: '2026-10-09T10:00Z' }, now), false)
})
test('push endpoints reject SSRF targets, credentials and deceptive host suffixes', () => {
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://169.254.169.254/x', 'https://fcm.googleapis.com.evil.test/x', 'https://fcm.googleapis.com:444/x', 'https://user:pass@fcm.googleapis.com/x']) assert.equal(validPushEndpoint(endpoint), false)
  for (const endpoint of ['https://fcm.googleapis.com/x', 'https://updates.push.services.mozilla.com/x', 'https://web.push.apple.com/x', 'https://wns2.notify.windows.com/x']) assert.equal(validPushEndpoint(endpoint), true)
})
test('cron requires exact long bearer secret', () => {
  const secret = 'x'.repeat(40)
  assert.equal(cronAuthorized(`Bearer ${secret}`, secret), true)
  assert.equal(cronAuthorized(`Bearer ${secret}x`, secret), false)
  assert.equal(cronAuthorized('Bearer short', 'short'), false)
})
test('worker handles push and safe click without any sensitive caching', async () => {
  const worker = await readFile(new URL('../public/notification-sw.js', import.meta.url), 'utf8')
  assert.match(worker, /addEventListener\('push'/)
  assert.match(worker, /addEventListener\('notificationclick'/)
  assert.doesNotMatch(worker, /addEventListener\('fetch'|caches\.|cache\.put|indexedDB|localStorage/)
})
test('migration only adds new tables, indexes and foreign keys', async () => {
  const sql = await readFile(new URL('../prisma/migrations/20261009120000_notifications_web_push/migration.sql', import.meta.url), 'utf8')
  assert.doesNotMatch(sql, /DROP\s|ALTER\s+COLUMN|UPDATE\s+"|DELETE\s+FROM/i)
  assert.equal((sql.match(/CREATE TABLE/g) || []).length, 4)
})
