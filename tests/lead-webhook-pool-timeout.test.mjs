import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'
import { PrismaClient } from '@prisma/client'
import ts from 'typescript'

const databaseUrl = process.env.LEAD_WEBHOOK_POOL_TEST_DATABASE_URL

test('Lead-creating transactions bind billing reads to their transaction client', () => {
  const generic = fs.readFileSync('src/lib/leadWebhookHandler.ts', 'utf8')
  const metaMessages = fs.readFileSync('src/app/api/webhooks/meta/messages/[slug]/route.ts', 'utf8')
  const billing = fs.readFileSync('src/lib/billing.ts', 'utf8')
  assert.match(generic, /assertBillingLimit\(organization\.id, 'leads', 1, tx\)/)
  assert.match(metaMessages, /assertBillingLimit\(args\.organizationId, 'leads', 1, tx\)/)
  assert.match(billing, /getBillingSnapshot\(organizationId, db\)/)
})

function localTestDatabase(url) {
  if (!url) return false
  const parsed = new URL(url)
  return ['127.0.0.1', 'localhost'].includes(parsed.hostname)
    && parsed.pathname.includes('legalhub_webhook_qa')
}

const require = createRequire(import.meta.url)
function loader(db) {
  const cache = new Map()
  const overrides = {
    'src/lib/prisma': { prisma: db },
    'src/lib/assignmentDelivery': { dispatchAssignmentPush: async () => {} },
  }
  function load(file) {
    const normalized = file.replaceAll('\\', '/').replace(/\.(ts|js)$/, '')
    if (overrides[normalized]) return overrides[normalized]
    if (cache.has(normalized)) return cache.get(normalized)
    const filename = fs.existsSync(normalized + '.ts') ? normalized + '.ts' : normalized + '.js'
    if (filename.endsWith('.js')) return require(path.resolve(filename))
    const exports = {}
    cache.set(normalized, exports)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    new Function('require', 'exports', code)(id => id.startsWith('@/')
      ? load('src/' + id.slice(2))
      : id.startsWith('.')
        ? load(path.join(path.dirname(filename), id))
        : require(id), exports)
    return exports
  }
  return load
}

test('Lead webhook remains idempotent under a constrained connection pool', { skip: !databaseUrl }, async t => {
  assert.ok(localTestDatabase(databaseUrl), 'Only the isolated local webhook QA database is allowed')
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] })
  const handleLeadWebhookPost = loader(db)('src/lib/leadWebhookHandler').handleLeadWebhookPost

  const previousFlags = {
    notifications: process.env.NOTIFICATIONS_ENABLED,
    events: process.env.NOTIFICATION_EVENTS_ENABLED,
    orgs: process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS,
    users: process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS,
    scheduled: process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED,
  }
  const suffix = randomUUID()
  const org = await db.organization.create({
    data: {
      name: 'Webhook pool synthetic QA',
      slug: `webhook-pool-${suffix}`,
      plan: 'free',
      billingStatus: 'active',
      settings: { leadWebhookEnabled: true, leadWebhookKey: 'synthetic-webhook-key' },
    },
  })
  const other = await db.organization.create({
    data: { name: 'Webhook pool other tenant', slug: `webhook-pool-other-${suffix}` },
  })
  const makeUser = organizationId => db.user.create({
    data: {
      organizationId,
      email: `${randomUUID()}@example.test`,
      password: 'not-a-login-hash',
      name: 'Synthetic user',
      role: 'employee',
      restrictedAccess: true,
    },
  })
  const firstUser = await makeUser(org.id)
  const secondUser = await makeUser(org.id)
  const firstEmployee = await db.employee.create({ data: { organizationId: org.id, userId: firstUser.id, name: 'Synthetic employee A' } })
  const secondEmployee = await db.employee.create({ data: { organizationId: org.id, userId: secondUser.id, name: 'Synthetic employee B' } })
  const route = await db.leadChannelRoute.create({ data: { organizationId: org.id, sourceKey: 'website', employeeId: firstEmployee.id } })
  await db.leadChannelRouteMember.create({ data: { organizationId: org.id, routeId: route.id, employeeId: secondEmployee.id, position: 1 } })

  process.env.NOTIFICATIONS_ENABLED = 'true'
  process.env.NOTIFICATION_EVENTS_ENABLED = 'true'
  process.env.NOTIFICATION_EVENTS_PILOT_ORG_IDS = org.id
  process.env.NOTIFICATION_EVENTS_PILOT_USER_IDS = `${firstUser.id},${secondUser.id}`
  process.env.NOTIFICATION_SCHEDULED_EVENTS_ENABLED = 'false'

  t.after(async () => {
    for (const [key, value] of Object.entries(previousFlags)) {
      const env = { notifications: 'NOTIFICATIONS_ENABLED', events: 'NOTIFICATION_EVENTS_ENABLED', orgs: 'NOTIFICATION_EVENTS_PILOT_ORG_IDS', users: 'NOTIFICATION_EVENTS_PILOT_USER_IDS', scheduled: 'NOTIFICATION_SCHEDULED_EVENTS_ENABLED' }[key]
      if (value === undefined) delete process.env[env]
      else process.env[env] = value
    }
    await db.notification.deleteMany({ where: { organizationId: org.id } })
    await db.leadWebhookLog.deleteMany({ where: { organizationId: org.id } })
    await db.lead.deleteMany({ where: { organizationId: org.id } })
    await db.leadChannelRouteMember.deleteMany({ where: { organizationId: org.id } })
    await db.leadChannelRoute.deleteMany({ where: { organizationId: org.id } })
    await db.employee.deleteMany({ where: { organizationId: org.id } })
    await db.user.deleteMany({ where: { organizationId: org.id } })
    await db.organization.deleteMany({ where: { id: { in: [org.id, other.id] } } })
    await db.$disconnect()
  })

  const send = (eventId, fullName = 'Synthetic webhook lead') => handleLeadWebhookPost(
    new NextRequest('http://localhost/api/webhooks/leads/synthetic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, source: 'website', fullName }),
    }),
    org.slug,
    'synthetic-webhook-key',
  )

  await t.test('brief database latency waits without failing the webhook', async () => {
    const blocker = db.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT 1::int FROM pg_sleep(0.2)')
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    const response = await send(`latency-${suffix}`)
    await blocker
    assert.equal(response.status, 201)
  })

  await t.test('concurrent replay creates one Lead, one routing advance and one notification', async () => {
    const eventId = `replay-${suffix}`
    const responses = await Promise.all(Array.from({ length: 6 }, () => send(eventId)))
    assert.ok(responses.every(response => response.status === 201))
    const bodies = await Promise.all(responses.map(response => response.json()))
    assert.equal(new Set(bodies.map(body => body.leadId)).size, 1)
    const leadId = bodies[0].leadId
    assert.equal(await db.lead.count({ where: { organizationId: org.id, id: leadId } }), 1)
    assert.equal(await db.leadWebhookLog.count({ where: { organizationId: org.id, leadId, status: 'created' } }), 1)
    assert.equal(await db.notification.count({ where: { organizationId: org.id, entityId: leadId, type: 'lead_assigned' } }), 1)
    assert.equal(await db.lead.count({ where: { organizationId: other.id } }), 0)
  })

  await t.test('a distinct event advances round-robin once and replay does not advance it again', async () => {
    const eventId = `routing-${suffix}`
    const first = await send(eventId, 'Synthetic routed lead')
    assert.equal(first.status, 201)
    const firstBody = await first.json()
    assert.equal(firstBody.lead.assignedToId, firstUser.id)
    const cursorAfterCreate = (await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition

    const replay = await send(eventId, 'Changed replay payload')
    assert.equal(replay.status, 201)
    assert.equal((await replay.json()).leadId, firstBody.leadId)
    assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, cursorAfterCreate)
  })

  await t.test('invalid webhook key stays rejected without creating a Lead', async () => {
    const before = await db.lead.count({ where: { organizationId: org.id } })
    const response = await handleLeadWebhookPost(
      new NextRequest('http://localhost/api/webhooks/leads/synthetic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: `invalid-${suffix}`, source: 'website', fullName: 'Rejected synthetic lead' }),
      }),
      org.slug,
      'wrong-synthetic-key',
    )
    assert.equal(response.status, 401)
    assert.equal(await db.lead.count({ where: { organizationId: org.id } }), before)
  })
})
