import test from 'node:test'
import assert from 'node:assert/strict'
import { readBoundedBody, BodyLimitError } from '../src/lib/boundedBody.ts'
import { metaLeadAdsFeatureEnabled, isInternalQaMetaResource } from '../src/lib/metaLeadAdsFeature.ts'
import { normalizeLeadSources, LEAD_SOURCES } from '../src/lib/leads.ts'
import { runWorkerScheduler } from '../scripts/meta-lead-ads-worker.mjs'
import { metaGraphRetryable } from '../src/lib/metaLeadAdsPolicy.ts'

test('Graph transient/throttle error codes retry even with HTTP400; authorization stays terminal', () => {
  for (const code of [1, 2, 4, 17, 32, 341, 613]) assert.equal(metaGraphRetryable(400, code, false), true)
  assert.equal(metaGraphRetryable(400, 999, true), true)
  for (const code of [10, 190, 200]) assert.equal(metaGraphRetryable(500, code, true), false)
  assert.equal(metaGraphRetryable(400, 100, false), false)
})

test('stream cap cancels unknown-length body before reading its remaining chunks', async () => {
  let cancelled = false, reads = 0
  const body = new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array(4096)) },
    cancel() { cancelled = true } }, { highWaterMark: 0 })
  await assert.rejects(readBoundedBody(body, 8192), BodyLimitError)
  assert.equal(cancelled, true); assert.equal(reads, 3)
  assert.equal((await readBoundedBody(new Response('exact').body, 5)).byteLength, 5)
  await assert.rejects(readBoundedBody(new Response('x').body, 5, '6'), BodyLimitError)
})
test('tenant UI rollout is OFF by default; custom sources retain their label/order', () => {
  const old = [process.env.META_LEAD_ADS_UI_ENABLED, process.env.META_LEAD_ADS_UI_ORGANIZATION_IDS]
  try {
    delete process.env.META_LEAD_ADS_UI_ENABLED
    process.env.META_LEAD_ADS_UI_ORGANIZATION_IDS = 'allowed'
    assert.equal(metaLeadAdsFeatureEnabled('allowed'), false)
    process.env.META_LEAD_ADS_UI_ENABLED = 'true'
    assert.equal(metaLeadAdsFeatureEnabled('allowed'), true)
    assert.equal(metaLeadAdsFeatureEnabled('other'), false)
    assert.equal(metaLeadAdsFeatureEnabled(''), false)
    const custom = [{ value: 'sheets_custom', label: 'Our sheet', order: 50, system: false }]
    assert.deepEqual(normalizeLeadSources(custom), custom)
    assert.deepEqual(normalizeLeadSources(custom, true).slice(0, 1), custom)
    assert.equal(normalizeLeadSources(custom, true).length, 4)
    assert.equal(LEAD_SOURCES.some(source => source.value.includes('lead_ads')), false)
    assert.equal(normalizeLeadSources([{ value: 'facebook_lead_ads', label: 'QA', order: 0 }]).some(source => source.value === 'facebook_lead_ads'), false)
  } finally {
    for (const [i, name] of ['META_LEAD_ADS_UI_ENABLED', 'META_LEAD_ADS_UI_ORGANIZATION_IDS'].entries()) {
      if (old[i] === undefined) delete process.env[name]; else process.env[name] = old[i]
    }
  }
})
test('both historical QA Apps and QA Page/Form are excluded independently', () => {
  assert.equal(isInternalQaMetaResource('1160353550276176'), true)
  assert.equal(isInternalQaMetaResource('2523488421395251'), true)
  assert.equal(isInternalQaMetaResource('123', '1449474971582722'), true)
  assert.equal(isInternalQaMetaResource('123', '111', '2046130655900851'), true)
  assert.equal(isInternalQaMetaResource('123', '111', '222'), false)
})
test('scheduler performs no requests by default and retries are bounded without leaking remote bodies', async () => {
  let calls = 0; const reports = [], waits = []
  assert.deepEqual(await runWorkerScheduler({ env: {}, fetchImpl: () => { calls++; throw new Error() } }), { disabled: true, ticks: 0 })
  assert.equal(calls, 0)
  const env = { META_LEAD_ADS_SCHEDULER_ENABLED: 'true', META_LEAD_ADS_WORKER_URL: 'https://example.invalid/api/internal/meta-lead-ads', META_LEAD_ADS_WORKER_SECRET: 'synthetic-worker-secret-123456789012345' }
  const result = await runWorkerScheduler({ env, fetchImpl: async () => { calls++; return new Response('PRIVATE_REMOTE_BODY', { status: 503, headers: { 'retry-after': '120' } }) },
    sleep: async ms => waits.push(ms), report: value => reports.push(value), maxTicks: 20 })
  assert.equal(result.failed, true); assert.equal(calls, 3); assert.deepEqual(waits, [120000, 120000])
  assert.doesNotMatch(JSON.stringify(reports), /PRIVATE|synthetic-worker|https/)
})
test('scheduler reports backlog, serializes ticks and stops on operator signal', async () => {
  const controller = new AbortController(), reports = []
  let calls = 0
  const result = await runWorkerScheduler({ env: { META_LEAD_ADS_SCHEDULER_ENABLED: 'true', META_LEAD_ADS_WORKER_URL: 'https://example.invalid/api/internal/meta-lead-ads', META_LEAD_ADS_WORKER_SECRET: 'synthetic-worker-secret-123456789012345' },
    signal: controller.signal, fetchImpl: async () => { calls++; return Response.json({ complete: 1, retry: 0, blocked: 0, skipped: 0, pending: 1, blockedTotal: 0, oldestPendingSeconds: 400 }) },
    sleep: async () => controller.abort(), report: value => reports.push(value) })
  assert.equal(result.ticks, 1); assert.equal(calls, 1); assert.equal(reports[0].severity, 'alert')
})
