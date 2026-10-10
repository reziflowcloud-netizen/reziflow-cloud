import assert from 'node:assert/strict'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { NotificationResumeTracker, mobileStandalone } from '../src/lib/notificationResume.ts'
import { listNotifications, markNotificationsRead } from '../src/lib/notifications.ts'

const base = Date.parse('2026-10-10T12:00:00.000Z')
const meta = (seconds, id = null, scope = 'org:16') => ({ scope, serverTime: new Date(base + seconds * 1000).toISOString(), newUnreadId: id })
function background() {
  const state = new NotificationResumeTracker()
  state.observe(meta(0), 1000, null, true)
  state.background(2000); state.resume()
  return state
}
test('only mobile standalone (including Apple Home Screen) is eligible', () => {
  assert.equal(mobileStandalone(true, true), true)
  assert.equal(mobileStandalone(true, false, true), true)
  assert.equal(mobileStandalone(true, false, false), false)
  assert.equal(mobileStandalone(false, true, true), false)
})
test('old unread/cold start and foreground refresh never show; server time ignores device clock', () => {
  const state = new NotificationResumeTracker()
  state.observe(meta(0, 'old'), 1000, null, true)
  state.resume(); state.observe(meta(1, 'old'), 2000, null, true)
  assert.equal(state.showing, false)
  state.background(3000)
  state.resume()
  assert.equal(state.since(), new Date(base + 2000).toISOString())
  state.observe(meta(4), 5000, state.since(), true)
  assert.equal(state.showing, false)
})
test('background then new unread shows one persistent banner, even with multiple new messages', () => {
  const state = background(), since = state.since()
  state.observe(meta(4, 'new-one'), 5000, since, true)
  assert.equal(state.showing, true)
  state.observe(meta(5, 'new-two'), 6000, since, true)
  state.background(7000); state.resume()
  assert.equal(state.since(), since)
  assert.equal(state.showing, true)
})
test('background/resume before initial sync reconstructs boundary and requires a fresh scoped query', () => {
  for (const visible of [true, false]) {
    const state = new NotificationResumeTracker()
    state.background(1000)
    if (visible) state.resume()
    state.observe(meta(3), 4000, null, visible)
    if (!visible) state.resume()
    assert.equal(state.since(), meta(0).serverTime)
    assert.equal(state.showing, false)
    state.observe(meta(4, 'new-during-initial-sync'), 5000, state.since(), true)
    assert.equal(state.showing, true)
  }
})
test('dismiss/Center open/direct route suppress same set and stale in-flight responses', () => {
  for (const action of ['dismiss', 'Center open', 'direct route']) {
    const state = background(), since = state.since()
    state.observe(meta(4, 'new'), 5000, since, true)
    state.acknowledge()
    state.observe(meta(5, 'new'), 6000, since, true)
    state.resume()
    assert.equal(state.showing, false, action)
    assert.equal(state.since(), null)
    state.background(7000); state.resume()
    state.observe(meta(9), 10000, state.since(), true)
    assert.equal(state.showing, false)
  }
})
test('read/mark-all/access revoke clears banner; hidden or pre-resume response cannot show', () => {
  const state = background(), since = state.since()
  state.observe(meta(3, 'new'), 4000, null, true)
  assert.equal(state.showing, false)
  state.observe(meta(4, 'new'), 5000, since, false)
  assert.equal(state.showing, false)
  state.observe(meta(5, 'new'), 6000, since, true)
  state.observe(meta(6), 7000, since, true)
  assert.equal(state.showing, false)
  assert.equal(state.since(), null)
})
test('scope change and session expiry discard pending resume state', () => {
  const state = background(), since = state.since()
  state.observe(meta(5, 'foreign', 'other:23'), 6000, since, true)
  assert.equal(state.showing, false)
  assert.equal(state.since(), null)
  state.background(7000); state.resume(); state.reset()
  assert.equal(state.showing, false); assert.equal(state.since(), null)
})

test('new unread query respects access, pagination and unchanged unread count', { skip: !process.env.NOTIFICATIONS_TEST_DATABASE_URL }, async t => {
  const url = process.env.NOTIFICATIONS_TEST_DATABASE_URL
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname) && url.includes('notifications_qa'))
  const db = new PrismaClient({ datasources: { db: { url } }, log: [] })
  const org = await db.organization.create({ data: { name: 'Resume QA', slug: `resume-qa-${crypto.randomUUID()}` } })
  t.after(async () => {
    await db.notification.deleteMany({ where: { organizationId: org.id } })
    await db.task.deleteMany({ where: { organizationId: org.id } })
    await db.user.deleteMany({ where: { organizationId: org.id } })
    await db.organization.delete({ where: { id: org.id } }); await db.$disconnect()
  })
  const user = await db.user.create({ data: { organizationId: org.id, email: `resume-${org.id}@example.test`, name: 'Resume QA', password: 'not-a-login-hash', role: 'employee', restrictedAccess: true } })
  const other = await db.user.create({ data: { organizationId: org.id, email: `other-${org.id}@example.test`, name: 'Other QA', password: 'not-a-login-hash', role: 'employee', restrictedAccess: true } })
  const task = await db.task.create({ data: { organizationId: org.id, assignedToId: user.id, title: 'Synthetic resume QA' } })
  const make = (key, seconds, extra = {}) => db.notification.create({ data: { organizationId: org.id, userId: user.id, type: 'task_assigned', title: 'Synthetic', body: '', entityType: 'task', entityId: task.id, deepLink: `/tasks?notificationTask=${task.id}`, dedupeKey: key, inApp: true, createdAt: new Date(base + seconds * 1000), ...extra } })
  const since = meta(1).serverTime
  const old = await make('old', 0)
  assert.equal((await listNotifications(user, null, db, since)).resume.newUnreadId, null)
  await markNotificationsRead(user, old.id, db)
  const fresh = await make('new', 2)
  for (let index = 0; index < 31; index++) await make(`read-${index}`, index + 3, { readAt: new Date() })
  const feed = await listNotifications(user, null, db, since)
  assert.equal(feed.unread, 1) // Count was also 1 before background: count-only misses this.
  assert.equal(feed.items.some(item => item.id === fresh.id), false)
  assert.equal(feed.resume.newUnreadId, fresh.id)
  assert.equal(feed.resume.scope, `${org.id}:${user.id}`)
  assert.ok(feed.resume.serverTime instanceof Date)
  assert.equal((await listNotifications(other, null, db, since)).resume.newUnreadId, null)
  assert.equal((await listNotifications({ ...user, organizationId: 'foreign' }, null, db, since)).resume.newUnreadId, null)
  await markNotificationsRead(user, undefined, db)
  assert.equal((await listNotifications(user, null, db, since)).resume.newUnreadId, null)
  await make('deleted-access', 50)
  await db.task.update({ where: { id: task.id }, data: { assignedToId: other.id } })
  assert.equal((await listNotifications(user, null, db, since)).resume.newUnreadId, null)
  for (const invalid of ['garbage', '2026-99-99T00:00:00.000Z', "' OR true --", 'https://evil.test']) await assert.rejects(listNotifications(user, null, db, invalid))
})
