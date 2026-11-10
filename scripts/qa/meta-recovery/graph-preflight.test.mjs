import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, readFile, rm, readdir, link, symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID, createHash} from 'node:crypto'
import {runGraphPreflight} from './graph-preflight.mjs'

const APP = '2523488421395251', PAGE = '1449474971582722', FORM = '2046130655900851'
// Deliberately planted test strings; never real provider credentials.
const USER = 'EAA' + 'SyntheticUserOnly'.repeat(5)
const PAGE_TOKEN = 'EAA' + 'SyntheticPageOnly'.repeat(5)
const SECRET = 'abababababababababababababababab'
const SCOPES = ['leads_retrieval', 'pages_manage_metadata', 'pages_manage_ads', 'pages_show_list', 'pages_read_engagement']
const fixture = async t => {
  const parent = await mkdtemp(join(tmpdir(), 'legalhub-preflight-test-'))
  const root = join(parent, `LegalHubStageA-${randomUUID().replaceAll('-', '')}`)
  await mkdir(root)
  for (const [name, value] of Object.entries({'qa-owned.txt': 'LegalHub Stage A synthetic QA',
    'meta-user-token.txt': USER, 'meta-app-secret.txt': SECRET, 'meta-page-token.txt': '', 'meta-real-private.json': ''})) {
    await writeFile(join(root, name), value, {mode: 0o600})
  }
  t.after(() => rm(parent, {recursive: true, force: true}))
  const guarded = []
  return {root, guarded, options: {privateRoot: root, uiConfirmedAppId: APP, uiConfirmedProfile: true,
    assertPrivateFile: async path => { guarded.push(path); return true }}}
}
const successBodies = () => [
  {id: APP, name: 'Synthetic App'}, {id: '123456789012345', name: 'Valentin Xtremalist'},
  {data: SCOPES.map(permission => ({permission, status: 'granted'}))},
  {data: [{id: PAGE}]}, {id: PAGE, access_token: PAGE_TOKEN}, {id: APP}, {id: PAGE},
  {id: FORM, name: 'QA Lead Intake v1', page: {id: PAGE}}, {data: []}, {data: []},
]
const mock = (bodies = successBodies(), transform) => {
  const calls = []
  const fetchImpl = async (url, options) => {
    const index = calls.length
    calls.push({url, options})
    const body = bodies[index]
    assert.notEqual(body, undefined, 'unexpected network request')
    return transform ? transform(body, index) : new Response(JSON.stringify(body), {status: 200})
  }
  return {calls, fetchImpl}
}
const assertSafe = result => {
  const text = JSON.stringify(result)
  for (const value of [USER, PAGE_TOKEN, SECRET, APP, PAGE, FORM, 'Valentin', 'access_token', 'payload', 'office@example.test']) assert.equal(text.includes(value), false)
  assert.doesNotThrow(() => JSON.parse(text))
}
const empty = async root => {
  assert.equal(await readFile(join(root, 'meta-page-token.txt'), 'utf8'), '')
  assert.equal(await readFile(join(root, 'meta-real-private.json'), 'utf8'), '')
  assert.equal((await readdir(root)).some(x => x.startsWith('.graph-preflight-')), false)
}

test('all ten read-only checks produce only a private Page token and closed private attestation', async t => {
  const f = await fixture(t), m = mock()
  const result = await runGraphPreflight({...f.options, fetchImpl: m.fetchImpl})
  assert.equal(result.status, 'PASS'); assert.equal(result.counts.requests, 10); assertSafe(result)
  assert.equal(await readFile(join(f.root, 'meta-page-token.txt'), 'utf8'), PAGE_TOKEN)
  const state = JSON.parse(await readFile(join(f.root, 'meta-real-private.json'), 'utf8'))
  assert.equal(state.appId, APP); assert.equal(state.pageId, PAGE); assert.equal(state.formId, FORM)
  assert.equal(state.tokenSha256, createHash('sha256').update(PAGE_TOKEN).digest('hex'))
  assert.deepEqual(state.results, {tokenApp: 'PASS', tokenPage: 'PASS', formOwnership: 'PASS'})
  assert.equal(state.release, false); assert.equal(state.approvedLeadId, null)
  assert.equal(state.leadCreatedAt, null); assert.equal(state.dashboardSample, null)
  assert.deepEqual(state.originalAppSubscriptions, []); assert.deepEqual(state.originalPageSubscriptions, [])
  assert.ok(Date.now() - Date.parse(state.verifiedAt) < 3000)
  assert.equal(JSON.stringify(state).includes(USER), false); assert.equal(JSON.stringify(state).includes(SECRET), false)
  assert.equal(JSON.stringify(state).includes(PAGE_TOKEN), false)
  assert.equal((await readdir(f.root)).length, 5)
  assert.ok(f.guarded.some(x => x.includes('.graph-preflight-')))
  for (const [i, call] of m.calls.entries()) {
    const url = new URL(call.url)
    assert.equal(url.origin, 'https://graph.facebook.com'); assert.ok(url.pathname.startsWith('/v27.0/'))
    assert.equal(call.options.method, 'GET'); assert.equal(call.options.redirect, 'error'); assert.equal(call.options.cache, 'no-store')
    assert.equal(call.options.body, undefined)
    assert.deepEqual([...url.searchParams.keys()], url.searchParams.has('fields') ? ['fields'] : [])
    for (const secret of [USER, PAGE_TOKEN, SECRET]) assert.equal(call.url.includes(secret), false)
    assert.equal(call.url.includes('debug_token'), false)
    assert.equal(call.options.headers.Authorization, `Bearer ${i === 8 ? `${APP}|${SECRET}` : i < 5 ? USER : PAGE_TOKEN}`)
  }
  assert.equal(new URL(m.calls[0].url).pathname, '/v27.0/app')
  assert.equal(new URL(m.calls[4].url).searchParams.get('fields'), 'id,access_token')
})

test('wrong or unsupported issuing App fails closed without token-debug fallback or writes', async t => {
  for (const index of [0, 5]) {
    const f = await fixture(t), bodies = successBodies(); bodies[index] = {id: '1160353550276176'}
    const m = mock(bodies), result = await runGraphPreflight({...f.options, fetchImpl: m.fetchImpl})
    assert.equal(result.status, 'BLOCKED'); assert.equal(result.code, 'APP_PROVENANCE_BLOCKED')
    assert.equal(m.calls.length, index + 1); assertSafe(result); await empty(f.root)
  }
  const f = await fixture(t)
  const m = mock(successBodies(), () => new Response(JSON.stringify({error: {code: 100, message: USER + SECRET + ' office@example.test'}}), {status: 400}))
  const result = await runGraphPreflight({...f.options, fetchImpl: m.fetchImpl})
  assert.equal(result.code, 'GRAPH_HTTP'); assert.equal(result.httpStatus, 400); assert.equal(result.graphCode, 100)
  assert.equal(m.calls.length, 1); assertSafe(result); await empty(f.root)
})

test('Meta numeric subcodes above one million remain exact while nonnumeric and out-of-range data are omitted', async t => {
  for (const [code, subcode, expected] of [[190, 2534003, {graphCode: 190, graphSubcode: 2534003}],
    [2147483647, 2147483647, {graphCode: 2147483647, graphSubcode: 2147483647}],
    [2147483648, -1, {}], [USER, SECRET, {}]]) {
    const f = await fixture(t)
    const fetchImpl = async () => new Response(JSON.stringify({error: {code, error_subcode: subcode,
      message: USER + SECRET + ' office@example.test'}}), {status: 400})
    const result = await runGraphPreflight({...f.options, fetchImpl})
    assert.equal(result.status, 'BLOCKED'); assert.equal(result.code, 'GRAPH_HTTP')
    assert.deepEqual(Object.fromEntries(['graphCode', 'graphSubcode'].filter(key => key in result).map(key => [key, result[key]])), expected)
    assertSafe(result); await empty(f.root)
  }
})

test('profile, scopes, exact Page selection, Page identity and Form ownership must all match', async t => {
  const cases = [
    [1, {id: '123456789012345', name: 'Another Profile'}, 'PROFILE_NOT_CONFIRMED'],
    [2, {data: []}, 'PERMISSIONS_BLOCKED'],
    [2, {data: [...successBodies()[2].data, {permission: 'ads_management', status: 'granted'}]}, 'PERMISSIONS_BLOCKED'],
    [3, {data: [{id: PAGE}, {id: '999999999999999'}]}, 'PAGE_SELECTION_BLOCKED'],
    [3, {data: [{id: PAGE}], paging: {next: 'https://graph.facebook.com/?access_token=' + USER}}, 'PAGE_SELECTION_BLOCKED'],
    [4, {id: '999999999999999', access_token: PAGE_TOKEN}, 'PAGE_PROVENANCE_BLOCKED'],
    [6, {id: '999999999999999'}, 'PAGE_PROVENANCE_BLOCKED'],
    [7, {id: FORM, page: {id: '999999999999999'}}, 'FORM_OWNERSHIP_BLOCKED'],
    [7, {id: '999999999999999', page: {id: PAGE}}, 'FORM_OWNERSHIP_BLOCKED'],
    [8, {data: [{object: 'page', callback_url: 'https://unused.example.test/'}]}, 'EXISTING_SUBSCRIPTIONS'],
    [9, {data: [{id: APP, subscribed_fields: ['leadgen']}]}, 'EXISTING_SUBSCRIPTIONS'],
  ]
  for (const [index, value, code] of cases) {
    const f = await fixture(t), bodies = successBodies(); bodies[index] = value
    const result = await runGraphPreflight({...f.options, fetchImpl: mock(bodies).fetchImpl})
    assert.equal(result.code, code); assertSafe(result); await empty(f.root)
  }
})

test('malformed inputs, old runtime, missing UI evidence, marker and nonempty outputs block before Graph', async t => {
  const f = await fixture(t)
  for (const delta of [{uiConfirmedAppId: '1160353550276176'}, {uiConfirmedProfile: 'true'},
    {timeoutMs: 0}, {assertPrivateFile: undefined}, {privateRoot: 'relative'},
    {privateRoot: join(f.root, '..', 'LegalHubStageA-e0d6208c7f1b4b61917281dc390a8045')}]) {
    let called = false
    const result = await runGraphPreflight({...f.options, ...delta, fetchImpl: async () => { called = true; throw Error(USER) }})
    assert.equal(result.status, 'BLOCKED'); assert.equal(called, false); assertSafe(result)
  }
  for (const [name, value, code] of [['qa-owned.txt', 'Wrong marker', 'PRIVATE_FILE_REFUSED'],
    ['meta-user-token.txt', 'not a token', 'CREDENTIAL_FORMAT'], ['meta-app-secret.txt', '', 'CREDENTIAL_FORMAT'],
    ['meta-page-token.txt', 'occupied', 'OUTPUT_NOT_EMPTY'], ['meta-real-private.json', '{}', 'OUTPUT_NOT_EMPTY']]) {
    const next = await fixture(t)
    await writeFile(join(next.root, name), value)
    let called = false
    const result = await runGraphPreflight({...next.options, fetchImpl: async () => { called = true }})
    assert.equal(result.code, code); assert.equal(called, false); assertSafe(result)
  }
})

test('private file guard must explicitly pass; provider and ACL exceptions never leak', async t => {
  for (const assertPrivateFile of [async () => false, async () => undefined, async () => { throw Error(USER + SECRET + ' D:\\Private\\payload') }]) {
    const f = await fixture(t), m = mock()
    const result = await runGraphPreflight({...f.options, assertPrivateFile, fetchImpl: m.fetchImpl})
    assert.equal(result.status, 'BLOCKED'); assert.equal(m.calls.length, 0); assertSafe(result); await empty(f.root)
  }
  const f = await fixture(t)
  const result = await runGraphPreflight({...f.options, fetchImpl: async () => { throw Error(USER + SECRET + ' office@example.test') }})
  assert.equal(result.code, 'GRAPH_TRANSPORT'); assertSafe(result); await empty(f.root)
})

test('hardlinked credentials are refused even when a caller ACL callback would pass', async t => {
  const f = await fixture(t)
  await link(join(f.root, 'meta-user-token.txt'), join(f.root, 'credential-alias.txt'))
  const m = mock(), result = await runGraphPreflight({...f.options, fetchImpl: m.fetchImpl})
  assert.equal(result.code, 'PRIVATE_FILE_REFUSED'); assert.equal(m.calls.length, 0); assertSafe(result)
})

test('junction or symlink private root is refused before credentials or Graph', async t => {
  const f = await fixture(t)
  const alias = join(f.root, '..', `LegalHubStageA-${randomUUID().replaceAll('-', '')}`)
  await symlink(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir')
  const m = mock(), result = await runGraphPreflight({...f.options, privateRoot: alias, fetchImpl: m.fetchImpl})
  assert.equal(result.code, 'PRIVATE_FILE_REFUSED'); assert.equal(m.calls.length, 0); assertSafe(result)
})

test('bounded timeout, oversized body and malformed UTF-8/JSON safely block', async t => {
  const scenarios = [
    [() => new Promise(() => {}), 'GRAPH_TIMEOUT', 10],
    [() => new Response('x'.repeat(65537), {status: 200}), 'GRAPH_RESPONSE_LIMIT'],
    [() => new Response('{broken ' + USER, {status: 200}), 'GRAPH_RESPONSE_INVALID'],
    [() => new Response(new Uint8Array([0xff, 0xfe]), {status: 200}), 'GRAPH_RESPONSE_INVALID'],
    [() => new Response('{}', {status: 429}), 'GRAPH_HTTP'],
  ]
  for (const [fetchImpl, code, timeoutMs] of scenarios) {
    const f = await fixture(t), started = Date.now()
    const result = await runGraphPreflight({...f.options, fetchImpl, ...(timeoutMs ? {timeoutMs} : {})})
    assert.equal(result.code, code); assertSafe(result); await empty(f.root)
    assert.ok(Date.now() - started < 3000)
  }
})

test('staged secret receives ACL approval before writing and write failure never produces PASS attestation', async t => {
  const f = await fixture(t), seen = []
  const guard = async path => {
    if (path.includes('.graph-preflight-')) {
      seen.push(await readFile(path, 'utf8'))
      return false
    }
    return true
  }
  const result = await runGraphPreflight({...f.options, assertPrivateFile: guard, fetchImpl: mock().fetchImpl})
  assert.equal(result.code, 'PRIVATE_WRITE_FAILED'); assert.deepEqual(seen, ['']); assertSafe(result); await empty(f.root)
})

async function priorAttestation(f, extra = {}) {
  const prior = {appId: APP, pageId: PAGE, formId: FORM, verifiedAt: new Date(Date.now() - 7200000).toISOString(),
    tokenSha256: createHash('sha256').update(PAGE_TOKEN).digest('hex'),
    results: {tokenApp: 'PASS', tokenPage: 'PASS', formOwnership: 'PASS'},
    release: false, approvedLeadId: null, leadCreatedAt: null, dashboardSample: null,
    originalAppSubscriptions: [], originalPageSubscriptions: [], ...extra}
  await writeFile(join(f.root, 'meta-page-token.txt'), PAGE_TOKEN)
  await writeFile(join(f.root, 'meta-real-private.json'), JSON.stringify(prior))
  return prior
}
test('explicit closed refresh repeats all ten checks using unchanged credentials and preserves closure/test metadata', async t => {
  const f = await fixture(t), closed = new Date(Date.now() - 7100000).toISOString(), earliest = new Date(Date.now() - 7200000).toISOString()
  const previousTestLead = {id: '900000000000001', formId: FORM, createdAt: new Date(Date.now() - 86400000).toISOString(),
    retrievalConfirmed: true, verifiedAt: new Date(Date.now() - 600000).toISOString(), deleted: true, deletedAt: closed}
  const before = await priorAttestation(f, {closedAt: closed, earliestClosedAt: earliest,
    previousTestLead, oldTestCheckAt: closed, createAttemptAt: null})
  const m = mock(), result = await runGraphPreflight({...f.options, refreshClosed: true, fetchImpl: m.fetchImpl})
  assert.equal(result.status, 'PASS'); assert.equal(m.calls.length, 10); assertSafe(result)
  const after = JSON.parse(await readFile(join(f.root, 'meta-real-private.json'), 'utf8'))
  assert.ok(Date.parse(after.verifiedAt) > Date.parse(before.verifiedAt)); assert.ok(Date.now() - Date.parse(after.verifiedAt) < 3000)
  assert.deepEqual(after.previousTestLead, previousTestLead); assert.equal(after.oldTestCheckAt, closed)
  assert.equal(after.closedAt, earliest); assert.equal(after.earliestClosedAt, earliest); assert.equal(after.createAttemptAt, null)
  assert.equal(after.release, false); assert.equal(after.approvedLeadId, null); assert.equal(after.dashboardSample, null)
  assert.equal(after.tokenSha256, before.tokenSha256)
  assert.equal(await readFile(join(f.root, 'meta-page-token.txt'), 'utf8'), PAGE_TOKEN)
  assert.equal(m.calls.every(x => x.options.method === 'GET'), true)
})
test('refresh cannot change live state, originals, completed attempt or current token association', async t => {
  for (const extra of [{release: 'false'}, {release: true}, {approvedLeadId: '900000000000002'},
    {leadCreatedAt: new Date().toISOString()}, {dashboardSample: {}}, {createAttemptAt: new Date().toISOString()},
    {tokenSha256: '0'.repeat(64)}, {appId: '1160353550276176'}, {originalAppSubscriptions: [{}]},
    {originalPageSubscriptions: [{}]}, {verifiedAt: new Date(Date.now() + 60000).toISOString()},
    {closedAt: 'not a date'}, {previousTestLead: {id: 'bad'}}]) {
    const f = await fixture(t), before = await priorAttestation(f, extra), m = mock([])
    const result = await runGraphPreflight({...f.options, refreshClosed: true, fetchImpl: m.fetchImpl})
    assert.equal(result.code, 'REFRESH_STATE_REFUSED'); assert.equal(m.calls.length, 0); assertSafe(result)
    assert.deepEqual(JSON.parse(await readFile(join(f.root, 'meta-real-private.json'), 'utf8')), before)
  }
  const f = await fixture(t); await priorAttestation(f)
  const noFlag = await runGraphPreflight({...f.options, fetchImpl: mock([]).fetchImpl})
  assert.equal(noFlag.code, 'OUTPUT_NOT_EMPTY')
  const badFlag = await runGraphPreflight({...f.options, refreshClosed: 'true', fetchImpl: mock([]).fetchImpl})
  assert.equal(badFlag.code, 'INVALID_INPUT')
})
test('refresh requests only Page identity and revalidates the original stored token without adopting any returned token', async t => {
  const f = await fixture(t), before = await priorAttestation(f), bodies = successBodies()
  const differentToken = 'EAA' + 'AnotherPlantedPageOnly'.repeat(4)
  bodies[4] = {id: PAGE, access_token: differentToken}
  const m = mock(bodies), result = await runGraphPreflight({...f.options, refreshClosed: true, fetchImpl: m.fetchImpl})
  assert.equal(result.status, 'PASS'); assert.equal(m.calls.length, 10); assertSafe(result)
  assert.equal(new URL(m.calls[4].url).searchParams.get('fields'), 'id')
  for (const index of [5, 6, 7, 9]) assert.equal(m.calls[index].options.headers.Authorization, 'Bearer ' + PAGE_TOKEN)
  assert.equal(await readFile(join(f.root, 'meta-page-token.txt'), 'utf8'), PAGE_TOKEN)
  const after = JSON.parse(await readFile(join(f.root, 'meta-real-private.json'), 'utf8'))
  assert.equal(after.tokenSha256, before.tokenSha256); assert.equal(after.release, false)
  assert.equal(JSON.stringify(after).includes(differentToken), false); assert.equal(JSON.stringify(result).includes(differentToken), false)
})
test('expired User or stored Page token and new remote subscriptions never refresh timestamp', async t => {
  for (const mode of ['expired-user', 'expired-stored-page', 'new-subscription']) {
    const f = await fixture(t), before = await priorAttestation(f), bodies = successBodies()
    if (mode === 'new-subscription') bodies[9] = {data: [{id: APP, subscribed_fields: ['leadgen']}]}
    const m = mock(bodies, (body, index) => (mode === 'expired-user' && index === 0 || mode === 'expired-stored-page' && index === 5) ?
      new Response(JSON.stringify({error: {code: 190, error_subcode: 463, message: USER + ' expired'}}), {status: 400}) :
      new Response(JSON.stringify(body), {status: 200}))
    const result = await runGraphPreflight({...f.options, refreshClosed: true, fetchImpl: m.fetchImpl})
    assert.equal(result.status, 'BLOCKED'); assertSafe(result)
    if (mode === 'expired-user') { assert.equal(result.graphCode, 190); assert.equal(result.graphSubcode, 463); assert.equal(m.calls.length, 1) }
    if (mode === 'expired-stored-page') { assert.equal(result.graphCode, 190); assert.equal(result.graphSubcode, 463); assert.equal(m.calls.length, 6) }
    assert.deepEqual(JSON.parse(await readFile(join(f.root, 'meta-real-private.json'), 'utf8')), before)
    assert.equal(await readFile(join(f.root, 'meta-page-token.txt'), 'utf8'), PAGE_TOKEN)
  }
})
test('refresh refuses concurrent private state changes and never overwrites a new create-attempt marker', async t => {
  const f = await fixture(t), before = await priorAttestation(f)
  const marker = new Date().toISOString(), bodies = successBodies()
  const m = mock(bodies, async (body, index) => {
    if (index === 9) await writeFile(join(f.root, 'meta-real-private.json'), JSON.stringify({...before, createAttemptAt: marker}))
    return new Response(JSON.stringify(body), {status: 200})
  })
  const result = await runGraphPreflight({...f.options, refreshClosed: true, fetchImpl: m.fetchImpl})
  assert.equal(result.code, 'PRIVATE_WRITE_FAILED'); assertSafe(result)
  const after = JSON.parse(await readFile(join(f.root, 'meta-real-private.json'), 'utf8'))
  assert.equal(after.createAttemptAt, marker); assert.equal(after.verifiedAt, before.verifiedAt)
})
