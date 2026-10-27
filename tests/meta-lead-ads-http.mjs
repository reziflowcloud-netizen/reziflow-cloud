import assert from 'node:assert/strict'
import { createHash, createHmac, randomUUID } from 'node:crypto'
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
  notificationAutomationEnabled: true, notificationAutomationActivatedAt: new Date(0),
  settings: { leadWebhookKey: 'synthetic-legacy-webhook-key', leadWebhookEnabled: true } } })
const other = await db.organization.create({ data: { name: 'Synthetic Lead Ads Other', slug: `synthetic-lead-other-${suffix}` } })
const live = await db.organization.create({ data: { name: 'Synthetic Lead Ads Live', slug: `synthetic-lead-live-${suffix}` } })
const owner = await db.user.create({ data: { organizationId: org.id, email: `owner-${suffix}@example.invalid`, password: 'synthetic', name: 'Owner', role: 'owner' } })
const otherOwner = await db.user.create({ data: { organizationId: other.id, email: `other-${suffix}@example.invalid`, password: 'synthetic', name: 'Other Owner', role: 'owner' } })
const liveOwner = await db.user.create({ data: { organizationId: live.id, email: `live-${suffix}@example.invalid`, password: 'synthetic', name: 'Live Owner', role: 'owner' } })
const liveEmployee = await db.employee.create({ data: { organizationId: live.id, userId: liveOwner.id, name: 'Live Employee' } })
await db.leadChannelRoute.create({ data: { organizationId: live.id, sourceKey: 'facebook_lead_ads', employeeId: liveEmployee.id } })
const employeeUserA = await db.user.create({ data: { organizationId: org.id, email: `a-${suffix}@example.invalid`, password: 'synthetic', name: 'A', role: 'employee' } })
const employeeUserB = await db.user.create({ data: { organizationId: org.id, email: `b-${suffix}@example.invalid`, password: 'synthetic', name: 'B', role: 'employee' } })
await db.notificationPreference.create({ data: { organizationId: org.id, userId: employeeUserB.id,
  events: { lead_assigned: { inApp: false, push: false } } } })
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
const token111 = 'synthetic-page-token'
const token777 = 'synthetic-shadow-page-token'
const approved = (pageId, formId, organizationId, token) => ({ appId: '123', pageId, formId, organizationId,
  tokenSha256: createHash('sha256').update(token).digest('hex'), tokenAppId: '123', tokenPageId: pageId,
  formPageId: pageId, verifiedAt: new Date(Date.now() - 1000).toISOString() })
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
    META_LEAD_ADS_PAGE_TOKEN_111: token111, META_LEAD_ADS_PAGE_TOKEN_777: token777,
    META_LEAD_ADS_APPROVED_TUPLES: JSON.stringify([approved('111', '222', org.id, token111),
      approved('111', '223', org.id, token111),
      approved('111', '227', org.id, token111),
      approved('111', '225', live.id, token111),
      { ...approved('111', '224', org.id, token111), tokenAppId: '999' },
      approved('777', '888', other.id, token777)]),
    META_LEAD_ADS_SHADOW_ORGANIZATION_IDS: other.id,
    META_LEAD_ADS_LIVE_ORGANIZATION_IDS: live.id,
    META_LEAD_ADS_ENABLED: 'true', META_LEAD_ADS_WORKER_ENABLED: 'true',
    META_LEAD_ADS_ACTIVATED_AT: new Date(Date.now() - 60000).toISOString(),
    META_LEAD_ADS_WORKER_SECRET: workerSecret, META_LEAD_ADS_PILOT_ORGANIZATION_ID: org.id,
    META_LEAD_ADS_RETENTION_ORGANIZATION_IDS: org.id, META_LEAD_ADS_RETENTION_ENABLED: 'true',
    NOTIFICATIONS_ENABLED: 'true', NOTIFICATION_EVENTS_ENABLED: 'true',
  },
})
let serverError = ''
child.stderr?.on('data', chunk => { serverError = (serverError + String(chunk)).slice(-4000) })

const event = (leadgenId, pageId = '111', formId = '222') => JSON.stringify({ object: 'page', entry: [{ id: pageId,
  changes: [{ field: 'leadgen', value: { page_id: pageId, form_id: formId, leadgen_id: leadgenId } }] }] })
const batch = (ids, separateEntries = false) => JSON.stringify({ object: 'page', entry: separateEntries
  ? ids.map(leadgenId => ({ id: '111', changes: [{ field: 'leadgen', value: {
    page_id: '111', form_id: '222', leadgen_id: leadgenId } }] }))
  : [{ id: '111', changes: ids.map(leadgenId => ({ field: 'leadgen', value: {
    page_id: '111', form_id: '222', leadgen_id: leadgenId } })) }] })
async function webhook(body, secret = appSecret) {
  const signature = createHmac('sha256', secret).update(body).digest('hex')
  return fetch(`${base}/api/webhooks/meta/lead-ads`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${signature}` }, body })
}
async function worker(secret = workerSecret) {
  return fetch(`${base}/api/internal/meta-lead-ads`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
}
async function signedUser(user, organizationId, role = user.role) {
  return new SignJWT({ id: user.id, organizationId, role, sessionVersion: 0 })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(jwtSecret))
}
async function bindings(method, token, body, origin = base) {
  return fetch(`${base}/api/meta-lead-ads/bindings`, { method,
    headers: { Cookie: `auth-token=${token}`, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body) })
}
async function retention(body, confirm = false) {
  return fetch(`${base}/api/internal/meta-lead-ads/retention`, { method: 'POST',
    headers: { Authorization: `Bearer ${workerSecret}`, 'Content-Type': 'application/json',
      ...(confirm ? { 'X-Meta-Lead-Ads-Retention-Confirm': 'APPLY_TERMINAL_RETENTION' } : {}) },
    body: JSON.stringify(body) })
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
  const ownerToken = await signedUser(owner, org.id)
  const otherToken = await signedUser(otherOwner, other.id)
  const liveToken = await signedUser(liveOwner, live.id)
  const employeeToken = await signedUser(employeeUserA, org.id)
  const proposed = { pageId: '111', formId: '223', enabled: false, mode: 'off', pilotLeadIds: [] }
  assert.equal((await bindings('POST', otherToken, proposed)).status, 403)
  assert.equal((await bindings('POST', employeeToken, proposed)).status, 403)
  assert.equal((await bindings('POST', ownerToken, proposed, 'https://evil.invalid')).status, 403)
  assert.equal((await bindings('POST', ownerToken, { ...proposed, formId: '224' })).status, 403)
  assert.equal((await bindings('POST', ownerToken, { ...proposed, formId: 'invalid' })).status, 400)
  const reservations = await Promise.all([bindings('POST', ownerToken, proposed), bindings('POST', otherToken, proposed)])
  assert.deepEqual(reservations.map(row => row.status), [200, 403])
  const authorizedBindingId = (await reservations[0].json()).id
  assert.equal((await bindings('POST', ownerToken, proposed)).status, 409)
  assert.equal((await bindings('PUT', otherToken, { id: authorizedBindingId, mode: 'pilot', enabled: true, pilotLeadIds: ['995'] })).status, 404)
  assert.equal((await bindings('PUT', ownerToken, { id: authorizedBindingId, mode: 'pilot', enabled: true, pilotLeadIds: ['995'] })).status, 200)
  const raceCreate = await bindings('POST', ownerToken, { pageId: '111', formId: '227', mode: 'pilot', enabled: true,
    pilotLeadIds: ['9981', '9982'] })
  assert.equal(raceCreate.status, 200)
  const raceBindingId = (await raceCreate.json()).id
  const liveCreate = await bindings('POST', liveToken, { pageId: '111', formId: '225', mode: 'live', enabled: true, pilotLeadIds: [] })
  assert.equal(liveCreate.status, 200)
  const liveBindingId = (await liveCreate.json()).id
  const liveResponse = await webhook(event('997', '111', '225'))
  assert.equal(liveResponse.status, 200)
  const liveReceipt = await liveResponse.json()
  const liveLead = await db.lead.findFirst({ where: { organizationId: live.id, messengerId: 'meta-lead-ads:997' } })
  assert.equal(liveLead?.assignedToId, liveOwner.id, `Live Lead status: ${JSON.stringify({ response: liveReceipt, delivery: await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: liveBindingId }, select: { status: true, attempts: true, lastErrorCode: true, nextAttemptAt: true } }) })}`)
  assert.equal(await db.notification.count({ where: { organizationId: live.id, entityId: liveLead.id } }), 0)
  assert.equal((await webhook(event('333'), 'wrong-app-secret')).status, 401)
  assert.equal((await webhook(event('333', '999'))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id } }), 0)
  const unknown = await webhook(event('999'))
  assert.equal(unknown.status, 200)
  assert.equal((await unknown.json()).rejected, 1)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id } }), 0)
  const first = await webhook(event('333'))
  assert.equal(first.status, 200)
  assert.equal((await first.json()).accepted, 1)
  const firstLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:333' } })
  assert.equal(firstLead?.source, 'facebook_lead_ads', `First Lead status: ${JSON.stringify(await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: binding.id }, select: { status: true, lastErrorCode: true } }))}`)
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
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityType: 'lead', entityId: secondLead.id } }), 0)
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
  const missingGraphLead = await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: '404' }, select: { status: true, lastErrorCode: true } })
  if (missingGraphLead?.status !== 'blocked') console.error('GRAPH_404_STATUS', missingGraphLead)
  assert.equal(missingGraphLead?.status, 'blocked')
  assert.equal((await webhook(event('555'))).status, 200)
  const unknownPlatformLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:555' } })
  if (!unknownPlatformLead) console.error('UNKNOWN_PLATFORM_STATUS', await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: '555' }, select: { status: true, lastErrorCode: true } }))
  assert.equal(unknownPlatformLead?.source, 'meta_lead_ads_unknown')
  const batchIds = Array.from({ length: 30 }, (_, index) => String(1001 + index))
  await db.metaLeadAdsBinding.update({ where: { id: binding.id }, data: {
    pilotLeadIds: ['333', '334', '429', '500', '404', '555', '556', ...batchIds, '2001', '2002', '2003', '4001', '4002', '4003', '4004'],
  } })
  const twentyOne = await webhook(batch(batchIds.slice(0, 21)))
  assert.equal(twentyOne.status, 200)
  assert.equal((await twentyOne.json()).accepted, 21)
  const thirty = await webhook(batch(batchIds, true))
  assert.equal(thirty.status, 200)
  assert.equal((await thirty.json()).accepted, 9)
  const mixed = JSON.stringify({ object: 'page', entry: [
    { id: '111', changes: [{ field: 'leadgen', value: { page_id: '111', form_id: '222', leadgen_id: '1001' } },
      { field: 'leadgen', value: { page_id: '999', form_id: '222', leadgen_id: '1002' } }] },
    { id: 'invalid', changes: [{ field: 'leadgen', value: { form_id: '222', leadgen_id: '1003' } }] },
  ] })
  const mixedResponse = await webhook(mixed)
  assert.equal(mixedResponse.status, 200)
  assert.ok((await mixedResponse.json()).rejected >= 2)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id, leadgenId: { in: batchIds } } }), 30)
  await db.$executeRawUnsafe(`CREATE FUNCTION meta_qa_fail_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."leadgenId" = '2003' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`)
  await db.$executeRawUnsafe('CREATE TRIGGER meta_qa_fail_delivery BEFORE INSERT ON "MetaLeadAdsDelivery" FOR EACH ROW EXECUTE FUNCTION meta_qa_fail_delivery()')
  assert.equal((await webhook(batch(['2001', '2002', '2003']))).status, 503)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id, leadgenId: { in: ['2001', '2002'] } } }), 2)
  await db.$executeRawUnsafe('DROP TRIGGER meta_qa_fail_delivery ON "MetaLeadAdsDelivery"')
  await db.$executeRawUnsafe('DROP FUNCTION meta_qa_fail_delivery()')
  assert.equal((await webhook(batch(['2001', '2002', '2003']))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id, leadgenId: { in: ['2001', '2002', '2003'] } } }), 3)
  for (let attempt = 0; attempt < 20; attempt++) {
    const remaining = await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id,
      leadgenId: { in: [...batchIds, '2001', '2002', '2003'] }, status: 'pending' } })
    if (!remaining) break
    assert.equal((await worker()).status, 200)
  }
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id,
    leadgenId: { in: [...batchIds, '2001', '2002', '2003'] }, status: 'complete' } }), 33)
  for (const leadgenId of [...batchIds, '2001', '2002', '2003']) {
    assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: `meta-lead-ads:${leadgenId}` } }), 1)
  }
  const receiptKey = 'synthetic-stable-receipt-hmac-key-1234567890'
  const receiptFingerprint = id => createHmac('sha256', receiptKey).update(`123:${id}`).digest('hex')
  const expiredLease = new Date(Date.now() - 1000)
  const recovering = await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: binding.id, leadgenId: '333' } })
  await db.metaLeadAdsDelivery.update({ where: { id: recovering.id }, data: {
    status: 'processing', attempts: 8, leaseUntil: expiredLease, leadId: null } })
  const cursorBeforeRecovery = (await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition
  const noticesBeforeRecovery = await db.notification.count({ where: { organizationId: org.id, entityId: firstLead.id } })
  for (const [id, attempts] of [['4001', 1], ['4002', 8]]) {
    await db.metaLeadAdsDelivery.create({ data: { organizationId: org.id, bindingId: binding.id,
      appId: '123', leadgenId: id, eventFingerprint: receiptFingerprint(id), acceptedMode: 'pilot',
      status: 'processing', attempts, leaseUntil: expiredLease } })
  }
  assert.equal((await worker()).status, 200)
  assert.equal((await db.metaLeadAdsDelivery.findUnique({ where: { id: recovering.id } })).status, 'complete')
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityId: firstLead.id } }), noticesBeforeRecovery)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, cursorBeforeRecovery + 1)
  assert.equal((await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: binding.id, leadgenId: '4001' } })).status, 'complete')
  assert.equal((await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: binding.id, leadgenId: '4002' } })).status, 'blocked')
  await db.metaLeadAdsDelivery.create({ data: { organizationId: org.id, bindingId: binding.id,
    appId: '123', leadgenId: '4003', eventFingerprint: receiptFingerprint('4003'), acceptedMode: 'pilot' } })
  const beforeConcurrentWorkers = (await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition
  const concurrentWorkers = await Promise.all([worker(), worker(), worker()])
  assert.ok(concurrentWorkers.every(response => response.status === 200))
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:4003' } }), 1)
  const concurrentLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:4003' } })
  assert.ok(await db.notification.count({ where: { organizationId: org.id, entityId: concurrentLead.id } }) <= 1)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition,
    beforeConcurrentWorkers === 1 ? 2 : 1)
  await db.metaLeadAdsDelivery.create({ data: { organizationId: org.id, bindingId: binding.id,
    appId: '123', leadgenId: '4004', eventFingerprint: receiptFingerprint('4004'), acceptedMode: 'pilot' } })
  const timeoutWorker = await worker()
  assert.equal(timeoutWorker.status, 200)
  assert.ok((await timeoutWorker.json()).pending >= 1)
  assert.equal((await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: binding.id, leadgenId: '4004' } })).status, 'pending')
  assert.equal((await webhook(event('995', '111', '223'))).status, 200)
  const queuedForRevoke = await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: authorizedBindingId, leadgenId: '995' } })
  assert.equal(queuedForRevoke?.status, 'pending')
  assert.equal((await bindings('DELETE', ownerToken, { id: authorizedBindingId })).status, 200)
  await db.metaLeadAdsDelivery.update({ where: { id: queuedForRevoke.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } })
  assert.equal((await worker()).status, 200)
  assert.equal((await db.metaLeadAdsDelivery.findUnique({ where: { id: queuedForRevoke.id } }))?.status, 'blocked')
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:995' } }), 0)
  assert.equal((await webhook(event('995', '111', '223'))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: authorizedBindingId } }), 1)
  const inFlight = webhook(event('9981', '111', '227'))
  let processingSeen = false
  for (let attempt = 0; attempt < 300; attempt++) {
    const row = await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: raceBindingId, leadgenId: '9981' }, select: { status: true } })
    if (row?.status === 'processing') { processingSeen = true; break }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (!processingSeen) console.error('RACE_RECEIPT', await db.metaLeadAdsDelivery.findFirst({ where: {
    bindingId: raceBindingId, leadgenId: '9981' }, select: { status: true, lastErrorCode: true } }))
  assert.equal(processingSeen, true)
  const revokeDuringGraph = bindings('DELETE', ownerToken, { id: raceBindingId })
  assert.equal((await inFlight).status, 200)
  assert.equal((await revokeDuringGraph).status, 200)
  const atRevocationCommit = await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:9981' } })
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:9981' } }), atRevocationCommit)
  assert.equal((await webhook(event('9982', '111', '227'))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: raceBindingId, leadgenId: '9982' } }), 0)
  assert.equal((await webhook(event('996', '111', '225'))).status, 200)
  const queuedLive = await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: liveBindingId, leadgenId: '996' } })
  assert.equal(queuedLive?.status, 'pending')
  assert.equal((await bindings('DELETE', liveToken, { id: liveBindingId })).status, 200)
  await db.metaLeadAdsDelivery.update({ where: { id: queuedLive.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } })
  assert.equal((await worker()).status, 200)
  assert.equal((await db.metaLeadAdsDelivery.findUnique({ where: { id: queuedLive.id } }))?.status, 'blocked')
  assert.equal(await db.lead.count({ where: { organizationId: live.id } }), 1)
  const old31 = new Date(Date.now() - 31 * 86400000)
  const old367 = new Date(Date.now() - 367 * 86400000)
  const fingerprint = id => createHmac('sha256', 'synthetic-stable-receipt-hmac-key-1234567890').update(`123:${id}`).digest('hex')
  await db.metaLeadAdsBinding.update({ where: { id: binding.id }, data: { pilotLeadIds: [
    '333', '334', '429', '500', '404', '555', '556', ...batchIds, '2001', '2002', '2003', '3001', '3002'] } })
  const terminalOld = await db.metaLeadAdsDelivery.create({ data: { organizationId: org.id, bindingId: binding.id,
    appId: '123', leadgenId: '3001', eventFingerprint: fingerprint('3001'), acceptedMode: 'pilot',
    status: 'complete', leadId: 'synthetic-deleted-lead', lastErrorCode: 'SYNTHETIC', createdAt: old31 } })
  const tombstoneOld = await db.metaLeadAdsDelivery.create({ data: { organizationId: org.id, bindingId: binding.id,
    appId: '123', leadgenId: `tombstone:${fingerprint('3002')}`, eventFingerprint: fingerprint('3002'),
    acceptedMode: 'pilot', status: 'tombstone', purgedAt: old31, createdAt: old367 } })
  const pendingOld = await db.metaLeadAdsDelivery.create({ data: { organizationId: org.id, bindingId: binding.id,
    appId: '123', leadgenId: '3003', eventFingerprint: fingerprint('3003'), acceptedMode: 'pilot',
    status: 'pending', createdAt: old31, nextAttemptAt: new Date(Date.now() + 86400000) } })
  const expiredBinding = await db.metaLeadAdsBinding.create({ data: { organizationId: org.id, appId: '123',
    pageId: '111', formId: '226', enabled: false, mode: 'off', pilotLeadIds: ['synthetic-old-id'], updatedAt: old31 } })
  assert.equal((await retention({ organizationId: other.id })).status, 403)
  assert.equal((await retention({ organizationId: org.id, apply: true })).status, 403)
  const dryRun = await retention({ organizationId: org.id })
  assert.equal(dryRun.status, 200)
  assert.equal((await dryRun.json()).terminalToTombstone >= 1, true)
  assert.equal((await db.metaLeadAdsDelivery.findUnique({ where: { id: terminalOld.id } })).leadgenId, '3001')
  assert.equal((await retention({ organizationId: org.id, apply: true }, true)).status, 200)
  const cleaned = await db.metaLeadAdsDelivery.findUnique({ where: { id: terminalOld.id } })
  assert.equal(cleaned.status, 'tombstone')
  assert.equal(cleaned.leadgenId, `tombstone:${fingerprint('3001')}`)
  assert.equal(cleaned.leadId, null)
  assert.equal(cleaned.lastErrorCode, null)
  assert.equal(await db.metaLeadAdsDelivery.findUnique({ where: { id: tombstoneOld.id } }), null)
  assert.equal((await db.metaLeadAdsDelivery.findUnique({ where: { id: pendingOld.id } })).status, 'pending')
  assert.deepEqual((await db.metaLeadAdsBinding.findUnique({ where: { id: expiredBinding.id } })).pilotLeadIds, [])
  assert.equal((await webhook(event('3001'))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { appId: '123', eventFingerprint: fingerprint('3001') } }), 1)
  assert.equal((await webhook(event('3002'))).status, 200)
  assert.equal((await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: '3002' } }))?.status, 'blocked')
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:3002' } }), 0)
  assert.equal((await webhook(event('999', '777', '888'))).status, 200)
  const shadow = await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: shadowBinding.id } })
  assert.equal(shadow?.status, 'shadow')
  assert.match(shadow?.leadgenId || '', /^shadow:[a-f0-9]{64}$/)
  assert.equal(await db.lead.count({ where: { organizationId: other.id } }), 0)
  assert.equal((await bindings('DELETE', otherToken, { id: shadowBinding.id })).status, 200)
  assert.equal((await webhook(event('998', '777', '888'))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: shadowBinding.id } }), 1)
  assert.equal((await bindings('DELETE', ownerToken, { id: binding.id })).status, 200)
  assert.equal((await webhook(event('999'))).status, 200)
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:999' } }), 0)
  const settings = await fetch(`${base}/api/meta-lead-ads/bindings`, { headers: { Cookie: `auth-token=${ownerToken}` } })
  assert.equal(settings.status, 200)
  assert.equal((await settings.json()).bindings.length, 4)
  const legacy = () => fetch(`${base}/api/webhooks/leads/${org.slug}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Reziflow-Key': 'synthetic-legacy-webhook-key',
      'Idempotency-Key': 'synthetic-google-sheets-event-1' },
    body: JSON.stringify({ fullName: 'Synthetic Legacy Lead', source: 'google_sheets' }) })
  assert.equal((await legacy()).status, 201)
  assert.equal((await legacy()).status, 201)
  assert.equal(await db.lead.count({ where: { organizationId: org.id, source: 'google_sheets' } }), 1)
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
