import {lstat, realpath, open, rename, unlink} from 'node:fs/promises'
import {resolve, dirname, basename, join} from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import {TextDecoder} from 'node:util'
import {publicTelemetry} from './secret-safety.mjs'

// These pins are public resource identifiers, never credentials. No discovery,
// paging, retries, token debugger, mutation endpoint, or alternate App fallback.
const APP = '2523488421395251'
const PAGE = '1449474971582722'
const FORM = '2046130655900851'
const RETIRED_ROOT = 'LegalHubStageA-e0d6208c7f1b4b61917281dc390a8045'
const VERSION = 'v27.0'
const SCOPES = ['leads_retrieval', 'pages_manage_metadata', 'pages_manage_ads',
  'pages_show_list', 'pages_read_engagement']
const CODES = new Set(['INVALID_INPUT', 'PRIVATE_FILE_REFUSED', 'PRIVATE_FILE_CHANGED',
  'CREDENTIAL_FORMAT', 'OUTPUT_NOT_EMPTY', 'GRAPH_TRANSPORT', 'GRAPH_TIMEOUT',
  'GRAPH_RESPONSE_LIMIT', 'GRAPH_RESPONSE_INVALID', 'GRAPH_HTTP', 'APP_PROVENANCE_BLOCKED',
  'PROFILE_NOT_CONFIRMED', 'PERMISSIONS_BLOCKED', 'PAGE_SELECTION_BLOCKED',
  'PAGE_PROVENANCE_BLOCKED', 'FORM_OWNERSHIP_BLOCKED', 'EXISTING_SUBSCRIPTIONS',
  'PRIVATE_WRITE_FAILED', 'UNEXPECTED_FAILURE'])
class PreflightError extends Error {
  constructor(code, httpStatus, graphCode, graphSubcode) {
    super(CODES.has(code) ? code : 'UNEXPECTED_FAILURE')
    this.code = this.message
    if (httpStatus !== undefined) this.httpStatus = httpStatus
    if (graphCode !== undefined) this.graphCode = graphCode
    if (graphSubcode !== undefined) this.graphSubcode = graphSubcode
  }
}
const fail = code => { throw new PreflightError(code) }
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x)
const number = x => Number.isSafeInteger(x) && x >= 0 && x <= 2147483647
const numericId = x => typeof x === 'string' && /^[1-9]\d{4,24}$/.test(x)

async function noLinks(path) {
  let current = resolve(path)
  for (;;) {
    const stat = await lstat(current)
    if (stat.isSymbolicLink()) fail('PRIVATE_FILE_REFUSED')
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
}

async function checked(path, assertPrivateFile, directory = false) {
  await noLinks(path)
  if (resolve(await realpath(path)).toLowerCase() !== resolve(path).toLowerCase()) fail('PRIVATE_FILE_REFUSED')
  const stat = await lstat(path)
  if (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) fail('PRIVATE_FILE_REFUSED')
  if (await assertPrivateFile(path) !== true) fail('PRIVATE_FILE_REFUSED')
  return stat
}

function same(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size &&
    before.mtimeMs === after.mtimeMs && after.nlink === 1
}

async function privateRead(path, assertPrivateFile, maxBytes) {
  const before = await checked(path, assertPrivateFile)
  if (before.size > maxBytes) fail('PRIVATE_FILE_REFUSED')
  const handle = await open(path, 'r')
  try {
    if (!same(before, await handle.stat())) fail('PRIVATE_FILE_CHANGED')
    const buffer = Buffer.alloc(maxBytes + 1)
    let count = 0
    while (count < buffer.length) {
      const next = await handle.read(buffer, count, buffer.length - count, count)
      if (!next.bytesRead) break
      count += next.bytesRead
    }
    if (count > maxBytes || !same(before, await handle.stat()) ||
        !same(before, await checked(path, assertPrivateFile))) fail('PRIVATE_FILE_CHANGED')
    try { return new TextDecoder('utf-8', {fatal: true}).decode(buffer.subarray(0, count)).trim() }
    catch { fail('PRIVATE_FILE_REFUSED') }
  } finally { await handle.close() }
}

async function emptyOutput(path, assertPrivateFile) {
  const stat = await checked(path, assertPrivateFile)
  if (stat.size !== 0) fail('OUTPUT_NOT_EMPTY')
  return stat
}

// An unguessable file is created without data, then its inherited ACL and owner
// are checked BEFORE it receives a secret. Rename preserves that checked ACL.
// Output files must be precreated, private, empty, and unchanged. Each commit is
// atomic; attestation is committed last, so partial failure never grants PASS.
async function atomicPrivateWrite(path, value, expected, assertPrivateFile) {
  const staging = join(dirname(path), `.graph-preflight-${randomUUID()}.tmp`)
  let handle
  let created = false
  try {
    handle = await open(staging, 'wx', 0o600)
    created = true
    await checked(staging, assertPrivateFile)
    await handle.writeFile(value, {encoding: 'utf8'})
    await handle.sync()
    const staged = await handle.stat()
    await handle.close(); handle = undefined
    if (!same(staged, await checked(staging, assertPrivateFile)) ||
        !same(expected, await emptyOutput(path, assertPrivateFile))) fail('PRIVATE_FILE_CHANGED')
    await rename(staging, path)
    created = false
    await checked(path, assertPrivateFile)
  } finally {
    if (handle) await handle.close().catch(() => {})
    // Only the exact temporary file exclusively created by this invocation.
    if (created) await unlink(staging).catch(() => {})
  }
}

async function boundedJson(response, signal) {
  const declared = response.headers?.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 65536)) fail('GRAPH_RESPONSE_LIMIT')
  if (!response.body?.getReader) fail('GRAPH_RESPONSE_INVALID')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      if (signal.aborted) fail('GRAPH_TIMEOUT')
      const {done, value} = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array) || (size += value.byteLength) > 65536) fail('GRAPH_RESPONSE_LIMIT')
      chunks.push(value)
    }
    const text = new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks, size))
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof PreflightError) throw error
    fail('GRAPH_RESPONSE_INVALID')
  } finally { await reader.cancel().catch(() => {}) }
}

function collection(body) {
  // Never follow paging URLs: they may contain credentials or expose other Pages.
  return object(body) && Array.isArray(body.data) && body.data.length <= 100 &&
    !body.paging?.next && !body.paging?.previous
}

/**
 * Root caller must freeze writers and supply a genuine owner/ACL/no-reparse check
 * returning true. This exported module has no CLI and never logs or returns data
 * from Graph. fetchImpl and timeoutMs are injectable solely for bounded tests.
 * /app is an UNCONFIRMED capability probe, not a documented token-debug claim.
 * Any unsupported response blocks; there is deliberately no debug_token fallback.
 */
export async function runGraphPreflight(options) {
  const started = Date.now()
  let requests = 0
  let timer
  const controller = new AbortController()
  try {
    if (!object(options) || typeof options.privateRoot !== 'string' ||
        !/^[A-Za-z]:[\\/]|^\//.test(options.privateRoot) ||
        typeof options.assertPrivateFile !== 'function' ||
        options.uiConfirmedAppId !== APP || options.uiConfirmedProfile !== true ||
        options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 5 || options.timeoutMs > 120000) ||
        options.fetchImpl !== undefined && typeof options.fetchImpl !== 'function') fail('INVALID_INPUT')
    const root = resolve(options.privateRoot)
    if (!/^LegalHubStageA-[a-f0-9]{32}$/.test(basename(root)) || basename(root) === RETIRED_ROOT) fail('INVALID_INPUT')
    const guard = options.assertPrivateFile
    await checked(root, guard, true)
    if (await privateRead(join(root, 'qa-owned.txt'), guard, 256) !== 'LegalHub Stage A synthetic QA') fail('PRIVATE_FILE_REFUSED')
    const userToken = await privateRead(join(root, 'meta-user-token.txt'), guard, 4096)
    const appSecret = await privateRead(join(root, 'meta-app-secret.txt'), guard, 128)
    if (!/^EAA[A-Za-z0-9_-]{30,4090}$/.test(userToken) || !/^[a-f\d]{32}$/i.test(appSecret)) fail('CREDENTIAL_FORMAT')
    const pageFile = join(root, 'meta-page-token.txt')
    const stateFile = join(root, 'meta-real-private.json')
    const pageBefore = await emptyOutput(pageFile, guard)
    const stateBefore = await emptyOutput(stateFile, guard)
    const fetchImpl = options.fetchImpl || globalThis.fetch
    if (typeof fetchImpl !== 'function') fail('INVALID_INPUT')
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new PreflightError('GRAPH_TIMEOUT')) }, options.timeoutMs ?? 120000)
    })
    const request = async (path, fields, token) => {
      if (controller.signal.aborted || ++requests > 10) fail('GRAPH_TIMEOUT')
      const url = new URL(`https://graph.facebook.com/${VERSION}/${path}`)
      if (fields) url.searchParams.set('fields', fields)
      let response
      try {
        response = await Promise.race([fetchImpl(url.toString(), {
          method: 'GET', headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'},
          redirect: 'error', cache: 'no-store', signal: controller.signal,
        }), deadline])
      } catch (error) {
        if (error instanceof PreflightError) throw error
        fail('GRAPH_TRANSPORT')
      }
      if (!Number.isInteger(response?.status) || response.status < 100 || response.status > 599) fail('GRAPH_RESPONSE_INVALID')
      const body = await Promise.race([boundedJson(response, controller.signal), deadline])
      if (response.status < 200 || response.status >= 300 || body?.error) {
        const graph = object(body?.error) ? body.error : {}
        throw new PreflightError('GRAPH_HTTP', response.status,
          number(graph.code) ? graph.code : undefined, number(graph.error_subcode) ? graph.error_subcode : undefined)
      }
      return body
    }

    const userApp = await request('app', 'id,name', userToken)
    if (userApp?.id !== APP) fail('APP_PROVENANCE_BLOCKED')
    const profile = await request('me', 'id,name', userToken)
    if (!numericId(profile?.id) || profile.name !== 'Valentin Xtremalist') fail('PROFILE_NOT_CONFIRMED')
    const permissions = await request('me/permissions', 'permission,status', userToken)
    if (!collection(permissions) || !SCOPES.every(scope => permissions.data.some(x => x?.permission === scope && x.status === 'granted')) ||
        permissions.data.some(x => !object(x) || typeof x.permission !== 'string' ||
          !['granted', 'declined', 'expired'].includes(x.status) ||
          x.status === 'granted' && ![...SCOPES, 'public_profile'].includes(x.permission))) fail('PERMISSIONS_BLOCKED')
    const accounts = await request('me/accounts', 'id', userToken)
    if (!collection(accounts) || accounts.data.length !== 1 || accounts.data[0]?.id !== PAGE) fail('PAGE_SELECTION_BLOCKED')
    const page = await request(PAGE, 'id,access_token', userToken)
    if (page?.id !== PAGE || typeof page.access_token !== 'string' || !/^EAA[A-Za-z0-9_-]{30,4090}$/.test(page.access_token)) fail('PAGE_PROVENANCE_BLOCKED')
    const pageToken = page.access_token
    const pageApp = await request('app', 'id', pageToken)
    if (pageApp?.id !== APP) fail('APP_PROVENANCE_BLOCKED')
    const identity = await request('me', 'id', pageToken)
    if (identity?.id !== PAGE) fail('PAGE_PROVENANCE_BLOCKED')
    const form = await request(FORM, 'id,name,page', pageToken)
    if (form?.id !== FORM || form.page?.id !== PAGE) fail('FORM_OWNERSHIP_BLOCKED')
    const appSubscriptions = await request(`${APP}/subscriptions`, undefined, `${APP}|${appSecret}`)
    const pageSubscriptions = await request(`${PAGE}/subscribed_apps`, 'id,subscribed_fields', pageToken)
    if (!collection(appSubscriptions) || appSubscriptions.data.length !== 0 ||
        !collection(pageSubscriptions) || pageSubscriptions.data.length !== 0) fail('EXISTING_SUBSCRIPTIONS')
    if (controller.signal.aborted) fail('GRAPH_TIMEOUT')
    clearTimeout(timer); timer = undefined
    const attestation = {
      appId: APP, pageId: PAGE, formId: FORM, verifiedAt: new Date().toISOString(),
      tokenSha256: createHash('sha256').update(pageToken).digest('hex'),
      results: {tokenApp: 'PASS', tokenPage: 'PASS', formOwnership: 'PASS'},
      release: false, approvedLeadId: null, leadCreatedAt: null, dashboardSample: null,
      originalAppSubscriptions: [], originalPageSubscriptions: [],
    }
    try {
      await atomicPrivateWrite(pageFile, pageToken, pageBefore, guard)
      await atomicPrivateWrite(stateFile, JSON.stringify(attestation, null, 2) + '\n', stateBefore, guard)
    } catch { fail('PRIVATE_WRITE_FAILED') }
    return publicTelemetry({phase: 'preflight', status: 'PASS', durationMs: Date.now() - started, counts: {requests}})
  } catch (error) {
    const fixed = error instanceof PreflightError ? error : new PreflightError('PRIVATE_FILE_REFUSED')
    const telemetry = {phase: 'preflight', status: 'BLOCKED', durationMs: Math.min(Date.now() - started, 86400000), counts: {requests}}
    for (const key of ['httpStatus', 'graphCode', 'graphSubcode']) if (fixed[key] !== undefined) telemetry[key] = fixed[key]
    return Object.freeze({...publicTelemetry(telemetry), code: fixed.code})
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}
