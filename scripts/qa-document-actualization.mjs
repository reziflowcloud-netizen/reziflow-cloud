// Real PostgreSQL + real authenticated HTTP + real notification entry point, synthetic data only.
import assert from 'node:assert/strict'
import sourceEvidenceModule from './actualization-source-evidence.cjs'
const sourceEvidence = sourceEvidenceModule.sourceEvidence
import fs from 'node:fs/promises'
import { randomBytes, createECDH } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { request } from 'playwright'
import {
  actualizationTaskId,
  actualizationTasks,
  lockActualizationCase,
  syncDocumentActualization,
} from '../src/lib/documentActualization.ts'
import { actualizationDate, actualizationRef } from '../src/lib/documentActualizationPolicy.ts'
import { createCaseWithChecklist } from '../src/lib/documentChecklist.ts'
import { evaluateNotificationPage } from '../src/lib/notificationJobs.ts'
import { deliverNotificationPush, pushPayload } from '../src/lib/notificationPush.ts'
import { encryptSubscription, endpointHash, subscriptionAAD } from '../src/lib/pushSecurity.ts'
const url = new URL(process.env.DATABASE_URL || '')
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.port, '55435')
assert.equal(url.pathname, '/actualization_qa')
const db = new PrismaClient(),
  origin = 'http://127.0.0.1:3127',
  report = { checks: [], errors: [] },
  suffix = Date.now()
const run = async (name, fn) => {
  await fn()
  report.checks.push(name)
  console.log('PASS', name)
}
const sync = async (id, activate = false, lang = 'uk') =>
  db.$transaction(
    async (tx) => {
      const r = await tx.case.findUniqueOrThrow({ where: { id } })
      await lockActualizationCase(tx, r.organizationId, id)
      await syncDocumentActualization(
        tx,
        await tx.case.findUniqueOrThrow({ where: { id } }),
        activate,
        lang,
      )
    },
    { timeout: 15000 },
  )
const control = async (r) =>
  (await actualizationTasks(db, r.organizationId, r.id)).filter((t) => t.status === 'todo')
const getRecord = (id) =>
  db.case.findUniqueOrThrow({ where: { id }, include: { docUpdates: true } })
const contexts = []
async function main() {
  report.source = sourceEvidence()
  const org = await db.organization.create({
      data: { name: 'Synthetic Actualization QA', slug: 'actualization-' + suffix },
    }),
    foreign = await db.organization.create({
      data: { name: 'Synthetic Foreign QA', slug: 'actualization-foreign-' + suffix },
    })
  const password = randomBytes(24).toString('hex'),
    hash = await bcrypt.hash(password, 10)
  const mkUser = (name, organizationId, restrictedAccess = false) =>
    db.user.create({
      data: {
        name,
        email: `${name.toLowerCase()}-${suffix}@example.invalid`,
        password: hash,
        role: restrictedAccess ? 'employee' : 'owner',
        organizationId,
        restrictedAccess,
      },
    })
  const owner = await mkUser('Owner', org.id),
    staff = await mkUser('Staff', org.id, true),
    other = await mkUser('Other', foreign.id),
    employee = await db.employee.create({
      data: { organizationId: org.id, name: 'Synthetic Explicit Staff', userId: staff.id },
    })
  const client = await db.client.create({
    data: {
      organizationId: org.id,
      firstName: 'Synthetic',
      lastName: 'Actualization',
      assignedToId: owner.id,
    },
  })
  const newCase = (data = {}) =>
    db.case.create({
      data: {
        organizationId: org.id,
        clientId: client.id,
        assignedToId: owner.id,
        mosNumber: 'LEGACY-MOS',
        ...data,
      },
    })
  const ctx = await request.newContext()
  contexts.push(ctx)
  const login = async (c, u) =>
    assert.equal(
      (await c.post(origin + '/api/auth/login', { data: { email: u.email, password } })).status(),
      200,
    )
  await login(ctx, owner)
  const get = async (id, c = ctx) => {
    const res = await c.get(origin + '/api/cases/' + id)
    assert.equal(res.status(), 200)
    return res.json()
  }
  const patch = async (id, data, c = ctx) =>
    c.patch(origin + '/api/cases/' + id, {
      headers: { 'X-LegalHub-Case-Write': 'versioned' },
      data,
    })
  const doc = async (id, date, description, extra = {}, c = ctx) =>
    c.post(origin + '/api/cases/' + id + '/doc-updates', { data: { date, description, ...extra } })
  let r = await newCase({ predictedDecisionDate: new Date('2026-01-01') })
  await run(
    'legacy GET, no-op/unrelated autosave and MOS service add/delete never activate',
    async () => {
      assert.equal((await get(r.id)).documentActualization.state, 'inactive')
      await sync(r.id)
      assert.equal((await control(r)).length, 0)
      let loaded = await get(r.id)
      assert.equal(
        (
          await patch(r.id, {
            notes: 'Unrelated',
            predictedDecisionDate: loaded.predictedDecisionDate,
            decisionReceived: false,
            expectedUpdatedAt: loaded.updatedAt,
          })
        ).status(),
        200,
      )
      const service = await doc(r.id, '2026-12-01', '__MOS_ID__:synthetic')
      assert.equal(service.status(), 200)
      const serviceId = (await service.json()).id
      assert.equal(
        (await ctx.delete(origin + `/api/cases/${r.id}/doc-updates/${serviceId}`)).status(),
        200,
      )
      assert.equal((await control(r)).length, 0)
    },
  )
  await run(
    'new Case creates control without notification master/push; new no-date Case has none',
    async () => {
      const created = await db.$transaction((tx) =>
        createCaseWithChecklist(tx, {
          organizationId: org.id,
          clientId: client.id,
          assignedToId: owner.id,
          predictedDecisionDate: new Date('2026-01-01'),
        }),
      )
      assert.equal((await control(created)).length, 1)
      const res = await ctx.post(origin + '/api/cases', {
        data: { clientId: client.id, caseNumber: 'SYNTHETIC-NEW-' + suffix },
      })
      assert.equal(res.status(), 200)
      const noDate = await res.json()
      assert.equal((await control(noDate)).length, 0)
      assert.equal((await get(noDate.id)).documentActualization.state, 'noDate')
    },
  )
  await run(
    'genuine POST replay/date tie/concurrent writes serialize to one current cycle',
    async () => {
      const replies = await Promise.all(
        Array.from({ length: 8 }, () => doc(r.id, '2026-03-01', 'Same actualization')),
      )
      for (const res of replies) assert.equal(res.status(), 200)
      assert.equal(
        new Set(await Promise.all(replies.map((x) => x.json().then((d) => d.id)))).size,
        1,
      )
      assert.equal(
        await db.docUpdate.count({ where: { caseId: r.id, description: 'Same actualization' } }),
        1,
      )
      assert.equal((await doc(r.id, '2026-03-01', 'Different description same date')).status(), 200)
      assert.equal((await control(r)).length, 1)
      const concurrent = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          doc(r.id, `2026-04-${String(i + 1).padStart(2, '0')}`, 'Concurrent ' + i),
        ),
      )
      for (const res of concurrent) assert.equal(res.status(), 200)
      const active = await control(r)
      assert.equal(active.length, 1)
      assert.equal(actualizationRef(active[0]).cycle, actualizationDate(await getRecord(r.id)))
    },
  )
  await run(
    'latest correction/delete fallback and A→B→A reuse original task; completed cycle never recreated',
    async () => {
      const a = await newCase({ predictedDecisionDate: new Date('2026-01-01') })
      await sync(a.id, true)
      const first = (await control(a))[0],
        post = await doc(a.id, '2026-03-01', 'Latest')
      assert.equal(post.status(), 200)
      const d = await post.json()
      assert.notEqual((await control(a))[0].id, first.id)
      assert.equal(
        (
          await ctx.patch(origin + `/api/cases/${a.id}/doc-updates/${d.id}`, {
            data: { date: '2026-04-01', description: 'Corrected' },
          })
        ).status(),
        200,
      )
      assert.equal(actualizationRef((await control(a))[0]).cycle, '2026-06-30')
      assert.equal(
        (await ctx.delete(origin + `/api/cases/${a.id}/doc-updates/${d.id}`)).status(),
        200,
      )
      assert.equal((await control(a))[0].id, first.id)
      const complete = await ctx.patch(origin + '/api/tasks/' + first.id, {
        data: {
          status: 'done',
          expectedUpdatedAt: (
            await db.task.findUniqueOrThrow({ where: { id: first.id } })
          ).updatedAt.toISOString(),
        },
      })
      assert.equal(complete.status(), 200)
      await sync(a.id, true)
      assert.equal((await control(a)).length, 0)
      assert.equal((await db.task.findUniqueOrThrow({ where: { id: first.id } })).status, 'done')
      assert.equal(await db.docUpdate.count({ where: { caseId: a.id } }), 0)
      const b = await doc(a.id, '2026-05-01', 'Next cycle')
      const bid = (await b.json()).id
      await ctx.delete(origin + `/api/cases/${a.id}/doc-updates/${bid}`)
      assert.equal((await control(a)).length, 0)
    },
  )
  await run(
    'description-only historical correction stays inactive; invalid/null/service/offsetless inputs do not mutate',
    async () => {
      const legacy = await newCase(),
        entry = await db.docUpdate.create({
          data: {
            caseId: legacy.id,
            date: new Date('2026-03-29T23:30:00Z'),
            description: 'Old timestamp',
          },
        })
      assert.equal(
        (
          await ctx.patch(origin + `/api/cases/${legacy.id}/doc-updates/${entry.id}`, {
            data: { date: entry.date.toISOString(), description: 'Description correction' },
          })
        ).status(),
        200,
      )
      assert.equal((await control(legacy)).length, 0)
      for (const date of ['2026-02-30', 'not a date', '2026-03-29T23:30:00'])
        assert.equal((await doc(legacy.id, date, 'Invalid')).status(), 400)
      for (const body of [null, [], 1, 'bad'])
        assert.equal(
          (await ctx.post(origin + `/api/cases/${legacy.id}/doc-updates`, { data: body })).status(),
          400,
        )
      assert.equal(await db.docUpdate.count({ where: { caseId: legacy.id } }), 1)
    },
  )
  await run(
    'stale Case and child CAS reject atomically; transaction rollback preserves dates/tasks',
    async () => {
      const a = await newCase(),
        loaded = await get(a.id)
      assert.equal(
        (
          await patch(a.id, {
            predictedDecisionDate: '2026-01-01',
            expectedUpdatedAt: loaded.updatedAt,
          })
        ).status(),
        200,
      )
      assert.equal(
        (
          await patch(a.id, { decisionReceived: true, expectedUpdatedAt: loaded.updatedAt })
        ).status(),
        409,
      )
      assert.equal(
        (await doc(a.id, '2026-02-01', 'Stale', { expectedUpdatedAt: loaded.updatedAt })).status(),
        409,
      )
      assert.equal(await db.docUpdate.count({ where: { caseId: a.id } }), 0)
      const before = await db.task.count({ where: { organizationId: org.id } })
      await assert.rejects(
        db.$transaction(async (tx) => {
          await lockActualizationCase(tx, org.id, a.id)
          const changed = await tx.case.update({
            where: { id: a.id },
            data: { predictedDecisionDate: new Date('2027-01-01') },
          })
          await syncDocumentActualization(tx, changed, true)
          throw Error('intentional rollback')
        }),
      )
      assert.equal(await db.task.count({ where: { organizationId: org.id } }), before)
      assert.equal(
        (await getRecord(a.id)).predictedDecisionDate.toISOString().slice(0, 10),
        '2026-01-01',
      )
    },
  )
  await run(
    'concurrent Case/DocUpdate mutation and completion do not deadlock or duplicate controls',
    async () => {
      const a = await newCase({ predictedDecisionDate: new Date('2026-01-01') })
      await sync(a.id, true)
      const loaded = await get(a.id)
      const responses = await Promise.all([
        patch(a.id, { predictedDecisionDate: '2026-02-01', expectedUpdatedAt: loaded.updatedAt }),
        doc(a.id, '2026-03-01', 'Race', { expectedUpdatedAt: loaded.updatedAt }),
      ])
      assert.deepEqual(responses.map((x) => x.status()).sort(), [200, 409])
      assert.equal((await control(a)).length, 1)
      const task = (await control(a))[0]
      await Promise.all([
        sync(a.id, true),
        ctx.patch(origin + '/api/tasks/' + task.id, { data: { status: 'done' } }),
      ])
      assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status, 'done')
    },
  )
  await run(
    'managed Task metadata/date/ownership/delete cannot be forged/detached; manual Task unchanged',
    async () => {
      const task = (await control(r))[0]
      for (const data of [
        { description: 'detached' },
        { dueDate: '2030-01-01' },
        { assignedToId: staff.id },
        { title: 'Arbitrary name' },
      ])
        assert.equal((await ctx.patch(origin + '/api/tasks/' + task.id, { data })).status(), 409)
      assert.equal((await ctx.delete(origin + '/api/tasks/' + task.id)).status(), 409)
      const metadata = JSON.stringify({
        documentActualization: { version: 1, caseId: r.id, cycle: '2026-04-01' },
      })
      assert.equal(
        (
          await ctx.post(origin + '/api/tasks', {
            data: { title: 'Forged', description: metadata },
          })
        ).status(),
        400,
      )
      const manual = await db.task.create({
        data: {
          organizationId: org.id,
          title: 'Manual retained',
          description: 'Unrelated',
          assignedToId: owner.id,
        },
      })
      assert.equal(
        (
          await ctx.patch(origin + '/api/tasks/' + manual.id, { data: { description: metadata } })
        ).status(),
        400,
      )
      assert.equal(
        (await db.task.findUniqueOrThrow({ where: { id: manual.id } })).description,
        'Unrelated',
      )
    },
  )
  await run(
    'explicit ownership, restricted Case/Task visibility, Staff Scope and tenant isolation',
    async () => {
      const own = await newCase({
        assignedToId: staff.id,
        employeeId: employee.id,
        predictedDecisionDate: new Date('2026-01-01'),
      })
      await sync(own.id, true, 'pl')
      const task = (await control(own))[0]
      assert.equal(task.assignedToId, staff.id)
      assert.equal(task.title, 'Zaktualizować dokumenty')
      const staffCtx = await request.newContext(),
        otherCtx = await request.newContext()
      contexts.push(staffCtx, otherCtx)
      await login(staffCtx, staff)
      await login(otherCtx, other)
      assert.equal((await get(own.id, staffCtx)).id, own.id)
      assert.equal((await staffCtx.get(origin + '/api/tasks/' + task.id)).status(), 200)
      const list = await (await staffCtx.get(origin + '/api/tasks?staffScope=mine')).json()
      assert.ok(list.some((t) => t.id === task.id))
      assert.equal((await staffCtx.get(origin + '/api/cases/' + r.id)).status(), 404)
      assert.equal((await doc(r.id, '2026-01-01', 'Denied', {}, staffCtx)).status(), 404)
      assert.equal((await otherCtx.get(origin + '/api/tasks/' + task.id)).status(), 404)
      assert.equal((await doc(own.id, '2026-01-01', 'Foreign', {}, otherCtx)).status(), 404)
      const mismatch = await newCase({
        assignedToId: owner.id,
        employeeId: employee.id,
        predictedDecisionDate: new Date('2026-01-01'),
      })
      await sync(mismatch.id, true)
      assert.equal((await control(mismatch))[0].assignedToId, null)
    },
  )
  // Existing notification pipeline; all flags/preferences/fixtures here belong only to isolated DB/process.
  Object.assign(process.env, {
    NOTIFICATIONS_ENABLED: 'true',
    NOTIFICATION_EVENTS_ENABLED: 'true',
    NOTIFICATION_SCHEDULED_EVENTS_ENABLED: 'true',
  })
  const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    now = new Date(today + 'T18:00:00Z'),
    base = new Date(today + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() - 90)
  const ncase = await newCase({ predictedDecisionDate: base })
  await sync(ncase.id, true)
  const ntask = (await control(ncase))[0]
  await run(
    'task exists master OFF; scheduler does not notify or backfill legacy Cases',
    async () => {
      assert.ok(ntask)
      assert.equal(
        (await evaluateNotificationPage({ kind: 'task', after: '' }, now, db)).notificationsCreated,
        0,
      )
      assert.equal(await db.notification.count({ where: { entityId: ntask.id } }), 0)
      assert.equal((await control(r)).length, 1)
    },
  )
  const since = new Date(now.getTime() - 7 * 86400000)
  await db.organization.update({
    where: { id: org.id },
    data: { notificationAutomationEnabled: true, notificationAutomationActivatedAt: since },
  })
  await run(
    'scheduler repeat/concurrent runs dedupe without subscriptions; no historical catchup',
    async () => {
      const results = await Promise.all([
        evaluateNotificationPage({ kind: 'task', after: '' }, now, db),
        evaluateNotificationPage({ kind: 'task', after: '' }, now, db),
      ])
      assert.equal(
        results.reduce((n, r) => n + r.notificationsCreated, 0),
        1,
      )
      assert.equal(await db.notification.count({ where: { entityId: ntask.id } }), 1)
      assert.equal(
        await db.notificationPushDelivery.count({
          where: { notification: { entityId: ntask.id } },
        }),
        0,
      )
      assert.equal(
        (await evaluateNotificationPage({ kind: 'task', after: '' }, now, db)).notificationsCreated,
        0,
      )
      const old = await newCase({ predictedDecisionDate: new Date('2020-01-01') })
      await sync(old.id, true)
      assert.equal((await control(old)).length, 1)
      await evaluateNotificationPage({ kind: 'task', after: '' }, now, db)
      assert.equal(
        await db.notification.count({ where: { entityId: (await control(old))[0].id } }),
        0,
      )
    },
  )
  const pair = createECDH('prime256v1')
  pair.generateKeys()
  Object.assign(process.env, {
    WEB_PUSH_ENABLED: 'true',
    PUSH_ENVIRONMENT: 'development',
    VAPID_PUBLIC_KEY: pair.getPublicKey().toString('base64url'),
    VAPID_PRIVATE_KEY: pair.getPrivateKey().toString('base64url'),
    VAPID_SUBJECT: 'mailto:synthetic@example.invalid',
    PUSH_SUBSCRIPTION_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  })
  const raw = {
      endpoint: 'https://web.push.apple.com/synthetic-' + suffix,
      keys: {
        p256dh: pair.getPublicKey().toString('base64url'),
        auth: randomBytes(16).toString('base64url'),
      },
    },
    binding = { organizationId: org.id, userId: owner.id, endpointHash: endpointHash(raw.endpoint) }
  const sub = await db.pushSubscription.create({
    data: {
      ...binding,
      encryptedSubscription: encryptSubscription(raw, subscriptionAAD(binding)),
      deviceLabel: 'Synthetic device',
    },
  })
  const preference = await db.notificationPreference.create({
    data: {
      organizationId: org.id,
      userId: owner.id,
      language: 'pl',
      pushEnabled: true,
      showClientName: false,
    },
  })
  const queue = async (
    task,
    type = 'task_due',
    occurrence = today + ':' + new Date(new Date(today + 'T09:00:00+02:00')).toISOString(),
  ) => {
    // Use the canonical pure policy for the actual Warsaw offset on this date.
    const { taskOccurrences } = await import('../src/lib/notificationPolicy.ts')
    const event = taskOccurrences(task, now)[0]
    assert.ok(event)
    const n = await db.notification.create({
      data: {
        organizationId: org.id,
        userId: owner.id,
        type: event.type,
        title: 'Synthetic due',
        body: 'Synthetic only',
        entityType: 'task',
        entityId: task.id,
        deepLink: '/tasks?notificationTask=' + task.id,
        dedupeKey: `${event.type}:task:${task.id}:${event.occurrence}:qa-${Date.now()}-${Math.random()}`,
        pushRequested: true,
      },
    })
    // Canonical occurrence required by delivery actionability.
    await db.notification.update({
      where: { id: n.id },
      data: { dedupeKey: `${event.type}:task:${task.id}:${event.occurrence}` },
    })
    const delivery = await db.notificationPushDelivery.create({
      data: {
        notificationId: n.id,
        subscriptionId: sub.id,
        organizationId: org.id,
        userId: owner.id,
      },
    })
    return { n, delivery }
  }
  let sends = 0
  await run(
    'REAL deliverNotificationPush sends valid managed Task with scoped org, privacy and repeat protection',
    async () => {
      const c = await newCase({ predictedDecisionDate: base })
      await sync(c.id, true)
      const t = (await control(c))[0]
      const queued = await queue(t)
      const result = await deliverNotificationPush(
        db,
        async (_s, payload) => {
          sends++
          assert.ok(!payload.includes('Synthetic Actualization'))
          assert.ok(JSON.parse(payload).body.includes('Otwórz'))
        },
        now,
      )
      assert.equal(result.delivered, 1)
      assert.equal(sends, 1)
      assert.ok(
        (await db.notificationPushDelivery.findUniqueOrThrow({ where: { id: queued.delivery.id } }))
          .deliveredAt,
      )
      assert.equal(
        (
          await deliverNotificationPush(
            db,
            async () => {
              sends++
            },
            now,
          )
        ).delivered,
        0,
      )
    },
  )
  await run(
    'receipt stop/resume and reschedule cancel queued/retry outbox; real entry point never sends stale cycle',
    async () => {
      const c = await newCase({ predictedDecisionDate: base })
      await sync(c.id, true)
      const t = (await control(c))[0],
        queued = await queue(t)
      const loaded = await get(c.id)
      assert.equal(
        (
          await patch(c.id, { decisionReceived: true, expectedUpdatedAt: loaded.updatedAt })
        ).status(),
        200,
      )
      assert.equal((await control(c)).length, 0)
      assert.ok(
        (await db.notificationPushDelivery.findUniqueOrThrow({ where: { id: queued.delivery.id } }))
          .terminalAt,
      )
      assert.equal(
        (
          await deliverNotificationPush(
            db,
            async () => {
              sends++
            },
            now,
          )
        ).delivered,
        0,
      )
      const fresh = await get(c.id)
      await patch(c.id, { decisionReceived: false, expectedUpdatedAt: fresh.updatedAt })
      assert.equal((await control(c))[0].id, t.id)
      await evaluateNotificationPage({ kind: 'task', after: '' }, now, db)
      assert.equal(await db.notification.count({ where: { entityId: t.id } }), 1)
      const c2 = await newCase({ predictedDecisionDate: base })
      await sync(c2.id, true)
      const t2 = (await control(c2))[0],
        q2 = await queue(t2)
      await doc(c2.id, today, 'Reschedule beyond today')
      assert.ok(
        (await db.notificationPushDelivery.findUniqueOrThrow({ where: { id: q2.delivery.id } }))
          .terminalAt,
      )
      assert.equal(
        (
          await deliverNotificationPush(
            db,
            async () => {
              sends++
            },
            now,
          )
        ).delivered,
        0,
      )
      assert.equal(sends, 1)
    },
  )
  await run(
    'fresh completion after early delivery checks suppresses real entry point; preferences/master/push opt-out honored',
    async () => {
      const c = await newCase({ predictedDecisionDate: base })
      await sync(c.id, true)
      const t = (await control(c))[0]
      await queue(t)
      let intercepted = false
      const proxy = new Proxy(db, {
        get(target, key) {
          if (key === '$transaction')
            return async (fn, options) => {
              if (!intercepted) {
                intercepted = true
                await db.task.update({ where: { id: t.id }, data: { status: 'done' } })
              }
              return db.$transaction(fn, options)
            }
          const v = target[key]
          return typeof v === 'function' ? v.bind(target) : v
        },
      })
      assert.equal(
        (
          await deliverNotificationPush(
            proxy,
            async () => {
              sends++
            },
            now,
          )
        ).delivered,
        0,
      )
      assert.ok(intercepted)
      assert.equal(sends, 1)
      const c2 = await newCase({ predictedDecisionDate: base })
      await sync(c2.id, true)
      const t2 = (await control(c2))[0]
      await queue(t2)
      await db.notificationPreference.update({
        where: { id: preference.id },
        data: { pushEnabled: false },
      })
      assert.equal(
        (
          await deliverNotificationPush(
            db,
            async () => {
              sends++
            },
            now,
          )
        ).delivered,
        0,
      )
      const c3 = await newCase({ predictedDecisionDate: base })
      await sync(c3.id, true)
      const t3 = (await control(c3))[0]
      await queue(t3)
      await db.notificationPreference.update({
        where: { id: preference.id },
        data: { pushEnabled: true },
      })
      await db.organization.update({
        where: { id: org.id },
        data: { notificationAutomationEnabled: false },
      })
      assert.equal(
        (
          await deliverNotificationPush(
            db,
            async () => {
              sends++
            },
            now,
          )
        ).delivered,
        0,
      )
      assert.equal(sends, 1)
    },
  )
  assert.deepEqual(sourceEvidence(), report.source)
  report.runnerSha256 = (await import('node:crypto'))
    .createHash('sha256')
    .update(await fs.readFile(new URL(import.meta.url)))
    .digest('hex')
  report.result = 'PASS'
  await fs.mkdir('work/actualization-evidence', { recursive: true })
  await fs.writeFile(
    'work/actualization-evidence/integration.json',
    JSON.stringify(report, null, 2),
  )
  console.log('PASS integration groups', report.checks.length)
}
try {
  await main()
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await Promise.all(contexts.map((c) => c.dispose()))
  await db.$disconnect()
}
