import assert from 'node:assert/strict'
import { createECDH, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import { encryptSubscription, endpointHash, subscriptionAAD } from '../src/lib/pushSecurity.ts'
import { deliverNotificationPush } from '../src/lib/notificationPush.ts'

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
const sheets = await db.organization.create({ data: { name: 'Synthetic Google Sheets Isolation', slug: `synthetic-sheets-${suffix}`,
  notificationAutomationEnabled: true, notificationAutomationActivatedAt: new Date(0),
  settings: { leadWebhookKey: 'synthetic-sheets-only-key', leadWebhookEnabled: true } } })
const sheetsUserA = await db.user.create({ data: { organizationId: sheets.id, email: `sheets-a-${suffix}@example.invalid`,
  password: 'synthetic', name: 'Sheets A', role: 'employee' } })
const sheetsUserB = await db.user.create({ data: { organizationId: sheets.id, email: `sheets-b-${suffix}@example.invalid`,
  password: 'synthetic', name: 'Sheets B', role: 'employee' } })
const sheetsEmployeeA = await db.employee.create({ data: { organizationId: sheets.id, userId: sheetsUserA.id, name: 'Sheets A' } })
const sheetsEmployeeB = await db.employee.create({ data: { organizationId: sheets.id, userId: sheetsUserB.id, name: 'Sheets B' } })
const sheetsRoute = await db.leadChannelRoute.create({ data: { organizationId: sheets.id,
  sourceKey: 'google_sheets', employeeId: sheetsEmployeeA.id } })
await db.leadChannelRouteMember.create({ data: { organizationId: sheets.id,
  routeId: sheetsRoute.id, employeeId: sheetsEmployeeB.id, position: 1 } })
await db.notificationPreference.create({ data: { organizationId: sheets.id, userId: sheetsUserA.id,
  pushEnabled: true, events: { lead_assigned: { inApp: true, push: true } } } })
await db.notificationPreference.create({ data: { organizationId: sheets.id, userId: sheetsUserB.id,
  pushEnabled: true, events: { lead_assigned: { inApp: true, push: false } } } })
const pushPair = createECDH('prime256v1'); pushPair.generateKeys()
const pushKey = randomBytes(32).toString('hex')
const sheetsEndpoint = `https://web.push.apple.com/${randomUUID()}`
const sheetsSubscription = { endpoint: sheetsEndpoint,
  keys: { p256dh: pushPair.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
const sheetsSubscriptionFields = { organizationId: sheets.id, userId: sheetsUserA.id,
  endpointHash: endpointHash(sheetsEndpoint), deviceLabel: 'Synthetic Sheets Only' }
process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY = pushKey
await db.pushSubscription.create({ data: { ...sheetsSubscriptionFields,
  encryptedSubscription: encryptSubscription(sheetsSubscription, subscriptionAAD(sheetsSubscriptionFields)) } })
const owner = await db.user.create({ data: { organizationId: org.id, email: `owner-${suffix}@example.invalid`, password: 'synthetic', name: 'Owner', role: 'owner' } })
const otherOwner = await db.user.create({ data: { organizationId: other.id, email: `other-${suffix}@example.invalid`, password: 'synthetic', name: 'Other Owner', role: 'owner' } })
const liveOwner = await db.user.create({ data: { organizationId: live.id, email: `live-${suffix}@example.invalid`, password: 'synthetic', name: 'Live Owner', role: 'owner' } })
const liveEmployee = await db.employee.create({ data: { organizationId: live.id, userId: liveOwner.id, name: 'Live Employee' } })
await db.leadChannelRoute.create({ data: { organizationId: live.id, sourceKey: 'facebook_lead_ads', employeeId: liveEmployee.id } })
const employeeUserA = await db.user.create({ data: { organizationId: org.id, email: `a-${suffix}@example.invalid`, password: 'synthetic', name: 'A', role: 'employee' } })
const employeeUserB = await db.user.create({ data: { organizationId: org.id, email: `b-${suffix}@example.invalid`, password: 'synthetic', name: 'B', role: 'employee' } })
await db.notificationPreference.create({ data: { organizationId: org.id, userId: employeeUserA.id,
  pushEnabled: true, events: { lead_assigned: { inApp: true, push: true } } } })
await db.pushSubscription.create({ data: { organizationId: org.id, userId: employeeUserA.id,
  endpointHash: createHash('sha256').update(`synthetic-push-${suffix}`).digest('hex'),
  encryptedSubscription: 'synthetic-encrypted-placeholder-not-dispatched', deviceLabel: 'Synthetic QA' } })
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
      approved('111', '228', org.id, token111),
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
async function sheetsWebhook(id, source = 'google_sheets') {
  return fetch(`${base}/api/webhooks/leads/${sheets.slug}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Reziflow-Key': 'synthetic-sheets-only-key',
      'Idempotency-Key': id },
    body: JSON.stringify({ fullName: `Synthetic Sheets ${id}`, source }) })
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
    pilotLeadIds: ['9981', '9982', '9983'] })
  assert.equal(raceCreate.status, 200)
  const raceBindingId = (await raceCreate.json()).id
  const liveCreate = await bindings('POST', liveToken, { pageId: '111', formId: '225', mode: 'live', enabled: true, pilotLeadIds: [] })
  assert.equal(liveCreate.status, 200)
  const liveBindingId = (await liveCreate.json()).id
  // Real legacy Google Sheets HTTP handler, independent of the Meta tenant.
  const firstSheets = await sheetsWebhook('sheets-primary-1')
  assert.equal(firstSheets.status, 201)
  const firstSheetsLead = await db.lead.findFirst({ where: { organizationId: sheets.id,
    source: 'google_sheets' }, orderBy: { createdAt: 'asc' } })
  assert.equal(await db.lead.count({ where: { organizationId: sheets.id } }), 1)
  assert.equal(firstSheetsLead.employeeId, sheetsEmployeeA.id)
  assert.equal(firstSheetsLead.assignedToId, sheetsUserA.id)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: sheetsRoute.id } })).nextPosition, 1)
  const firstSheetsNotification = await db.notification.findFirst({ where: { organizationId: sheets.id,
    entityId: firstSheetsLead.id, type: 'lead_assigned', userId: sheetsUserA.id } })
  assert.equal(firstSheetsNotification?.pushRequested, true)
  assert.equal(await db.notification.count({ where: { organizationId: sheets.id, entityId: firstSheetsLead.id } }), 1)
  const firstSheetsOutbox = await db.notificationPushDelivery.findFirst({ where: { organizationId: sheets.id,
    notificationId: firstSheetsNotification.id } })
  assert.equal(firstSheetsOutbox?.attempts, 0)
  assert.equal(firstSheetsOutbox?.deliveredAt, null)
  // The HTTP server has no Push transport configured. Exercise its durable
  // outbox with the actual existing sender and an injected local mock provider.
  process.env.NOTIFICATIONS_ENABLED = 'true'
  process.env.NOTIFICATION_EVENTS_ENABLED = 'true'
  process.env.WEB_PUSH_ENABLED = 'true'
  process.env.VERCEL_ENV = 'development'
  process.env.PUSH_ENVIRONMENT = 'development'
  process.env.VAPID_PUBLIC_KEY = pushPair.getPublicKey().toString('base64url')
  process.env.VAPID_PRIVATE_KEY = pushPair.getPrivateKey().toString('base64url')
  process.env.VAPID_SUBJECT = 'https://qa.example.invalid/contact'
  const sentSheetsPush = []
  const mockPush = async (subscription, payload) => {
    assert.equal(subscription.endpoint, sheetsEndpoint)
    sentSheetsPush.push(JSON.parse(payload))
  }
  const sentFirst = await deliverNotificationPush(db, mockPush, new Date(), undefined,
    { organizationId: sheets.id, entityIds: [firstSheetsLead.id] })
  assert.equal(sentFirst.delivered, 1)
  assert.equal(sentSheetsPush.length, 1)
  assert.equal(sentSheetsPush[0].url, `/notifications/open/${firstSheetsNotification.id}`)
  assert.ok((await db.notificationPushDelivery.findUnique({ where: { id: firstSheetsOutbox.id } })).deliveredAt)
  assert.equal((await sheetsWebhook('sheets-primary-1')).status, 201)
  assert.equal(await db.lead.count({ where: { organizationId: sheets.id } }), 1)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: sheetsRoute.id } })).nextPosition, 1)
  assert.equal(await db.notification.count({ where: { organizationId: sheets.id } }), 1)
  assert.equal(await db.notificationPushDelivery.count({ where: { organizationId: sheets.id } }), 1)
  assert.equal((await deliverNotificationPush(db, mockPush, new Date(), undefined,
    { organizationId: sheets.id, entityIds: [firstSheetsLead.id] })).delivered, 0)
  assert.equal(sentSheetsPush.length, 1)
  assert.equal((await sheetsWebhook('sheets-primary-2')).status, 201)
  const secondSheetsLead = await db.lead.findFirst({ where: { organizationId: sheets.id,
    fullName: 'Synthetic Sheets sheets-primary-2' } })
  assert.equal(secondSheetsLead.employeeId, sheetsEmployeeB.id)
  assert.equal(secondSheetsLead.assignedToId, sheetsUserB.id)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: sheetsRoute.id } })).nextPosition, 2)
  assert.equal((await db.notification.findFirst({ where: { organizationId: sheets.id,
    entityId: secondSheetsLead.id } }))?.pushRequested, false, 'Recipient Push preference is preserved')
  assert.equal(await db.notificationPushDelivery.count({ where: { organizationId: sheets.id } }), 1)
  await db.organization.update({ where: { id: sheets.id }, data: { notificationAutomationEnabled: false } })
  assert.equal((await sheetsWebhook('sheets-master-off')).status, 201)
  const offLead = await db.lead.findFirst({ where: { organizationId: sheets.id,
    fullName: 'Synthetic Sheets sheets-master-off' } })
  assert.ok(offLead)
  assert.equal(await db.notification.count({ where: { organizationId: sheets.id, entityId: offLead.id } }), 0)
  await db.organization.update({ where: { id: sheets.id }, data: { notificationAutomationEnabled: true } })
  assert.equal(await db.lead.count({ where: { organizationId: other.id } }), 0)
  const lockCreate = await bindings('POST', ownerToken, { pageId: '111', formId: '228', mode: 'pilot',
    enabled: true, pilotLeadIds: ['7001', '7002'] })
  assert.equal(lockCreate.status, 200)
  const lockBindingId = (await lockCreate.json()).id
  const routingBeforeBindingRace = (await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition
  const noticesBeforeBindingRace = await db.notification.count({ where: { organizationId: org.id } })
  // Force the exact old cycle: acceptance already holds binding locks, INSERT
  // pauses before its implicit Organization FK check, while DELETE/PUT starts.
  // With Organization-first locking, both operations finish after release.
  await db.$executeRawUnsafe(`CREATE FUNCTION meta_qa_receipt_barrier() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW."leadgenId" IN ('7001','7002') THEN PERFORM pg_advisory_xact_lock(742, 91); END IF;
    RETURN NEW; END $$`)
  await db.$executeRawUnsafe('CREATE TRIGGER meta_qa_receipt_barrier BEFORE INSERT ON "MetaLeadAdsDelivery" FOR EACH ROW EXECUTE FUNCTION meta_qa_receipt_barrier()')
  async function controlledBindingRace(leadgenId, mutation, includePeer = false) {
    let lockReady, releaseBarrier
    const ready = new Promise(resolve => { lockReady = resolve })
    const hold = new Promise(resolve => { releaseBarrier = resolve })
    const holder = db.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT 1 AS held FROM pg_advisory_xact_lock(742, 91)')
      lockReady()
      await hold
    }, { timeout: 10000 })
    await ready
    try {
      const body = includePeer ? JSON.stringify({ object: 'page', entry: [
        { id: '111', changes: [
          { field: 'leadgen', value: { page_id: '111', form_id: '228', leadgen_id: leadgenId } },
          { field: 'leadgen', value: { page_id: '111', form_id: '225', leadgen_id: '7003' } },
        ] },
      ] }) : event(leadgenId, '111', '228')
      const accepted = webhook(body)
      let waiting = false
      for (let n = 0; n < 70; n++) {
        const rows = await db.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND NOT granted")
        if (rows[0].count > 0) { waiting = true; break }
        await new Promise(resolve => setTimeout(resolve, 15))
      }
      assert.equal(waiting, true, 'Receipt INSERT must reach the PostgreSQL barrier')
      const mutating = mutation()
      const mutationWaitingOnTenant = (async () => {
        for (let n = 0; n < 50; n++) {
          const rows = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM pg_stat_activity
            WHERE wait_event_type='Lock' AND query LIKE '%"Organization"%' AND query LIKE '%FOR UPDATE%'`)
          if (rows[0].count > 0) return true
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        return false
      })()
      // The separate Sheets tenant must keep ingesting while the Meta INSERT
      // is paused. This is the real legacy HTTP route, not a simulated copy.
      const sheetsStart = Date.now()
      const sheetsResult = await sheetsWebhook(`sheets-during-meta-${leadgenId}`)
      assert.equal(sheetsResult.status, 201)
      assert.ok(Date.now() - sheetsStart < 1200, 'Sheets ingestion blocked by Meta acceptance')
      assert.equal(await mutationWaitingOnTenant, true,
        'DELETE/PUT must wait for the tenant row before attempting the binding row')
      releaseBarrier()
      await holder
      const [receiptResponse, mutationResponse] = await Promise.all([accepted, mutating])
      assert.equal(receiptResponse.status, 200, 'Receipt acceptance must finish without deadlock or lock timeout')
      assert.equal(mutationResponse.status, 200, 'Binding mutation must finish without deadlock or lock timeout')
    } finally {
      releaseBarrier()
      await holder
    }
  }
  try {
    await controlledBindingRace('7001', () => bindings('DELETE', ownerToken, { id: lockBindingId }), true)
    assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: lockBindingId, leadgenId: '7001' } }), 1)
    assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: liveBindingId, leadgenId: '7003' } }), 1)
    assert.equal((await db.metaLeadAdsBinding.findUnique({ where: { id: lockBindingId } })).enabled, false)
    assert.equal((await bindings('PUT', ownerToken, { id: lockBindingId, mode: 'pilot', enabled: true,
      pilotLeadIds: ['7002'] })).status, 200)
    await controlledBindingRace('7002', () => bindings('PUT', ownerToken, { id: lockBindingId,
      mode: 'off', enabled: false, pilotLeadIds: [] }))
    assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: lockBindingId, leadgenId: '7002' } }), 1)
    assert.equal((await db.metaLeadAdsBinding.findUnique({ where: { id: lockBindingId } })).enabled, false)
    assert.equal((await worker()).status, 200)
    assert.equal(await db.lead.count({ where: { organizationId: org.id,
      messengerId: { in: ['meta-lead-ads:7001', 'meta-lead-ads:7002'] } } }), 0)
    assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: lockBindingId, status: 'blocked' } }), 2)
    assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition,
      routingBeforeBindingRace, 'Disabled binding must not advance routing')
    assert.equal(await db.notification.count({ where: { organizationId: org.id } }),
      noticesBeforeBindingRace, 'Disabled binding must not create notifications')
    assert.equal((await webhook(event('7002', '111', '228'))).status, 200)
    assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: lockBindingId } }), 2)
    assert.equal((await sheetsWebhook('sheets-after-meta-disable')).status, 201)
    assert.equal(await db.lead.count({ where: { organizationId: sheets.id } }), 6)
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER meta_qa_receipt_barrier ON "MetaLeadAdsDelivery"')
    await db.$executeRawUnsafe('DROP FUNCTION meta_qa_receipt_barrier()')
  }
  const liveResponse = await webhook(event('997', '111', '225'))
  assert.equal(liveResponse.status, 200)
  const liveReceipt = await liveResponse.json()
  assert.equal((await worker()).status, 200)
  const liveLead = await db.lead.findFirst({ where: { organizationId: live.id, messengerId: 'meta-lead-ads:997' } })
  assert.equal(liveLead?.assignedToId, liveOwner.id, `Live Lead status: ${JSON.stringify({ response: liveReceipt, delivery: await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: liveBindingId }, select: { status: true, attempts: true, lastErrorCode: true, nextAttemptAt: true } }) })}`)
  assert.equal(await db.notification.count({ where: { organizationId: live.id, entityId: liveLead.id } }), 0)
  const largeIds = Array.from({ length: 600 }, (_, index) => String(5000 + index))
  const liveBatch = ids => ({ object: 'page', entry: ids.map(leadgenId => ({ id: '111',
    changes: [{ field: 'leadgen', value: { page_id: '111', form_id: '225', leadgen_id: leadgenId } }] })) })
  await db.$executeRawUnsafe(`CREATE FUNCTION meta_qa_slow_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.005); RETURN NEW; END $$`)
  await db.$executeRawUnsafe('CREATE TRIGGER meta_qa_slow_receipt BEFORE INSERT ON "MetaLeadAdsDelivery" FOR EACH ROW EXECUTE FUNCTION meta_qa_slow_receipt()')
  try {
    const hundred = await webhook(JSON.stringify(liveBatch(largeIds.slice(0, 100))))
    assert.equal(hundred.status, 200)
    assert.equal((await hundred.json()).accepted, 100)
    const payload = liveBatch(largeIds)
    const baseSize = Buffer.byteLength(JSON.stringify(payload))
    payload.padding = 'x'.repeat(Math.max(0, 64500 - baseSize - 15))
    const largeBody = JSON.stringify(payload)
    assert.ok(Buffer.byteLength(largeBody) > 60000 && Buffer.byteLength(largeBody) < 65536)
    const largeStart = Date.now()
    const concurrentBatches = await Promise.all([webhook(largeBody), webhook(largeBody)])
    assert.ok(concurrentBatches.some(response => response.status === 200))
    assert.ok(concurrentBatches.every(response => [200, 503].includes(response.status)))
    if (concurrentBatches.some(response => response.status === 503)) {
      assert.equal((await webhook(largeBody)).status, 200, 'Retry after bounded concurrent lock failure')
    }
    assert.ok(Date.now() - largeStart < 45000, 'Near-limit webhook exceeded admission budget')
    assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: liveBindingId,
      leadgenId: { in: largeIds } } }), 600)
    await db.metaLeadAdsDelivery.updateMany({ where: { bindingId: liveBindingId, leadgenId: { in: largeIds } },
      data: { nextAttemptAt: new Date(Date.now() + 86400000) } })
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER meta_qa_slow_receipt ON "MetaLeadAdsDelivery"')
    await db.$executeRawUnsafe('DROP FUNCTION meta_qa_slow_receipt()')
  }
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
  assert.equal((await worker()).status, 200)
  const firstLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:333' } })
  assert.equal(firstLead?.source, 'facebook_lead_ads', `First Lead status: ${JSON.stringify(await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: binding.id }, select: { status: true, lastErrorCode: true } }))}`)
  assert.equal(firstLead?.employeeId, employeeA.id)
  assert.equal(firstLead?.assignedToId, employeeUserA.id)
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityType: 'lead', entityId: firstLead.id } }), 1)
  const durablePush = await db.notificationPushDelivery.findFirst({ where: { organizationId: org.id,
    notification: { entityType: 'lead', entityId: firstLead.id } }, select: { attempts: true, deliveredAt: true } })
  assert.equal(durablePush?.attempts, 0)
  assert.equal(durablePush?.deliveredAt, null)
  const replays = await Promise.all(Array.from({ length: 8 }, () => webhook(event('333'))))
  assert.ok(replays.every(response => response.status === 200))
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:333' } }), 1)
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityType: 'lead', entityId: firstLead.id } }), 1)
  const second = await webhook(event('334'))
  assert.equal(second.status, 200)
  assert.equal((await worker()).status, 200)
  const secondLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:334' } })
  assert.equal(secondLead?.source, 'instagram_lead_ads')
  assert.equal(secondLead?.employeeId, employeeB.id)
  assert.equal(secondLead?.assignedToId, employeeUserB.id)
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityType: 'lead', entityId: secondLead.id } }), 0)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: instagramRoute.id } })).nextPosition, 1)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, 1)
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => webhook(event('556'))))
  assert.ok(concurrent.every(response => response.status === 200))
  assert.equal((await worker()).status, 200)
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:556' } }), 1)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, 2)
  for (const id of ['429', '500']) {
    assert.equal((await webhook(event(id))).status, 200)
    const row = await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: id } })
    assert.equal(row?.status, 'pending')
  }
  assert.equal((await worker('wrong')).status, 401)
  assert.equal((await worker()).status, 200)
  for (const id of ['429', '500']) {
    const row = await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: id } })
    assert.equal(row?.status, 'pending')
    await db.metaLeadAdsDelivery.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } })
  }
  assert.equal((await worker()).status, 200)
  for (const id of ['429', '500']) {
    assert.equal((await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: id } }))?.status, 'complete')
    assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: `meta-lead-ads:${id}` } }), 1)
  }
  assert.equal((await webhook(event('404'))).status, 200)
  assert.equal((await worker()).status, 200)
  const missingGraphLead = await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: '404' }, select: { status: true, lastErrorCode: true } })
  if (missingGraphLead?.status !== 'blocked') console.error('GRAPH_404_STATUS', missingGraphLead)
  assert.equal(missingGraphLead?.status, 'blocked')
  assert.equal((await webhook(event('555'))).status, 200)
  assert.equal((await worker()).status, 200)
  const unknownPlatformLead = await db.lead.findFirst({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:555' } })
  if (!unknownPlatformLead) console.error('UNKNOWN_PLATFORM_STATUS', await db.metaLeadAdsDelivery.findFirst({ where: { appId: '123', leadgenId: '555' }, select: { status: true, lastErrorCode: true } }))
  assert.equal(unknownPlatformLead?.source, 'meta_lead_ads_unknown')
  const batchIds = Array.from({ length: 30 }, (_, index) => String(1001 + index))
  await db.metaLeadAdsBinding.update({ where: { id: binding.id }, data: {
    pilotLeadIds: ['333', '334', '429', '500', '404', '555', '556', ...batchIds, '2001', '2002', '2003', '4001', '4002', '4003', '4004', '4005', '4006'],
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
  assert.equal((await webhook(batch(['2001', '2002']))).status, 200)
  await db.$executeRawUnsafe(`CREATE FUNCTION meta_qa_no_prefix_reinsert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'replayed prefix reached INSERT'; END $$`)
  await db.$executeRawUnsafe('CREATE TRIGGER meta_qa_no_prefix_reinsert BEFORE INSERT ON "MetaLeadAdsDelivery" FOR EACH ROW EXECUTE FUNCTION meta_qa_no_prefix_reinsert()')
  const prefixReplay = await webhook(batch(['2001', '2002']))
  assert.equal(prefixReplay.status, 200)
  assert.equal((await prefixReplay.json()).replayed, 2)
  await db.$executeRawUnsafe('DROP TRIGGER meta_qa_no_prefix_reinsert ON "MetaLeadAdsDelivery"')
  await db.$executeRawUnsafe('DROP FUNCTION meta_qa_no_prefix_reinsert()')
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
  for (const id of ['4004', '4005', '4006']) {
    await db.metaLeadAdsDelivery.create({ data: { organizationId: org.id, bindingId: binding.id,
      appId: '123', leadgenId: id, eventFingerprint: receiptFingerprint(id), acceptedMode: 'pilot' } })
  }
  const timeoutStart = Date.now()
  const timeoutWorker = await worker()
  assert.equal(timeoutWorker.status, 200)
  assert.ok(Date.now() - timeoutStart < 45000, 'Worker exceeded bounded execution budget')
  assert.ok((await timeoutWorker.json()).pending >= 1)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: binding.id,
    leadgenId: { in: ['4004', '4005', '4006'] }, status: 'pending' } }), 3)
  const deadlineRows = await db.metaLeadAdsDelivery.findMany({ where: { bindingId: binding.id,
    leadgenId: { in: ['4004', '4005', '4006'] } }, select: { attempts: true } })
  assert.ok(deadlineRows.some(row => row.attempts > 0) && deadlineRows.some(row => row.attempts === 0),
    'Worker must leave later slow receipts recoverable when budget is exhausted')
  await db.metaLeadAdsDelivery.updateMany({ where: { bindingId: binding.id,
    leadgenId: { in: ['4004', '4005', '4006'] } }, data: { nextAttemptAt: new Date(Date.now() + 86400000) } })
  assert.equal((await webhook(event('995', '111', '223'))).status, 200)
  const queuedForRevoke = await db.metaLeadAdsDelivery.findFirst({ where: { bindingId: authorizedBindingId, leadgenId: '995' } })
  assert.equal(queuedForRevoke?.status, 'pending')
  let lockReady, releaseLock
  const readyForLock = new Promise(resolve => { lockReady = resolve })
  const holdLock = new Promise(resolve => { releaseLock = resolve })
  const heldBinding = db.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT id FROM "MetaLeadAdsBinding" WHERE id = $1 FOR UPDATE', authorizedBindingId)
    lockReady()
    await holdLock
  }, { timeout: 10000 })
  await readyForLock
  try {
    const busyStart = Date.now()
    const busyDisable = await bindings('DELETE', ownerToken, { id: authorizedBindingId })
    assert.equal(busyDisable.status, 503)
    assert.ok(Date.now() - busyStart < 5000)
    assert.equal((await db.metaLeadAdsBinding.findUnique({ where: { id: authorizedBindingId } })).enabled, true)
  } finally {
    releaseLock()
    await heldBinding
  }
  assert.equal((await bindings('DELETE', ownerToken, { id: authorizedBindingId })).status, 200)
  await db.metaLeadAdsDelivery.update({ where: { id: queuedForRevoke.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } })
  assert.equal((await worker()).status, 200)
  assert.equal((await db.metaLeadAdsDelivery.findUnique({ where: { id: queuedForRevoke.id } }))?.status, 'blocked')
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:995' } }), 0)
  assert.equal((await webhook(event('995', '111', '223'))).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: authorizedBindingId } }), 1)
  assert.equal((await webhook(event('9981', '111', '227'))).status, 200)
  assert.equal((await webhook(event('9983', '111', '227'))).status, 200)
  const inFlight = worker()
  const inFlightPeer = worker()
  let processingSeen = false
  for (let attempt = 0; attempt < 300; attempt++) {
    const rows = await db.metaLeadAdsDelivery.findMany({ where: { bindingId: raceBindingId,
      leadgenId: { in: ['9981', '9983'] } }, select: { status: true } })
    if (rows.length === 2 && rows.every(row => row.status === 'processing')) { processingSeen = true; break }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (!processingSeen) console.error('RACE_RECEIPT', await db.metaLeadAdsDelivery.findFirst({ where: {
    bindingId: raceBindingId, leadgenId: '9981' }, select: { status: true, lastErrorCode: true } }))
  assert.equal(processingSeen, true)
  const cursorBeforeRevoke = (await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition
  const legacyStart = Date.now()
  const legacyDuringGraph = await fetch(`${base}/api/webhooks/leads/${org.slug}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Reziflow-Key': 'synthetic-legacy-webhook-key',
      'Idempotency-Key': 'synthetic-google-sheets-during-graph' },
    body: JSON.stringify({ fullName: 'Synthetic Concurrent Legacy Lead', source: 'google_sheets' }) })
  assert.equal(legacyDuringGraph.status, 201)
  assert.ok(Date.now() - legacyStart < 3500, 'Legacy ingestion was blocked by Graph latency')
  const sheetsDuringGraphStart = Date.now()
  assert.equal((await sheetsWebhook('sheets-during-slow-graph')).status, 201)
  assert.ok(Date.now() - sheetsDuringGraphStart < 3500, 'Google Sheets ingestion was blocked by Graph latency')
  const otherStart = Date.now()
  await db.organization.update({ where: { id: other.id }, data: { name: 'Synthetic Other Still Available' } })
  assert.ok(Date.now() - otherStart < 2000, 'Another tenant was blocked by Graph latency')
  const revokeStart = Date.now()
  const revokeDuringGraph = bindings('DELETE', ownerToken, { id: raceBindingId })
  assert.equal((await revokeDuringGraph).status, 200)
  assert.ok(Date.now() - revokeStart < 3500, 'Binding disable waited for Graph response')
  assert.equal((await inFlight).status, 200)
  assert.equal((await inFlightPeer).status, 200)
  assert.equal(await db.metaLeadAdsDelivery.count({ where: { bindingId: raceBindingId,
    leadgenId: { in: ['9981', '9983'] }, status: 'blocked' } }), 2)
  const atRevocationCommit = await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:9981' } })
  assert.equal(atRevocationCommit, 0)
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:9983' } }), 0)
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(await db.lead.count({ where: { organizationId: org.id, messengerId: 'meta-lead-ads:9981' } }), atRevocationCommit)
  assert.equal((await db.leadChannelRoute.findUnique({ where: { id: route.id } })).nextPosition, cursorBeforeRevoke)
  assert.equal(await db.notification.count({ where: { organizationId: org.id, entityType: 'lead',
    entityId: { in: (await db.lead.findMany({ where: { organizationId: org.id,
      messengerId: 'meta-lead-ads:9981' }, select: { id: true } })).map(row => row.id) } } }), 0)
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
  assert.equal((await worker()).status, 200)
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
  assert.equal((await settings.json()).bindings.length, 5)
  const legacy = () => fetch(`${base}/api/webhooks/leads/${org.slug}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Reziflow-Key': 'synthetic-legacy-webhook-key',
      'Idempotency-Key': 'synthetic-google-sheets-event-1' },
    body: JSON.stringify({ fullName: 'Synthetic Legacy Lead', source: 'google_sheets' }) })
  assert.equal((await legacy()).status, 201)
  assert.equal((await legacy()).status, 201)
  assert.equal(await db.lead.count({ where: { organizationId: org.id, source: 'google_sheets' } }), 2)
  assert.doesNotMatch(serverError, /P2024|P2028|deadlock detected/i)
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
