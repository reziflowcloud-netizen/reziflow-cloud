import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, rm, symlink, link, realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {SecretSafetyError, publicTelemetry, errorTelemetry, assertPublishableText, scanArtifacts} from './secret-safety.mjs'

const refuses = (fn, codes) => assert.throws(fn, error => error instanceof SecretSafetyError &&
  (!codes || codes.includes(error.code)) && error.message === error.code)
const refusesAsync = (fn, codes) => assert.rejects(fn, error => error instanceof SecretSafetyError &&
  (!codes || codes.includes(error.code)) && error.message === error.code)
async function fixture(t) {
  const parent = await realpath(tmpdir())
  const root = await mkdtemp(join(parent, 'legalhub-secret-safety-'))
  t.after(async () => {
    // Only a newly created test-fixture tree is removed; no operator QA root is used.
    assert.ok(resolve(root).startsWith(resolve(parent) + (process.platform === 'win32' ? '\\' : '/')))
    assert.ok(root.includes('legalhub-secret-safety-'))
    await rm(root, {recursive: true, force: true})
  })
  return root
}

test('fixed public schema permits only bounded statuses, counts and durations', () => {
  const output = publicTelemetry({phase: 'webhook', status: 'PASS', httpStatus: 200,
    durationMs: 36, counts: {requests: 1, hmacValid: 1, leads: 1, notifications: 1}})
  assert.deepEqual(output, {phase: 'webhook', status: 'PASS', httpStatus: 200,
    durationMs: 36, counts: {requests: 1, hmacValid: 1, leads: 1, notifications: 1}})
  assert.equal(assertPublishableText(JSON.stringify(output)).status, 'PASS')
  assert.equal(Object.isFrozen(output.counts), true)
  assert.equal(assertPublishableText('Closed 2026-11-10T12:30:00Z. PASS, 1 request.').status, 'PASS')
  for (const extra of ['message', 'stack', 'body', 'url', 'leadId', 'userId', 'email', 'payload']) {
    refuses(() => publicTelemetry({phase: 'webhook', status: 'FAIL', [extra]: 'private'}), ['INVALID_TELEMETRY'])
  }
})

test('invalid numeric, nested or accessor telemetry cannot become a report', () => {
  for (const durationMs of [-1, NaN, Infinity, 86400001, '3']) {
    refuses(() => publicTelemetry({phase: 'graph', status: 'FAIL', durationMs}), ['INVALID_TELEMETRY'])
  }
  refuses(() => publicTelemetry({phase: 'graph', status: 'PASS', counts: {leadId: 123}}))
  refuses(() => publicTelemetry({phase: 'graph', status: 'PASS', counts: {requests: 123456789012345}}))
  refuses(() => publicTelemetry({phase: 'arbitrary', status: 'PASS'}))
  const accessor = {status: 'PASS'}
  Object.defineProperty(accessor, 'phase', {enumerable: true, get() { throw Error('must not read this getter') }})
  refuses(() => publicTelemetry(accessor), ['INVALID_TELEMETRY'])
})

test('diagnostics never read or serialize raw error message, stack, cause or response', () => {
  const error = {code: 'untrusted-provider-string', response: {body: 'private'}}
  Object.defineProperty(error, 'message', {get() { throw Error('raw message was read') }})
  Object.defineProperty(error, 'stack', {get() { throw Error('raw stack was read') }})
  assert.deepEqual(errorTelemetry(error, 'graph'), {phase: 'graph', status: 'BLOCKED', code: 'UNEXPECTED_FAILURE'})
  assert.equal(errorTelemetry(new SecretSafetyError('SECRET_PATTERN')).code, 'SECRET_PATTERN')
  assert.equal(errorTelemetry(Object.assign(new Error('private path'), {code: 'ENOENT'})).code, 'ENOENT')
  const codeGetter = {get code() { throw Error('must not leak this provider text') }}
  assert.equal(errorTelemetry(codeGetter).code, 'UNEXPECTED_FAILURE')
  const proxy = new Proxy({}, {getOwnPropertyDescriptor() { throw Error('must not leak this provider text') }})
  assert.equal(errorTelemetry(proxy).code, 'UNEXPECTED_FAILURE')
  refuses(() => publicTelemetry(new Proxy({}, {getPrototypeOf() { throw Error('must not leak provider text') }})), ['INVALID_TELEMETRY'])
})

test('known planted secrets are blocked in plaintext, URL, JSON, base64 and hex forms', () => {
  const secret = 'Planted-QA-only-secret-7Ncrx5eWmVjZ'
  const variants = [secret, encodeURIComponent(encodeURIComponent(secret)),
    JSON.stringify({value: secret}), Buffer.from(secret).toString('base64'),
    Buffer.from(secret).toString('base64url'), Buffer.from(secret).toString('hex'),
    JSON.stringify({value: [...secret].map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')})]
  for (const value of variants) refuses(() => assertPublishableText(value, {knownSecrets: [secret]}), ['KNOWN_SECRET'])
})

test('common Meta tokens and encoded token output are refused without a known-secret list', () => {
  const planted = 'EAA' + 'q7ZaB4cD'.repeat(7)
  const variants = [planted, JSON.stringify({value: planted}), Buffer.from(planted).toString('base64'),
    planted.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
    planted.slice(0, 2) + '\u200b' + planted.slice(2)]
  for (const value of variants) refuses(() => assertPublishableText(value), ['SECRET_PATTERN'])
  refuses(() => assertPublishableText(JSON.stringify(Buffer.from(planted))), ['SECRET_PATTERN'])
  refuses(() => assertPublishableText('<Buffer 45 41 41 71 37 5a 61 42 34 63 44>'), ['SECRET_PATTERN'])
})

test('credential URLs, headers, token keys, proofs and JWTs cannot enter artifacts', () => {
  for (const value of ['Authorization: Bearer not-a-real-token',
    '{"authorization":"Basic cWxvY2FsOmZpeHR1cmU="}',
    'https://user:planted@example.invalid/path', 'postgresql://restore_admin:planted@127.0.0.1:12345/qa',
    'redis://user:planted@127.0.0.1:12345', 'postgres://user:@127.0.0.1:12345/qa',
    'https://graph.example.invalid/?access_token=planted',
    'https://gateway.example.invalid/?hub.verify_token=planted',
    '{"app_secret":"placeholder-only"}', 'authtoken: placeholder-only',
    'eyJhbGciOiJIUzI1NiJ9.eyJmaXh0dXJlIjp0cnVlfQ.c2lnbmF0dXJl']) {
    refuses(() => assertPublishableText(value), ['SECRET_PATTERN'])
  }
})

test('contact fields and technical identifiers are rejected from anonymous artifacts', () => {
  for (const value of ['qa-person@example.invalid', '+48 555 123 456', '555-123-4567',
    '{"full_name":"Synthetic Contact"}', '{"field_data":[]}', '{"appId":"123"}',
    '{"leadgen_id":"123"}', '{"user_id":"123"}', '{"bodySha256":"123"}',
    '123456789012345', '0123456789abcdef0123456789abcdef', 'C:\\private\\qa\\report.json']) {
    refuses(() => assertPublishableText(value), ['CONTACT_PATTERN', 'IDENTIFYING_FIELD', 'OPAQUE_IDENTIFIER', 'PRIVATE_PATH'])
  }
})

test('explicit bounded UTF-8 files scan successfully without returning paths or contents', async t => {
  const root = await fixture(t)
  await writeFile(join(root, 'result.json'), JSON.stringify(publicTelemetry({phase: 'shutdown', status: 'PASS', counts: {requests: 0}})))
  const result = await scanArtifacts({root, paths: ['result.json']})
  assert.equal(result.status, 'PASS'); assert.equal(result.files, 1)
  assert.deepEqual(Object.keys(result).sort(), ['bytes', 'files', 'status'])
})

test('artifact scan blocks binary, invalid UTF-8, oversized and absent files safely', async t => {
  const root = await fixture(t)
  await writeFile(join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3]))
  await writeFile(join(root, 'invalid.txt'), Buffer.from([0xc3, 0x28]))
  await writeFile(join(root, 'large.txt'), 'x'.repeat(65))
  await refusesAsync(() => scanArtifacts({root, paths: ['binary.bin']}), ['ARTIFACT_BINARY'])
  await refusesAsync(() => scanArtifacts({root, paths: ['invalid.txt']}), ['ARTIFACT_BINARY'])
  await refusesAsync(() => scanArtifacts({root, paths: ['large.txt'], maxFileBytes: 64}), ['ARTIFACT_TOO_LARGE'])
  await refusesAsync(() => scanArtifacts({root, paths: ['missing-private-name']}), ['ARTIFACT_IO_FAILED'])
  await refusesAsync(() => scanArtifacts({root, paths: ['large.txt'], maxFileBytes: 1000000000}), ['INVALID_SAFETY_INPUT'])
})

test('scope escape, directories, hardlinks and junction ancestors block scanning', async t => {
  const fixtureRoot = await fixture(t), root = join(fixtureRoot, 'artifacts'), outside = join(fixtureRoot, 'outside')
  await mkdir(root); await mkdir(outside)
  await writeFile(join(outside, 'outside.txt'), 'PASS')
  await writeFile(join(root, 'result.txt'), 'PASS')
  await refusesAsync(() => scanArtifacts({root, paths: ['../outside/outside.txt']}), ['ARTIFACT_OUTSIDE_ROOT'])
  await refusesAsync(() => scanArtifacts({root, paths: ['.']}), ['ARTIFACT_OUTSIDE_ROOT'])
  await link(join(root, 'result.txt'), join(root, 'linked.txt'))
  await refusesAsync(() => scanArtifacts({root, paths: ['linked.txt']}), ['ARTIFACT_LINK'])
  await symlink(outside, join(root, 'jump'), process.platform === 'win32' ? 'junction' : 'dir')
  await refusesAsync(() => scanArtifacts({root, paths: ['jump/outside.txt']}), ['ARTIFACT_LINK'])
  await refusesAsync(() => scanArtifacts({root: join(root, 'jump'), paths: ['outside.txt']}), ['ARTIFACT_LINK'])
})
