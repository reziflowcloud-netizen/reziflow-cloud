import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createHash, createHmac } from 'node:crypto'
import { collectMetaLeadAdsEvents, leadAdsSource, metaNumericId, metaRetryDelay, pilotAllows } from '../src/lib/metaLeadAdsPolicy.ts'
import { leadAdsTupleAuthorized } from '../src/lib/metaLeadAdsAuthorization.ts'
import { verifyMetaWebhookSignature } from '../src/lib/metaWebhookSecurity.ts'

const event = (page = '111', form = '222', lead = '333') => ({ object: 'page', entry: [{ id: page,
  changes: [{ field: 'leadgen', value: { page_id: page, form_id: form, leadgen_id: lead } }] }] })

test('separate Lead Ads app HMAC accepts only its own secret', () => {
  const body = Buffer.from(JSON.stringify(event()))
  const signed = secret => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  assert.equal(verifyMetaWebhookSignature(body, signed('lead-ads-only'), 'lead-ads-only').verified, true)
  assert.equal(verifyMetaWebhookSignature(body, signed('messenger-secret'), 'lead-ads-only').verified, false)
  assert.equal(verifyMetaWebhookSignature(body, null, 'lead-ads-only').verified, false)
})

test('signed Page/Form/Lead IDs must be coherent and bounded', () => {
  assert.deepEqual(collectMetaLeadAdsEvents(event()).events, [{ pageId: '111', formId: '222', leadgenId: '333' }])
  assert.equal(collectMetaLeadAdsEvents({ ...event(), entry: [{ id: '999', changes: event().entry[0].changes }] }).events.length, 0)
  assert.equal(collectMetaLeadAdsEvents(event('111', 'bad', '333')).events.length, 0)
  assert.equal(collectMetaLeadAdsEvents(event('111', '222', 'x')).events.length, 0)
  assert.equal(metaNumericId('01'), null)
  assert.equal(metaNumericId('1'.repeat(32)), null)
})

test('bounded webhook body is never silently sliced at 20 entries or changes', () => {
  const changes = Array.from({ length: 30 }, (_, index) => ({ field: 'leadgen', value: {
    page_id: '111', form_id: '222', leadgen_id: String(1001 + index) } }))
  assert.equal(collectMetaLeadAdsEvents({ object: 'page', entry: [{ id: '111', changes }] }).events.length, 30)
  assert.equal(collectMetaLeadAdsEvents({ object: 'page', entry: changes.map(change => ({ id: '111', changes: [change] })) }).events.length, 30)
})

test('operator tuple provenance and current mode allowlist fail closed', () => {
  const names = ['META_LEAD_ADS_APPROVED_TUPLES', 'META_LEAD_ADS_PILOT_ORGANIZATION_ID',
    'META_LEAD_ADS_SHADOW_ORGANIZATION_IDS', 'META_LEAD_ADS_LIVE_ORGANIZATION_IDS']
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]))
  try {
    const token = 'synthetic-high-entropy-page-token'
    const tuple = { appId: '123', pageId: '111', formId: '222', organizationId: 'org-a',
      tokenSha256: createHash('sha256').update(token).digest('hex'), tokenAppId: '123', tokenPageId: '111',
      formPageId: '111', verifiedAt: new Date().toISOString() }
    process.env.META_LEAD_ADS_APPROVED_TUPLES = JSON.stringify([tuple])
    process.env.META_LEAD_ADS_PILOT_ORGANIZATION_ID = 'org-a'
    process.env.META_LEAD_ADS_SHADOW_ORGANIZATION_IDS = 'org-a'
    process.env.META_LEAD_ADS_LIVE_ORGANIZATION_IDS = 'org-a'
    const input = { appId: '123', pageId: '111', formId: '222', organizationId: 'org-a', mode: 'pilot', pageToken: token }
    assert.equal(leadAdsTupleAuthorized(input), true)
    assert.equal(leadAdsTupleAuthorized({ ...input, organizationId: 'org-b', mode: 'off' }), false)
    assert.equal(leadAdsTupleAuthorized({ ...input, pageToken: 'rotated-token' }), false)
    assert.equal(leadAdsTupleAuthorized({ ...input, mode: 'live' }), true)
    delete process.env.META_LEAD_ADS_LIVE_ORGANIZATION_IDS
    assert.equal(leadAdsTupleAuthorized({ ...input, mode: 'live' }), false)
    delete process.env.META_LEAD_ADS_SHADOW_ORGANIZATION_IDS
    assert.equal(leadAdsTupleAuthorized({ ...input, mode: 'shadow' }), false)
    delete process.env.META_LEAD_ADS_PILOT_ORGANIZATION_ID
    assert.equal(leadAdsTupleAuthorized(input), false)
    process.env.META_LEAD_ADS_APPROVED_TUPLES = JSON.stringify([{ ...tuple, formPageId: '999' }])
    assert.equal(leadAdsTupleAuthorized({ ...input, mode: 'off' }), false)
  } finally {
    for (const name of names) old[name] === undefined ? delete process.env[name] : process.env[name] = old[name]
  }
})

test('pilot blocks unknown IDs; shadow is not a fetchable mode', () => {
  assert.equal(pilotAllows('pilot', '333', ['333']), true)
  assert.equal(pilotAllows('pilot', '444', ['333']), false)
  assert.equal(pilotAllows('shadow', '333', ['333']), false)
  assert.equal(pilotAllows('off', '333', ['333']), false)
  assert.equal(pilotAllows('live', '333', []), true)
})

test('platforms remain separate channels and retries are bounded', () => {
  assert.equal(leadAdsSource('fb'), 'facebook_lead_ads')
  assert.equal(leadAdsSource('instagram'), 'instagram_lead_ads')
  assert.equal(leadAdsSource('unknown'), 'meta_lead_ads_unknown')
  assert.equal(metaRetryDelay(1), 30)
  assert.equal(metaRetryDelay(6, 429), 960)
  assert.equal(metaRetryDelay(9, 7200), 3600)
})

test('migration adds isolated default-off tables without touching legacy Meta', async () => {
  const sql = await readFile(new URL('../prisma/migrations/20261027120000_meta_lead_ads_multitenant/migration.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE "MetaLeadAdsBinding"/)
  assert.match(sql, /CREATE TABLE "MetaLeadAdsDelivery"/)
  assert.match(sql, /"enabled" BOOLEAN NOT NULL DEFAULT false/)
  assert.match(sql, /UNIQUE INDEX "MetaLeadAdsDelivery_appId_eventFingerprint_key"/)
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im)
  assert.doesNotMatch(sql, /ALTER TABLE "(?:Lead|LeadMessage|Organization)"/)
})

test('webhook, worker and settings are isolated from legacy Meta endpoints', async () => {
  const route = await readFile(new URL('../src/app/api/webhooks/meta/lead-ads/route.ts', import.meta.url), 'utf8')
  const worker = await readFile(new URL('../src/app/api/internal/meta-lead-ads/route.ts', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../src/app/api/meta-lead-ads/bindings/route.ts', import.meta.url), 'utf8')
  assert.match(route, /verifyMetaWebhookSignature\(raw/)
  assert.match(route, /META_LEAD_ADS_ENABLED/)
  assert.match(worker, /META_LEAD_ADS_WORKER_SECRET/)
  assert.match(settings, /META_LEAD_ADS_PILOT_ORGANIZATION_ID/)
  assert.match(settings, /META_LEAD_ADS_SHADOW_ORGANIZATION_IDS/)
  assert.match(settings, /isSameOriginRequest/)
})
