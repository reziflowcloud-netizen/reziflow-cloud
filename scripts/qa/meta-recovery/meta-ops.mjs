import {lstat, realpath, open} from 'node:fs/promises'
import {resolve, dirname, basename, join} from 'node:path'
import {createHash} from 'node:crypto'
import {TextDecoder} from 'node:util'
import {publicTelemetry, assertPublishableText, scanArtifacts} from './secret-safety.mjs'

const APP = '2523488421395251', PAGE = '1449474971582722', FORM = '2046130655900851'
const HOST = 'unit-handsfree-carpentry.ngrok-free.dev'
const CALLBACK = `https://${HOST}/api/webhooks/meta/lead-ads`
const RETIRED_ROOT = 'LegalHubStageA-e0d6208c7f1b4b61917281dc390a8045'
const codes = new Set(['INVALID_INPUT', 'PRIVATE_FILE_REFUSED', 'RUNTIME_REFUSED',
  'ATTESTATION_REFUSED', 'ARTIFACT_SCAN_BLOCKED', 'GRAPH_TRANSPORT', 'GRAPH_TIMEOUT',
  'GRAPH_RESPONSE_LIMIT', 'GRAPH_RESPONSE_INVALID', 'GRAPH_HTTP',
  'SUBSCRIPTION_STATE_REFUSED', 'MUTATION_NOT_CONFIRMED', 'READBACK_BLOCKED'])
class OpsError extends Error {
  constructor(code, status, graphCode, graphSubcode) {
    super(codes.has(code) ? code : 'PRIVATE_FILE_REFUSED'); this.code = this.message
    if (status !== undefined) this.httpStatus = status
    if (graphCode !== undefined) this.graphCode = graphCode
    if (graphSubcode !== undefined) this.graphSubcode = graphSubcode
  }
}
const fail = code => { throw new OpsError(code) }
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x)
const numeric = x => Number.isSafeInteger(x) && x >= 0 && x <= 2147483647

async function checked(path, guard, directory = false) {
  let current = resolve(path)
  for (;;) {
    if ((await lstat(current)).isSymbolicLink()) fail('PRIVATE_FILE_REFUSED')
    const parent = dirname(current); if (current === parent) break; current = parent
  }
  const stat = await lstat(path)
  if ((directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) ||
      resolve(await realpath(path)).toLowerCase() !== resolve(path).toLowerCase() ||
      await guard(path) !== true) fail('PRIVATE_FILE_REFUSED')
  return stat
}
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && b.nlink === 1
async function privateRead(path, guard, maxBytes) {
  const before = await checked(path, guard)
  if (before.size > maxBytes) fail('PRIVATE_FILE_REFUSED')
  const handle = await open(path, 'r')
  try {
    if (!same(before, await handle.stat())) fail('PRIVATE_FILE_REFUSED')
    const bytes = Buffer.alloc(maxBytes + 1); let length = 0
    while (length < bytes.length) {
      const part = await handle.read(bytes, length, bytes.length - length, length)
      if (!part.bytesRead) break; length += part.bytesRead
    }
    if (length > maxBytes || !same(before, await handle.stat()) || !same(before, await checked(path, guard))) fail('PRIVATE_FILE_REFUSED')
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, length)).trim()
  } finally { await handle.close() }
}
const list = body => object(body) && Array.isArray(body.data) && body.data.length <= 10 && !body.paging?.next && !body.paging?.previous
const onlyLeadgen = fields => Array.isArray(fields) && fields.length === 1 &&
  (typeof fields[0] === 'string' ? fields[0] : fields[0]?.name) === 'leadgen'
function appState(body) {
  if (!list(body)) fail('SUBSCRIPTION_STATE_REFUSED')
  if (!body.data.length) return 'empty'
  const entry = body.data[0]
  if (body.data.length !== 1 || entry?.object !== 'page' || entry.callback_url !== CALLBACK ||
      entry.active !== true || !onlyLeadgen(entry.fields)) fail('SUBSCRIPTION_STATE_REFUSED')
  return 'ours'
}
function pageState(body) {
  if (!list(body)) fail('SUBSCRIPTION_STATE_REFUSED')
  if (!body.data.length) return 'empty'
  if (body.data.length !== 1 || body.data[0]?.id !== APP || !onlyLeadgen(body.data[0].subscribed_fields)) fail('SUBSCRIPTION_STATE_REFUSED')
  return 'ours'
}
async function jsonBody(response, signal) {
  const declared = response.headers?.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 65536)) fail('GRAPH_RESPONSE_LIMIT')
  if (!response.body?.getReader) fail('GRAPH_RESPONSE_INVALID')
  const reader = response.body.getReader(), chunks = []; let size = 0
  try {
    for (;;) {
      if (signal.aborted) fail('GRAPH_TIMEOUT')
      const {done, value} = await reader.read(); if (done) break
      if (!(value instanceof Uint8Array) || (size += value.byteLength) > 65536) fail('GRAPH_RESPONSE_LIMIT')
      chunks.push(value)
    }
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks, size)))
  } catch (error) { if (error instanceof OpsError) throw error; fail('GRAPH_RESPONSE_INVALID') }
  finally { await reader.cancel().catch(() => {}) }
}

/** Import only. The owner-authorized root caller supplies the genuine ACL guard.
 * No lead creation/deletion, Live Mode, permissions, DB, token acquisition, or UI.
 * Explicit public artifact files only; no historical log or credential discovery.
 */
export async function runMetaOps(options) {
  const started = Date.now(); let requests = 0, accepted = 0, timer, knownSecrets = []
  let artifactCheck
  const controller = new AbortController()
  const output = (status, error) => {
    const value = {phase: 'meta_verification', status, durationMs: Math.min(Date.now() - started, 86400000), counts: {requests, accepted}}
    for (const key of ['httpStatus', 'graphCode', 'graphSubcode']) if (error?.[key] !== undefined) value[key] = error[key]
    const summary = {...publicTelemetry(value), ...(error ? {code: error.code} : {})}
    assertPublishableText(JSON.stringify(summary), {knownSecrets})
    return Object.freeze(summary)
  }
  try {
    if (!object(options) || !['configure', 'verify', 'restore'].includes(options.action) ||
        typeof options.privateRoot !== 'string' || !/^[A-Za-z]:[\\/]|^\//.test(options.privateRoot) ||
        typeof options.assertPrivateFile !== 'function' || !object(options.artifacts) ||
        typeof options.artifacts.root !== 'string' || !Array.isArray(options.artifacts.paths) ||
        options.fetchImpl !== undefined && typeof options.fetchImpl !== 'function' ||
        options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 5 || options.timeoutMs > 120000)) fail('INVALID_INPUT')
    const root = resolve(options.privateRoot), guard = options.assertPrivateFile
    if (!/^LegalHubStageA-[a-f0-9]{32}$/.test(basename(root)) || basename(root) === RETIRED_ROOT) fail('INVALID_INPUT')
    await checked(root, guard, true)
    if (await privateRead(join(root, 'qa-owned.txt'), guard, 256) !== 'LegalHub Stage A synthetic QA') fail('PRIVATE_FILE_REFUSED')
    const runtime = JSON.parse(await privateRead(join(root, 'runtime.json'), guard, 131072))
    const state = JSON.parse(await privateRead(join(root, 'meta-real-private.json'), guard, 32768))
    const pageToken = await privateRead(join(root, 'meta-page-token.txt'), guard, 4096)
    const secret = await privateRead(join(root, 'meta-app-secret.txt'), guard, 128)
    if (runtime?.privateDirectory !== root || runtime.appId !== APP || runtime.approvedMetaAppId !== APP ||
        runtime.pageId !== PAGE || runtime.formId !== FORM || runtime.hostname !== HOST || runtime.graphVersion !== 'v27.0' ||
        typeof runtime.secrets?.verifyToken !== 'string' || !/^[A-Za-z0-9_-]{24,256}$/.test(runtime.secrets.verifyToken) ||
        !/^EAA[A-Za-z0-9_-]{30,4090}$/.test(pageToken) || !/^[a-f\d]{32}$/i.test(secret)) fail('RUNTIME_REFUSED')
    knownSecrets = [pageToken, secret, `${APP}|${secret}`, ...Object.values(runtime.secrets).filter(x => typeof x === 'string' && x.length >= 4),
      ...Object.values(runtime.passwords || {}).filter(x => typeof x === 'string' && x.length >= 4),
      ...(typeof runtime.databaseUrl === 'string' ? [runtime.databaseUrl] : [])]
    const age = Date.now() - Date.parse(state?.verifiedAt)
    if (state?.appId !== APP || state.pageId !== PAGE || state.formId !== FORM || !Number.isFinite(age) || age < 0 ||
        options.action !== 'restore' && age > 3600000 || state.tokenSha256 !== createHash('sha256').update(pageToken).digest('hex') ||
        !['tokenApp', 'tokenPage', 'formOwnership'].every(key => state.results?.[key] === 'PASS') ||
        !Array.isArray(state.originalAppSubscriptions) || state.originalAppSubscriptions.length !== 0 ||
        !Array.isArray(state.originalPageSubscriptions) || state.originalPageSubscriptions.length !== 0 ||
        options.action !== 'verify' && state.release !== false) fail('ATTESTATION_REFUSED')
    artifactCheck = async () => {
      try { await scanArtifacts({root: options.artifacts.root, paths: options.artifacts.paths, knownSecrets}) }
      catch { fail('ARTIFACT_SCAN_BLOCKED') }
    }
    await artifactCheck()
    const fetchImpl = options.fetchImpl || globalThis.fetch
    if (typeof fetchImpl !== 'function') fail('INVALID_INPUT')
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => {
      controller.abort(); reject(new OpsError('GRAPH_TIMEOUT'))
    }, options.timeoutMs ?? 120000) })
    const request = async (kind, method = 'GET') => {
      if (controller.signal.aborted || ++requests > 8) fail('GRAPH_TIMEOUT')
      // Paths, query names, and form fields are all constructed from these pins.
      const url = new URL(`https://graph.facebook.com/v27.0/${kind === 'app' ? APP + '/subscriptions' : PAGE + '/subscribed_apps'}`)
      if (method === 'GET' && kind === 'page') url.searchParams.set('fields', 'id,subscribed_fields')
      const headers = {Authorization: `Bearer ${kind === 'app' ? APP + '|' + secret : pageToken}`, Accept: 'application/json'}
      const init = {method, headers, redirect: 'error', cache: 'no-store', signal: controller.signal}
      if (method !== 'GET') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        const values = kind === 'app' ? method === 'POST' ? {object: 'page', fields: 'leadgen', callback_url: CALLBACK, verify_token: runtime.secrets.verifyToken} : {object: 'page'} : method === 'POST' ? {subscribed_fields: 'leadgen'} : {}
        init.body = new URLSearchParams(values).toString()
      }
      let response
      try { response = await Promise.race([fetchImpl(url.toString(), init), deadline]) }
      catch (error) { if (error instanceof OpsError) throw error; fail('GRAPH_TRANSPORT') }
      if (!Number.isInteger(response?.status) || response.status < 100 || response.status > 599) fail('GRAPH_RESPONSE_INVALID')
      const body = await Promise.race([jsonBody(response, controller.signal), deadline])
      if (response.status < 200 || response.status >= 300 || body?.error) {
        const graph = object(body?.error) ? body.error : {}
        throw new OpsError('GRAPH_HTTP', response.status, numeric(graph.code) ? graph.code : undefined,
          numeric(graph.error_subcode) ? graph.error_subcode : undefined)
      }
      if (method !== 'GET') {
        if (body?.success !== true) fail('MUTATION_NOT_CONFIRMED')
        accepted++
      }
      return body
    }
    let app = appState(await request('app')), page = pageState(await request('page'))
    if (options.action === 'verify') {
      if (app !== 'ours' || page !== 'ours') fail('READBACK_BLOCKED')
    } else if (options.action === 'configure') {
      if (app === 'empty') { await request('app', 'POST'); app = appState(await request('app')); if (app !== 'ours') fail('READBACK_BLOCKED') }
      if (page === 'empty') { await request('page', 'POST'); page = pageState(await request('page')); if (page !== 'ours') fail('READBACK_BLOCKED') }
    } else {
      if (page === 'ours') { await request('page', 'DELETE'); page = pageState(await request('page')); if (page !== 'empty') fail('READBACK_BLOCKED') }
      if (app === 'ours') { await request('app', 'DELETE'); app = appState(await request('app')); if (app !== 'empty') fail('READBACK_BLOCKED') }
    }
    clearTimeout(timer); timer = undefined
    await artifactCheck()
    return output('PASS')
  } catch (error) {
    let fixed = error instanceof OpsError ? error : new OpsError('PRIVATE_FILE_REFUSED')
    if (artifactCheck) { try { await artifactCheck() } catch { fixed = new OpsError('ARTIFACT_SCAN_BLOCKED') } }
    return output('BLOCKED', fixed)
  } finally { clearTimeout(timer); controller.abort() }
}
