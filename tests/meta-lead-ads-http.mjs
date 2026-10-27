import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'

if (!process.env.META_LEAD_ADS_SYNTHETIC_DB_TEST || !/^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\/meta_lead_ads_qa\?schema=public$/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Synthetic localhost database guard failed')
}
async function freePort() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
const db = new PrismaClient()
const suffix = randomUUID().slice(0, 8)
const org = await db.organization.create({ data: { name: 'Synthetic Lead Ads HTTP', slug: `synthetic-lead-http-${suffix}`,
  notificationAutomationEnabled: true, notificationAutomationActivatedAt: new Date(0) } })
const other = await db.organization.create({ data: { name: 'Synthetic Lead Ads Other', slug: `synthetic-lead-other-${suffix}` } })
const owner = await db.user.create({ data: { organizationId: org.id, email: `owner-${suffix}@example.invalid`, password: 'synthetic', name: 'Owner', role: 'owner' } })
const employeeUserA = await db.user.create({ data: { organizationId: org.id, email: `a-${suffix}@example.invalid`, password: 'synthetic', name: 'A', role: 'employee' } })
const employeeUserB = await db.user.create({ data: { organizationId: org.id, email: `b-${suffix}@example.invalid`, password: 'synthetic', name: 'B', role: 'employee' } })
const employeeA = await db.employee.create({ data: { organizationId: org.id, userId: employeeUserA.id, name: 'A' } })
const employeeB = await db.employee.create({ data: { organizationId: org.id, userId: employeeUserB.id, name: 'B' } })
const route = await db.leadChannelRoute.create({ data: { organizationId: org.id, sourceKey: 'facebook_lead_ads', employeeId: employeeA.id } })
// V2 compatibility trigger creates the first member from the legacy mirror.
await db.leadChannelRouteMember.create({ data: { organizationId: org.id, routeId: route.id, employeeId: employeeB.id, position: 1 } })
const instagramRoute = await db.leadChannelRoute.create({ data: { organizationId: org.id, sourceKey: 'instagram_lead_ads', employeeId: employeeB.id } })
const binding = await db.metaLeadAdsBinding.create({ data: {
  organizationId: org.id, appId: '123', pageId: '111', formId: '222', enabled: true, mode: 'pilot',
  activatedAt: new Date(Date.now() - 1000), pilotLeadIds: ['333', '334', '429', '500', '404', '555', '556'],
} })
const shadowBinding = await db.metaLeadAdsBinding.create({ data: {
  organizationId: other.id, appId: '123', pageId: '777', formId: '888', enabled: true, mode: 'shadow', activatedAt: new Date(Date.now() - 1000),
} })
const appSecret = 'synthetic-lead-ads-app-secret-1234567890'
const workerSecret = 'synthetic-lead-ads-worker-secret-1234567890'
const jwtSecret = 'synthetic-lead-ads-jwt-secret-1234567890'
const port = await freePort()
const base = `http://127.0.0.1:${port}`
const cleanEnv = Object.fromEntries(['PATH','Path','SystemRoot','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','COMSPEC'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
const mockPath = fileURLToPath(new URL('./meta-lead-ads-mock-fetch.cjs', import.meta.url))
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
  cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...cleanEnv,
    NODE_OPTIONS: `--require=${mockPath.replaceAll('\\', '/')}`,
    DATABASE_URL: process.env.DATABASE_URL, JWT_SECRET: jwtSecret, NEXT_TELEMETRY_DISABLED: '1',
    META_LEAD_ADS_APP_ID: '123', META_LEAD_ADS_APP_SECRET: appSecret,
    META_LEAD_ADS_VERIFY_TOKEN: 'synthetic-lead-ads-verify-token-1234567890',
    META_LEAD_ADS_RECEIPT_HMAC_KEY: 'synthetic-stable-receipt-hmac-key-1234567890',
    META_LEAD_ADS_PAGE_TOKEN_111: 'synthetic-page-token',
    META_LEAD_ADS_ENABLED: 'true', META_LEAD_ADS_WORKER_ENABLED: 'true',
    META_LEAD_ADS_ACTIVATED_AT: new Date(Date.now() - 60000).toISOString(),
    META_LEAD_ADS_WORKER_SECRET: workerSecret, META_LEAD_ADS_PILOT_ORGANIZATION_ID: org.id,
    NOTIFICATIONS_ENABLED: 'true', NOTIFICATION_EVENTS_ENABLED: 'true',
  },
})
let serverError = ''
child.stderr?.on('data', chunk => { serverError = (serverError + String(chunk)).slice(-4000) })

const event = (leadgenId, pageId = '111', formId = '222') => JSON.stringify({ object: 'page', entry: [{ id: pageId,
  changes: [{ field: 'leadgen', value: { page_id: pageId, form_id: formId, leadgen_id: leadgenId } }] }] })
async function webhook(body, secret = appSecret) {
  const signature = createHmac('sha256', secret).update(body).digest('hex')
  return fetch(`${base}/api/webhooks/meta/lead-ads`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${signature}` }, body })
}
async function worker(secret = workerSecret) {
  return fetch(`${base}/api/internal/meta-lead-ads`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
}
let passed = false
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Synthetic Next server exited: ${serverError.slice(-500)}`)
    try { const r = await fetch(`${base}/login`); if (r.status < 500) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.equal(ready, true, 'Synthetic Next server ready')
  assert.equal((await webhook(event('333'), 'wrong-app-secret')).status, 401)
  assert.equal((await webhook(event('333', '999'))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { appId: '123' } }), 0)
  const unknown = await webhook(event('999'))
  assert.equal(unknown.status, 200)
  assert.equal((await unknown.json()).rejected, 1)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { appId: '123' } }), 0)
  const first = await webhook(event('333'))
  assert.equal(first.status, 200)
  assert.equal((await first.json()).accepted, 1)
  const firstLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:333' } })
  assert.equal(firstLead?.source, 'facebook_lead_ads')
  assert.equal(firstLead?.employeeId, employeeA.id)
  assert.equal(firstLead?.assignedToId, employeeUserA.id)
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityType: 'lead', entityId: firstLead.id } }), 1)
  const replays = await Promise.all(Array.from({ length: 8 }, () => webhook(event('333'))))
  assert.ok(replays.every(response => response.status === 200))
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:333' } }), 1)
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityType: 'lead', entityId: firstLead.id } }), 1)
  const second = await webhook(event('334'))
  assert.equal(second.status, 200)
  const secondLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:334' } })
  assert.equal(secondLead?.source, 'instagram_lead_ads')
  assert.equal(secondLead?.employeeId, employeeB.id)
  assert.equal(secondLead?.assignedToId, employeeUserB.id)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: instagramRoute.id } })).nextPosition, 1)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, 1)
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => webhook(event('556'))))
  assert.ok(concurrent.every(response => response.status === 200))
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:556' } }), 1)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, 2)
  for (const id of ['429', '500']) {
    assert.equal((await webhook(event(id))).status, 200)
    const row = await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: id } })
    assert.equal(row?.status, 'pending')
    await db.metaLeadAdsDelivery.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } })
  }
  assert.equal((await worker('wrong')).status, 401)
  assert.equal((await worker()).status, 200)
  for (const id of ['429', '500']) {
    assert.equal((await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: id } }))?.status, 'complete')
    assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: `meta-lead-ads:${id}` } }), 1)
  }
  assert.equal((await webhook(event('404'))).status, 200)
  assert.equal((await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: '404' } }))?.status, 'blocked')
  assert.equal((await webhook(event('555'))).status, 200)
  assert.equal((await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:555' } }))?.source, 'meta_lead_ads_unknown')
  assert.equal((await webhook(event('999', '777', '888'))).status, 200)
  const shadow = await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: shadowBinding.id } })
  assert.equal(shadow?.status, 'shadow')
  assert.match(shadow?.leadgenId || '', /^shadow:[a-f0-9]{64}$/)
  assert.equal(await db.lead.count({ where: { organizationId: other.id } }), 0)
  await db.metaLeadAdsBinding.update({ where: { id: binding.id }, data: { enabled: false } })
  assert.equal((await webhook(event('999'))).status, 200)
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:999' } }), 0)
  const ownerToken = await new SignJWT({ id: owner.id, organizationId: org.id, role: 'owner', sessionVersion: 0 })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret))
  const settings = await fetch(`${base}/api/meta-lead-ads/bindings`, { headers: { Cookie: `auth-token=${ownerToken}` } })
  assert.equal(settings.status, 200)
  assert.equal((await settings.json()).bindings.length, 1)
  passed = true
  console.log('SYNTHETIC_HTTP PASS: HMAC, tenant binding, pilot, concurrent replay, routing, 429/5xx retry, 404, OFF, shadow, admin diagnostics')
} catch (error) {
  console.error('SYNTHETIC_HTTP FAIL:', error?.message || String(error))
  throw error
} finally {
  child.kill()
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
  await db.$disconnect()
  if (child.exitCode === null && child.signalCode === null) throw new Error(`Synthetic Next server did not stop: PID ${child.pid}`)
  if (!passed) console.error('SYNTHETIC_HTTP FAIL')
}
