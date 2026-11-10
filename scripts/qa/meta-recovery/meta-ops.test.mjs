import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID, createHash} from 'node:crypto'
import {runMetaOps} from './meta-ops.mjs'

const APP = '2523488421395251', PAGE = '1449474971582722', FORM = '2046130655900851'
const HOST = 'unit-handsfree-carpentry.ngrok-free.dev', CALLBACK = `https://${HOST}/api/webhooks/meta/lead-ads`
const TOKEN = 'EAA' + 'SyntheticPageOnly'.repeat(5), SECRET = 'abababababababababababababababab'
const VERIFY = 'SyntheticVerifyOnly'.repeat(3)
const EMPTY = () => ({data: []})
const OUR_APP = () => ({data: [{object: 'page', callback_url: CALLBACK, active: true, fields: [{name: 'leadgen', version: 'v27.0'}]}]})
const OUR_PAGE = () => ({data: [{id: APP, subscribed_fields: ['leadgen']}]})
const fixture = async t => {
  const parent = await mkdtemp(join(tmpdir(), 'legalhub-meta-ops-test-'))
  t.after(() => rm(parent, {recursive: true, force: true}))
  const root = join(parent, 'LegalHubStageA-' + randomUUID().replaceAll('-', '')), artifacts = join(parent, 'artifacts')
  await mkdir(root); await mkdir(artifacts)
  const runtime = {privateDirectory: root, appId: APP, approvedMetaAppId: APP, pageId: PAGE, formId: FORM,
    hostname: HOST, graphVersion: 'v27.0', secrets: {verifyToken: VERIFY}}
  const state = {appId: APP, pageId: PAGE, formId: FORM, verifiedAt: new Date().toISOString(),
    tokenSha256: createHash('sha256').update(TOKEN).digest('hex'), results: {tokenApp: 'PASS', tokenPage: 'PASS', formOwnership: 'PASS'},
    originalAppSubscriptions: [], originalPageSubscriptions: [], release: false}
  for (const [name, value] of Object.entries({'qa-owned.txt': 'LegalHub Stage A synthetic QA',
    'meta-page-token.txt': TOKEN, 'meta-app-secret.txt': SECRET, 'runtime.json': JSON.stringify(runtime),
    'meta-real-private.json': JSON.stringify(state)})) await writeFile(join(root, name), value, {mode: 0o600})
  const resultFile = join(artifacts, 'result.json')
  await writeFile(resultFile, '{"phase":"prepare","status":"READY"}\n')
  return {root, runtime, state, resultFile, options: {privateRoot: root, assertPrivateFile: async () => true,
    artifacts: {root: artifacts, paths: [resultFile]}}}
}
function mock(sequence, transform) {
  const calls = []
  return {calls, fetchImpl: async (url, init) => {
    const index = calls.length; calls.push({url, init})
    assert.ok(index < sequence.length, 'unexpected request')
    return transform ? transform(sequence[index], index) : new Response(JSON.stringify(sequence[index]), {status: 200})
  }}
}
function safe(result) {
  const text = JSON.stringify(result)
  for (const value of [TOKEN, SECRET, VERIFY, APP, PAGE, FORM, HOST, 'office@example.test']) assert.equal(text.includes(value), false)
}
test('configure changes only exact QA App/Page leadgen using body fields and header credentials', async t => {
  const f = await fixture(t), m = mock([EMPTY(), EMPTY(), {success: true}, OUR_APP(), {success: true}, OUR_PAGE()])
  const result = await runMetaOps({...f.options, action: 'configure', fetchImpl: m.fetchImpl})
  assert.equal(result.status, 'PASS'); assert.equal(result.counts.requests, 6); assert.equal(result.counts.accepted, 2); safe(result)
  const expected = [['GET', 'app'], ['GET', 'page'], ['POST', 'app'], ['GET', 'app'], ['POST', 'page'], ['GET', 'page']]
  for (const [index, {url, init}] of m.calls.entries()) {
    const [method, kind] = expected[index], parsed = new URL(url)
    assert.equal(init.method, method); assert.equal(parsed.origin, 'https://graph.facebook.com')
    assert.equal(parsed.pathname, `/v27.0/${kind === 'app' ? APP + '/subscriptions' : PAGE + '/subscribed_apps'}`)
    assert.equal(init.headers.Authorization, `Bearer ${kind === 'app' ? APP + '|' + SECRET : TOKEN}`)
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store')
    for (const secret of [TOKEN, SECRET, VERIFY]) assert.equal(url.includes(secret), false)
    assert.ok([...parsed.searchParams.keys()].every(key => key === 'fields'))
  }
  assert.deepEqual(Object.fromEntries(new URLSearchParams(m.calls[2].init.body)), {object: 'page', fields: 'leadgen', callback_url: CALLBACK, verify_token: VERIFY})
  assert.deepEqual(Object.fromEntries(new URLSearchParams(m.calls[4].init.body)), {subscribed_fields: 'leadgen'})
  assert.equal(await readFile(f.resultFile, 'utf8'), '{"phase":"prepare","status":"READY"}\n')
})
test('verify and already configured state use only reads; missing setup is not PASS', async t => {
  for (const action of ['verify', 'configure']) {
    const f = await fixture(t), m = mock([OUR_APP(), OUR_PAGE()])
    const result = await runMetaOps({...f.options, action, fetchImpl: m.fetchImpl})
    assert.equal(result.status, 'PASS'); assert.equal(result.counts.accepted, 0); assert.equal(m.calls.length, 2); safe(result)
  }
  const f = await fixture(t), m = mock([EMPTY(), EMPTY()])
  const result = await runMetaOps({...f.options, action: 'verify', fetchImpl: m.fetchImpl})
  assert.equal(result.code, 'READBACK_BLOCKED'); safe(result)
})
test('restore removes only our Page install then our App page object; empty is idempotent', async t => {
  const f = await fixture(t), m = mock([OUR_APP(), OUR_PAGE(), {success: true}, EMPTY(), {success: true}, EMPTY()])
  const result = await runMetaOps({...f.options, action: 'restore', fetchImpl: m.fetchImpl})
  assert.equal(result.status, 'PASS'); assert.equal(result.counts.accepted, 2); safe(result)
  assert.equal(m.calls[2].init.method, 'DELETE'); assert.ok(m.calls[2].url.includes(PAGE + '/subscribed_apps'))
  assert.equal(m.calls[2].init.body, '')
  assert.equal(m.calls[4].init.method, 'DELETE'); assert.ok(m.calls[4].url.includes(APP + '/subscriptions'))
  assert.equal(m.calls[4].init.body, 'object=page')
  const next = await fixture(t), empty = mock([EMPTY(), EMPTY()])
  assert.equal((await runMetaOps({...next.options, action: 'restore', fetchImpl: empty.fetchImpl})).status, 'PASS')
  assert.equal(empty.calls.length, 2)
})
test('foreign App, callback, fields, objects or pagination block all mutations', async t => {
  const cases = [
    [{data: [{...OUR_APP().data[0], callback_url: 'https://another.example.test/'}]}, EMPTY()],
    [{data: [{...OUR_APP().data[0], fields: ['leadgen', 'messages']}]}, EMPTY()],
    [{data: [OUR_APP().data[0], {...OUR_APP().data[0], object: 'user'}]}, EMPTY()],
    [OUR_APP(), {data: [{id: '999999999999999', subscribed_fields: ['leadgen']}]}],
    [OUR_APP(), {data: [{id: APP, subscribed_fields: ['leadgen', 'message_echoes']}]}],
    [OUR_APP(), {data: [OUR_PAGE().data[0], {id: '999999999999999', subscribed_fields: ['leadgen']}]}],
    [{data: [], paging: {next: 'https://graph.facebook.com/?access_token=' + TOKEN}}, EMPTY()],
  ]
  for (const action of ['configure', 'restore']) for (const sequence of cases) {
    const f = await fixture(t), m = mock(sequence)
    const result = await runMetaOps({...f.options, action, fetchImpl: m.fetchImpl})
    assert.equal(result.code, 'SUBSCRIPTION_STATE_REFUSED'); assert.equal(m.calls.some(x => x.init.method !== 'GET'), false); safe(result)
  }
})
test('wrong binding, token hash, originals, release or stale configure attestation blocks before Graph', async t => {
  const cases = [
    ['runtime', {appId: '1160353550276176'}], ['runtime', {hostname: 'another.example.test'}],
    ['runtime', {formId: '999999999999999'}], ['state', {tokenSha256: '0'.repeat(64)}],
    ['state', {originalAppSubscriptions: [{}]}], ['state', {originalPageSubscriptions: [{}]}],
    ['state', {release: true}], ['state', {release: 'false'}],
    ['state', {verifiedAt: new Date(Date.now() - 3600001).toISOString()}],
  ]
  for (const [kind, change] of cases) {
    const f = await fixture(t), m = mock([])
    await writeFile(join(f.root, kind === 'runtime' ? 'runtime.json' : 'meta-real-private.json'), JSON.stringify({...f[kind], ...change}))
    const result = await runMetaOps({...f.options, action: 'configure', fetchImpl: m.fetchImpl})
    assert.equal(result.status, 'BLOCKED'); assert.equal(m.calls.length, 0); safe(result)
  }
  const f = await fixture(t), m = mock([EMPTY(), EMPTY()])
  await writeFile(join(f.root, 'meta-real-private.json'), JSON.stringify({...f.state, verifiedAt: new Date(Date.now() - 7200000).toISOString()}))
  assert.equal((await runMetaOps({...f.options, action: 'restore', fetchImpl: m.fetchImpl})).status, 'PASS')
})
test('planted secrets in explicit public artifacts block before and after operations', async t => {
  const f = await fixture(t), m = mock([])
  await writeFile(f.resultFile, VERIFY)
  const result = await runMetaOps({...f.options, action: 'configure', fetchImpl: m.fetchImpl})
  assert.equal(result.code, 'ARTIFACT_SCAN_BLOCKED'); assert.equal(m.calls.length, 0); safe(result)
  const next = await fixture(t), changed = mock([OUR_APP(), OUR_PAGE()], async (body, index) => {
    if (index === 1) await writeFile(next.resultFile, SECRET)
    return new Response(JSON.stringify(body), {status: 200})
  })
  const after = await runMetaOps({...next.options, action: 'verify', fetchImpl: changed.fetchImpl})
  assert.equal(after.code, 'ARTIFACT_SCAN_BLOCKED'); safe(after)
})
test('raw provider errors stay private; numeric subcodes preserved; ambiguous mutation never retries', async t => {
  const f = await fixture(t)
  const result = await runMetaOps({...f.options, action: 'verify', fetchImpl: async () => new Response(JSON.stringify({error:
    {code: 190, error_subcode: 2534003, message: TOKEN + SECRET + VERIFY + ' office@example.test'}}), {status: 400})})
  assert.equal(result.code, 'GRAPH_HTTP'); assert.equal(result.graphSubcode, 2534003); safe(result)
  for (const response of [{success: false}, {ok: true}]) {
    const f = await fixture(t), m = mock([EMPTY(), EMPTY(), response])
    const blocked = await runMetaOps({...f.options, action: 'configure', fetchImpl: m.fetchImpl})
    assert.equal(blocked.code, 'MUTATION_NOT_CONFIRMED'); assert.equal(m.calls.length, 3); safe(blocked)
  }
})
test('post mutation readback mismatch stops before Page installation, and slow/oversized responses are bounded', async t => {
  const f = await fixture(t), m = mock([EMPTY(), EMPTY(), {success: true}, EMPTY()])
  const result = await runMetaOps({...f.options, action: 'configure', fetchImpl: m.fetchImpl})
  assert.equal(result.code, 'READBACK_BLOCKED'); assert.equal(result.counts.accepted, 1); assert.equal(m.calls.length, 4); safe(result)
  for (const [fetchImpl, code] of [[() => new Promise(() => {}), 'GRAPH_TIMEOUT'],
    [() => new Response('x'.repeat(65537)), 'GRAPH_RESPONSE_LIMIT']]) {
    const next = await fixture(t), start = Date.now()
    const blocked = await runMetaOps({...next.options, action: 'verify', fetchImpl, timeoutMs: 10})
    assert.equal(blocked.code, code); assert.ok(Date.now() - start < 3000); safe(blocked)
  }
})
