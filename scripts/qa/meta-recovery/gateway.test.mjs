import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp, writeFile, readFile, rm, realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {randomBytes, createHmac} from 'node:crypto'
import {realGateway} from './gateway.mjs'

const canonical = value => JSON.stringify(value, (_key, child) => child && typeof child === 'object' && !Array.isArray(child)
  ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b))) : child)
const sample = () => ({object: 'page', entry: [{id: '0', time: 123456, changes: [{field: 'leadgen', value: {
  page_id: '444444444444', form_id: '444444444444', leadgen_id: '444444444444', created_time: 123456,
}}]}]})
const event = (page, form, lead = '900000000000001') => ({object: 'page', entry: [{id: page, changes: [{field: 'leadgen', value: {page_id: page, form_id: form, leadgen_id: lead}}]}]})

async function setup(t) {
  const tempParent = await realpath(tmpdir()), root = await mkdtemp(join(tempParent, 'legalhub-real-gateway-unit-'))
  let upstreamRequests = 0, lastForwarded = null
  const upstream = createServer((req, res) => {
    upstreamRequests++;const chunks=[];req.on('data', chunk=>chunks.push(chunk));req.once('end', () => {
      lastForwarded={raw:Buffer.concat(chunks),signature:req.headers['x-hub-signature-256']}
      res.writeHead(200, {'Content-Type': 'application/json'});res.end('{"private":"not-a-public-response"}')
    })
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const secret = randomBytes(32).toString('hex'), verifyToken = randomBytes(32).toString('hex')
  const config = {appId: '900000000000123', approvedMetaAppId: '900000000000123', pageId: '1449474971582722',
    formId: '2046130655900851', appPort: upstream.address().port, privateDirectory: root, stopFile: join(root, 'STOP'), secrets: {verifyToken}}
  const stateFile = join(root, 'meta-real-private.json')
  await writeFile(stateFile, JSON.stringify({release: false, approvedLeadId: null}))
  const gate = realGateway(config, secret)
  await new Promise(resolve => gate.listen(0, '127.0.0.1', resolve))
  const url = 'http://127.0.0.1:' + gate.address().port, path = '/api/webhooks/meta/lead-ads'
  t.after(async () => {
    const gateClosed = new Promise(resolve => gate.once('close', resolve));gate.seal();await gateClosed
    upstream.closeAllConnections();await new Promise(resolve => upstream.close(resolve))
    assert.ok(resolve(root).startsWith(resolve(tempParent) + (process.platform === 'win32' ? '\\' : '/')))
    await rm(root, {recursive: true, force: true})
  })
  const state = value => writeFile(stateFile, JSON.stringify(value))
  const post = async (body, signature, targetPath = path) => {
    const raw = typeof body === 'string' ? body : JSON.stringify(body)
    const response = await fetch(url + targetPath, {method: 'POST', headers: {'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature ?? 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')}, body: raw})
    return {status: response.status, body: await response.text()}
  }
  const arm = async (body, expiresAt = new Date(Date.now() + 30000).toISOString()) => state({release: false,
    approvedLeadId: null, dashboardSample: {expiresAt, expectedCanonical: canonical(body)}})
  return {config, gate, root, secret, state, arm, post, url, path, validEvent: () => event(config.pageId, config.formId), upstreamRequests: () => upstreamRequests, lastForwarded:()=>lastForwarded}
}

test('constructor rejects retired App and mismatched approved App', async t => {
  const f = await setup(t)
  assert.throws(() => realGateway({...f.config, appId: '1160353550276176', approvedMetaAppId: '1160353550276176'}, f.secret), /QA_TARGET_REFUSED/)
  assert.throws(() => realGateway({...f.config, approvedMetaAppId: '900000000000124'}, f.secret), /QA_TARGET_REFUSED/)
  assert.throws(() => realGateway({...f.config, appId: 900000000000123, approvedMetaAppId: 900000000000123}, f.secret), /QA_TARGET_REFUSED/)
  assert.throws(() => realGateway({...f.config, formId: 2046130655900851}, f.secret), /QA_TARGET_REFUSED/)
  assert.throws(() => realGateway({...f.config, formId: '0'}, f.secret), /QA_TARGET_REFUSED/)
})

test('constructor rejects non-numeric port authority and weak signing material', async t => {
  const f = await setup(t)
  assert.throws(() => realGateway({...f.config, appPort: '1234@outside.invalid'}, f.secret))
  assert.throws(() => realGateway(f.config, 'too-short'))
  assert.throws(() => realGateway({...f.config, secrets: {verifyToken: 'short'}}, f.secret))
})

test('only exact callback route/methods and authenticated challenge are accepted', async t => {
  const f = await setup(t)
  for (const path of ['/login', '/api/auth/login', '/api/internal/meta-lead-ads', '/api/tunnels']) {
    const r = await fetch(f.url + path);await r.text();assert.equal(r.status, 404)
  }
  let r = await fetch(f.url + f.path, {method: 'PUT'});await r.text();assert.equal(r.status, 405)
  r = await fetch(f.url + f.path + '?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=fixture');await r.text();assert.equal(r.status, 403)
  r = await fetch(f.url + f.path + '?hub.mode=subscribe&hub.verify_token=' + f.config.secrets.verifyToken + '&hub.challenge=fixture')
  assert.equal(r.status, 200);assert.equal(await r.text(), 'fixture')
  const audit = await readFile(join(f.root, 'real-http-audit.json'), 'utf8')
  assert.ok(!audit.includes(f.config.secrets.verifyToken));assert.equal(f.upstreamRequests(), 0)
})

test('bad HMAC, unknown Page/Form/field and oversized body are rejected', async t => {
  const f = await setup(t)
  assert.equal((await f.post(f.validEvent(), 'sha256=invalid')).status, 401)
  assert.equal((await f.post(event('900000000000999', f.config.formId))).status, 403)
  assert.equal((await f.post(event(f.config.pageId, '900000000000999'))).status, 403)
  const message = f.validEvent();message.entry[0].changes[0].field = 'messages'
  assert.equal((await f.post(message)).status, 403)
  assert.equal((await f.post('x'.repeat(65537))).status, 413)
  assert.equal(f.upstreamRequests(), 0)
})

test('default closed intake and unknown exact Lead ID do not forward', async t => {
  const f = await setup(t)
  assert.equal((await f.post(f.validEvent())).status, 503)
  await f.state({release: true, approvedLeadId: '900000000000002', leadCreatedAt: new Date().toISOString()})
  assert.equal((await f.post(f.validEvent())).status, 503)
  assert.equal(f.upstreamRequests(), 0)
})

for(const release of ['false', 1]) {
  test('malformed release ' + JSON.stringify(release) + ' never opens exact intake', async t => {
    const f=await setup(t)
    await f.state({release,approvedLeadId:'900000000000001',leadCreatedAt:new Date().toISOString()})
    assert.equal((await f.post(f.validEvent())).status,503)
    assert.equal(f.upstreamRequests(),0)
  })
}

test('exact genuine-event path forwards unchanged bytes and sanitizes upstream body', async t => {
  const f = await setup(t)
  await f.state({release: true, approvedLeadId: '900000000000001', leadCreatedAt: new Date().toISOString()})
  const r = await f.post(f.validEvent())
  assert.equal(r.status, 200);assert.deepEqual(JSON.parse(r.body), {accepted: true})
  assert.ok(!r.body.includes('private'));assert.equal(f.upstreamRequests(), 1)
  const original=Buffer.from(JSON.stringify(f.validEvent()))
  assert.deepEqual(f.lastForwarded().raw, original)
  assert.equal(f.lastForwarded().signature, 'sha256='+createHmac('sha256',f.secret).update(original).digest('hex'))
  assert.equal(f.gate.audit.dashboardSamples, 0)
})

for (const [name, createdAt] of [['expired', () => new Date(Date.now() - 600001).toISOString()],
  ['invalid', () => 'not-a-time'], ['future', () => new Date(Date.now() + 60000).toISOString()]]) {
  test(name + ' event-window timestamp does not forward', async t => {
    const f = await setup(t)
    await f.state({release: true, approvedLeadId: '900000000000001', leadCreatedAt: createdAt()})
    assert.equal((await f.post(f.validEvent())).status, 503)
    assert.equal(f.upstreamRequests(), 0)
  })
}

test('unarmed sample is rejected rather than treated as an actual Lead', async t => {
  const f = await setup(t)
  assert.equal((await f.post(sample())).status, 403)
  assert.equal(f.gate.audit.dashboardSamples, 0);assert.equal(f.upstreamRequests(), 0)
})

test('only signed, exact, one-use Dashboard sample is acknowledged without CRM processing', async t => {
  const f = await setup(t), body = sample()
  await f.arm(body)
  assert.equal((await f.post(body, 'sha256=wrong')).status, 401)
  assert.equal(f.gate.audit.dashboardSamples, 0)
  const changed = structuredClone(body);changed.entry[0].time++
  assert.equal((await f.post(changed)).status, 403)
  const result = await f.post(body)
  assert.equal(result.status, 200);assert.deepEqual(JSON.parse(result.body), {sampleOnly: true, crmProcessing: false})
  assert.equal(f.gate.audit.dashboardSamples, 1);assert.equal(f.gate.audit.qaTupleValid, 0)
  assert.equal(f.gate.audit.forwarded, 0);assert.equal(f.upstreamRequests(), 0)
  assert.equal((await f.post(body)).status, 403)
})

test('expired and excessively long Dashboard arms do not bypass normal resource checks', async t => {
  const f = await setup(t), body = sample()
  await f.arm(body, new Date(Date.now() - 1).toISOString())
  assert.equal((await f.post(body)).status, 403)
  await f.arm(body, new Date(Date.now() + 120000).toISOString())
  assert.equal((await f.post(body)).status, 403)
  assert.equal(f.upstreamRequests(), 0)
})

test('sample arm cannot accept real resource identifiers or field_data', async t => {
  const f = await setup(t)
  const contact = sample();contact.entry[0].changes[0].value.field_data = []
  await f.arm(contact);assert.equal((await f.post(contact)).status, 403)
  const actual = f.validEvent();await f.arm(actual)
  assert.equal((await f.post(actual)).status, 503)
  assert.equal(f.gate.audit.dashboardSamples, 0);assert.equal(f.upstreamRequests(), 0)
})

test('STOP closes real intake even with an approved exact Lead', async t => {
  const f = await setup(t)
  await f.state({release: true, approvedLeadId: '900000000000001', leadCreatedAt: new Date().toISOString()})
  await writeFile(f.config.stopFile, 'closed')
  assert.equal((await f.post(f.validEvent())).status, 503)
  assert.equal(f.upstreamRequests(), 0)
})
