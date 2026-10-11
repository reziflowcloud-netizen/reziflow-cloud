import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server.js'
import { cronAuthorized } from '../src/lib/pushSecurity.ts'
import { continuationInput, runQstashNotificationChunk, enqueueNotificationContinuation, diagnoseQstashNotificationTransport } from '../src/lib/notificationQstash.mjs'
const require = createRequire(import.meta.url)
const secret = 'synthetic-Qstash-cron-secret-123456789', token = 'synthetic-Qstash-API-token-1234567890'
const origin = 'https://legalhubcrm.com'

test('QStash walks all entity pages and delivery drain through the existing runner', async () => {
  let input = {}, pending, page = 0
  const calls = [], expected = [null, 'task:t25', 'case:', 'case:c25', 'lead:', 'lead:l25']
  const fetchPage = async (url, options) => {
    assert.equal(url.origin, origin); assert.equal(options.headers.Authorization, `Bearer ${secret}`)
    assert.equal(url.searchParams.get('cursor'), expected[page] ?? null)
    calls.push(url.search); page++
    return Response.json({ evaluated: 25, notificationsCreated: 1, nextCursor: expected[page] || null, push: { processed: page === 6 ? 20 : 0, delivered: page === 6 ? 20 : 0 } })
  }
  for(let step = 0; step < 7; step++) {
    pending = null
    const result = await runQstashNotificationChunk({ input, messageId: 'msg-initial', secret, token, fetchPage: step === 6 ? async url => { calls.push(url.search); return Response.json({ evaluated: 0, nextCursor: null, push: { processed: 0, delivered: 0 } }) } : fetchPage, enqueue: async job => { pending = job.continuation } })
    assert.equal(result.complete, step === 6)
    assert.equal(result.continuationQueued, step !== 6)
    if (pending) input = pending
  }
  assert.equal(calls.length, 7); assert.equal(calls.at(-1), '?delivery=only')
})

test('QStash retry replays the same page and never acknowledges a failed hand-off', async () => {
  const records = new Set(), forwarded = []
  const input = {}, fetchPage = async () => { records.add('synthetic-event'); return Response.json({ evaluated: 1, nextCursor: 'case:', push: { processed: 0, delivered: 0 } }) }
  const config = { input, messageId: 'same-source', secret, token, fetchPage }
  await assert.rejects(runQstashNotificationChunk({ ...config, enqueue: async job => { forwarded.push(job.continuation); throw new Error('PRIVATE_PROVIDER_ERROR') } }))
  await runQstashNotificationChunk({ ...config, enqueue: async job => { forwarded.push(job.continuation) } })
  assert.equal(records.size, 1); assert.deepEqual(forwarded[0], forwarded[1])
  let tries = 0
  await assert.rejects(runQstashNotificationChunk({ ...config, fetchPage: async () => { tries++; return new Response('', { status: 503 }) } }))
  assert.equal(tries, 1, 'QStash owns bounded retries; no nested retry multiplication')
})

test('QStash rejects foreign origins, malformed checkpoints, cycles and unbounded messages', async () => {
  for(const input of [[], { url: 'https://foreign.test' }, { runId: 'run', page: 200, state: {} }, { runId: 'run', page: 1, state: { origin: 'https://foreign.test', cursor: null, deliveryOnly: false } }, { runId: 'run', page: 1, state: { origin, cursor: 'https://foreign.test', deliveryOnly: false } }, { runId: 'run', page: 1, state: { origin, cursor: 'case:', deliveryOnly: true } }]) assert.throws(() => continuationInput(input, 'msg', origin))
  assert.throws(() => continuationInput({}, null, origin))
  await assert.rejects(runQstashNotificationChunk({ input: { runId: 'run', page: 199, state: { origin, cursor: 'case:', deliveryOnly: false } }, messageId: 'msg', secret, token, fetchPage: async () => Response.json({ evaluated: 1, nextCursor: 'lead:', push: { processed: 0, delivered: 0 } }) }), /page limit/)
})

test('continuation uses fixed HTTPS destination, header-only secrets, redaction and stable publish dedupe', async () => {
  const continuation = { runId: 'run', page: 1, state: { origin, cursor: 'case:', deliveryOnly: false } }, requests = []
  const fetchApi = async (url, options) => { requests.push({ url, options }); return Response.json({ messageId: 'msg-next' }) }
  for(let i = 0; i < 2; i++) await enqueueNotificationContinuation({ secret, token, continuation, fetchApi })
  assert.equal(requests[0].url, 'https://qstash-eu-central-1.upstash.io/v2/enqueue/legalhub-production-notifications/https://legalhubcrm.com/api/internal/notifications')
  const { headers, body } = requests[0].options
  assert.equal(headers['Upstash-Forward-Authorization'], `Bearer ${secret}`)
  assert.equal(headers['Upstash-Retries'], '2'); assert.equal(headers['Upstash-Redact-Fields'], 'body,header[Authorization]')
  assert.equal(headers['Upstash-Deduplication-Id'], requests[1].options.headers['Upstash-Deduplication-Id'])
  for(const value of [body, requests[0].url]) { assert.ok(!value.includes(secret)); assert.ok(!value.includes(token)) }
})

function route(job) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync('src/app/api/internal/notifications/route.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Function('require','exports',code)(id => id === '@/lib/pushSecurity' ? { cronAuthorized } : id === '@/lib/notificationQstash.mjs' ? { continuationInput, runQstashNotificationChunk: job, diagnoseQstashNotificationTransport } : id.startsWith('@/lib/') ? {} : require(id), exports)
  return exports.POST
}
test('actual POST fails closed before generation, bounds input and sanitizes transient errors', async () => {
  const saved = { ...process.env }; let jobs = 0
  const post = route(async () => { jobs++; throw new Error(`PRIVATE ${secret}`) })
  const send = (body = '{}', auth = `Bearer ${secret}`) => post(new NextRequest(origin + '/api/internal/notifications', { method: 'POST', headers: { authorization: auth, 'upstash-message-id': 'msg' }, body }))
  try {
    process.env.CRON_SECRET = secret; process.env.NOTIFICATION_QSTASH_ENABLED = 'true'; process.env.QSTASH_TOKEN = token
    for(const auth of ['', 'Bearer wrong']) assert.equal((await send('{}', auth)).status, 401)
    process.env.NOTIFICATION_QSTASH_ENABLED = 'false'; assert.equal((await send()).status, 503)
    process.env.NOTIFICATION_QSTASH_ENABLED = 'true'
    for(const body of ['[]', 'bad', ' '.repeat(1025), '{"url":"https://foreign.test"}']) assert.equal((await send(body)).status, 400)
    assert.equal(jobs, 0)
    const failed = await send(); assert.equal(failed.status, 503); assert.equal(failed.headers.get('retry-after'), '15'); assert.ok(!(await failed.text()).includes(secret))
    assert.equal(jobs, 1)
  } finally { for(const key of ['CRON_SECRET','NOTIFICATION_QSTASH_ENABLED','QSTASH_TOKEN']) { if(saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key] } }
})

test('authenticated diagnostic POST walks continuations entirely in memory without generation or provider requests', async () => {
  const saved = { ...process.env }; let jobs = 0, networkCalls = 0
  const originalFetch = globalThis.fetch
  const post = route(async () => { jobs++; throw new Error('Business runner must not execute') })
  const send = (auth, body = '{"mode":"diagnostic"}') => post(new NextRequest(origin + '/api/internal/notifications', { method: 'POST', headers: { authorization: auth }, body }))
  try {
    process.env.CRON_SECRET = secret; process.env.NOTIFICATION_QSTASH_ENABLED = 'true'; process.env.QSTASH_TOKEN = token
    globalThis.fetch = async () => { networkCalls++; throw new Error('Network must not execute') }
    for (const auth of ['', 'Bearer wrong']) assert.equal((await send(auth)).status, 401)
    assert.equal((await send(`Bearer ${secret}`, '{"mode":"diagnostic","url":"https://foreign.test"}')).status, 400)
    const response = await send(`Bearer ${secret}`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { diagnostic: true, generationInvoked: false, providerInvoked: false, nextCursorOrchestration: 'PASS', chunks: 4 })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(jobs, 0); assert.equal(networkCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
    for (const key of ['CRON_SECRET','NOTIFICATION_QSTASH_ENABLED','QSTASH_TOKEN']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key] }
  }
})
