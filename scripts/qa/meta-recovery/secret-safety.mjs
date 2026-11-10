import {lstat, realpath, open} from 'node:fs/promises'
import {resolve, relative, isAbsolute, dirname, parse} from 'node:path'
import {TextDecoder} from 'node:util'

// The resumed cycle has a separate owned evidence directory; never overwrite
// the previous cycle's pointer, reports or cleanup obligations.
export const isQaResultDirectoryName=name=>typeof name==='string'&&(/^meta-recovery-\d{8}$/.test(name)||name==='meta-recovery-alias-e2e-20261110')

const failures = new Set([
  'INVALID_SAFETY_INPUT', 'INVALID_TELEMETRY', 'SECRET_PATTERN', 'KNOWN_SECRET',
  'CONTACT_PATTERN', 'IDENTIFYING_FIELD', 'OPAQUE_IDENTIFIER', 'PRIVATE_PATH',
  'ARTIFACT_OUTSIDE_ROOT', 'ARTIFACT_LINK', 'ARTIFACT_NOT_FILE', 'ARTIFACT_TOO_LARGE',
  'ARTIFACT_BINARY', 'ARTIFACT_CHANGED', 'ARTIFACT_IO_FAILED', 'ARTIFACT_LIMIT',
])
export class SecretSafetyError extends Error {
  constructor(code) {
    super(failures.has(code) ? code : 'INVALID_SAFETY_INPUT')
    this.name = 'SecretSafetyError'
    this.code = this.message
  }
}
const fail = code => { throw new SecretSafetyError(code) }
const plain = value => value !== null && typeof value === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const exactKeys = (object, allowed) => plain(object) && Reflect.ownKeys(object).every(key =>
  typeof key === 'string' && allowed.has(key) && Object.getOwnPropertyDescriptor(object, key)?.get === undefined)
const integer = (value, ceiling) => Number.isSafeInteger(value) && value >= 0 && value <= ceiling
const statuses = new Set(['PASS', 'FAIL', 'BLOCKED', 'READY', 'NOT_TESTED'])
const phases = new Set(['prepare', 'preflight', 'artifact_scan', 'meta_verification',
  'dashboard_sample', 'test_lead', 'webhook', 'graph', 'crm', 'routing',
  'notification', 'shutdown', 'cleanup'])
const countKeys = new Set(['files', 'requests', 'accepted', 'rejected', 'hmacValid',
  'forwarded', 'receipts', 'leads', 'notifications', 'duplicates', 'unknownIds',
  'failures', 'tests', 'passed', 'blocked'])

// Build the public object from a fixed schema. Never spread provider data or Error objects.
function validatedTelemetry(input) {
  if (!exactKeys(input, new Set(['phase', 'status', 'httpStatus', 'graphCode',
    'graphSubcode', 'durationMs', 'counts'])) || !phases.has(input.phase) || !statuses.has(input.status)) {
    fail('INVALID_TELEMETRY')
  }
  const output = {phase: input.phase, status: input.status}
  for (const key of ['httpStatus', 'graphCode', 'graphSubcode', 'durationMs']) {
    if (input[key] === undefined) continue
    const ceiling = key === 'httpStatus' ? 599 : key === 'durationMs' ? 86400000 : 2147483647
    if (!integer(input[key], ceiling) || key === 'httpStatus' && input[key] !== 0 && input[key] < 100) fail('INVALID_TELEMETRY')
    output[key] = input[key]
  }
  if (input.counts !== undefined) {
    if (!exactKeys(input.counts, countKeys)) fail('INVALID_TELEMETRY')
    output.counts = {}
    for (const [key, value] of Object.entries(input.counts)) {
      if (!integer(value, 100000000)) fail('INVALID_TELEMETRY')
      output.counts[key] = value
    }
    Object.freeze(output.counts)
  }
  return Object.freeze(output)
}

export function publicTelemetry(input) {
  try { return validatedTelemetry(input) }
  catch (error) {
    if (error instanceof SecretSafetyError) throw error
    throw new SecretSafetyError('INVALID_TELEMETRY')
  }
}

// No raw error.message, stack, cause, response body, URL, headers, or path is exposed.
export function errorTelemetry(error, phase = 'preflight') {
  const result = publicTelemetry({phase: phases.has(phase) ? phase : 'preflight', status: 'BLOCKED'})
  let code = 'UNEXPECTED_FAILURE'
  try {
    // Even a provider-supplied accessor or Proxy must not execute a raw-message path.
    const descriptor = error && Object.getOwnPropertyDescriptor(error, 'code')
    const value = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined
    if (error instanceof SecretSafetyError && failures.has(value)) code = value
    else if (['EACCES', 'ENOENT', 'ETIMEDOUT', 'ECONNREFUSED'].includes(value)) code = value
  } catch { /* The generic fixed code is the only output for malformed error objects. */ }
  return Object.freeze({...result, code})
}

function textViews(text) {
  const views = new Set([text.normalize('NFKC')])
  let current = text
  for (let pass = 0; pass < 3; pass++) {
    current = current.replace(/\\u([a-f\d]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([a-f\d]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\//g, '/')
      .replace(/&(?:#(\d+)|#x([a-f\d]+)|amp|quot|apos|lt|gt);/gi, (entity, decimal, hex) => {
        if (decimal || hex) {
          const point = parseInt(decimal || hex, decimal ? 10 : 16)
          return point <= 0x10ffff ? String.fromCodePoint(point) : entity
        }
        return ({'&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>'})[entity.toLowerCase()] || entity
      })
    try { current = decodeURIComponent(current) } catch { /* Keep the undecoded view too. */ }
    current = current.normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    views.add(current)
  }
  return views
}

function decodedTextViews(text) {
  const result = textViews(text)
  // Decode valid JSON string values without executing anything or trusting provider keys.
  try {
    const queue = [{value: JSON.parse(text), depth: 0}]
    for (let count = 0; queue.length; count++) {
      if (count > 4096) fail('ARTIFACT_LIMIT')
      const {value, depth} = queue.pop()
      if (depth > 64) fail('ARTIFACT_LIMIT')
      if (typeof value === 'string') for (const view of textViews(value)) result.add(view)
      else if (value && typeof value === 'object') for (const child of Object.values(value)) queue.push({value: child, depth: depth + 1})
    }
  } catch (error) { if (error instanceof SecretSafetyError) throw error }
  // Recognisable base64 wrapping is common in accidental debug output. Invalid UTF-8
  // stays opaque and will never be printed by this helper.
  for (const candidate of text.match(/[a-z\d_+/-]{16,}={0,2}/gi) || []) {
    try {
      const decoded = new TextDecoder('utf-8', {fatal: true}).decode(Buffer.from(candidate, 'base64'))
      if (decoded && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded)) {
        for (const view of textViews(decoded)) result.add(view)
      }
    } catch { /* Binary or malformed candidates are not treated as safe text. */ }
  }
  return result
}

// This is a second line of defence. Use publicTelemetry for the anonymous result itself;
// pattern matching cannot prove that arbitrary prose contains no unlabelled personal name.
export function assertPublishableText(text, {knownSecrets = [], maxBytes = 65536} = {}) {
  if (typeof text !== 'string' || !Array.isArray(knownSecrets) ||
      knownSecrets.some(value => typeof value !== 'string' || !value.length) ||
      !integer(maxBytes, 1048576) || maxBytes < 1) fail('INVALID_SAFETY_INPUT')
  const bytes = Buffer.byteLength(text)
  if (bytes > maxBytes) fail('ARTIFACT_TOO_LARGE')
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text)) fail('ARTIFACT_BINARY')
  const views = decodedTextViews(text)
  for (const secret of knownSecrets) {
    const encodings = [secret, encodeURIComponent(secret), Buffer.from(secret).toString('base64'),
      Buffer.from(secret).toString('base64url'), Buffer.from(secret).toString('hex')]
    for (const view of views) {
      if (encodings.some(value => view.includes(value)) ||
          [...textViews(secret)].some(value => view.includes(value))) fail('KNOWN_SECRET')
    }
  }
  for (const view of views) {
    if (/\b(?:EAA|IGAA|IGQ)[a-z\d_-]{20,}\b/i.test(view) ||
        /<Buffer(?:\s+[a-f\d]{2}){8,}/i.test(view) || /["']type["']\s*:\s*["']Buffer["']/i.test(view) ||
        /\bauthorization\s*["']?\s*[:=]\s*["']?\s*(?:bearer|basic)\s+\S+/i.test(view) ||
        /\b(?:access[_-]?token|app[_-]?secret|client[_-]?secret|password|authtoken|verify[_-]?token)\b["']?\s*[:=]\s*["']?[^\s"',}]+/i.test(view) ||
        /[a-z][a-z\d+.-]*:\/\/[^\s/@]+@/i.test(view) ||
        /[?&](?:access_token|input_token|appsecret_proof|client_secret|hub[._]verify_token)=/i.test(view) ||
        /\beyJ[a-z\d_-]+\.eyJ[a-z\d_-]+\.[a-z\d_-]+\b/i.test(view)) fail('SECRET_PATTERN')
    if (/[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d-]+(?:\.[a-z\d-]+)+/i.test(view) ||
        /(?:^|[^\w])\+\d[\d ().-]{6,}\d/.test(view) ||
        [...view.matchAll(/(?:\b\d{2,4}[- .]){2,}\d{2,4}\b/g)].some(match => match[0].replace(/\D/g, '').length >= 9)) fail('CONTACT_PATTERN')
    if (/["']?\b(?:app[_-]?id|page[_-]?id|form[_-]?id|lead(?:gen)?[_-]?id|user[_-]?id|owner[_-]?id|organization[_-]?id|device[_-]?id|field_data|full[_-]?name|first[_-]?name|last[_-]?name|email|phone(?:_number)?|address|payload|headers|bodySha256)\b["']?\s*[:=]/i.test(view)) fail('IDENTIFYING_FIELD')
    if (/(?:^|[^a-z\d])[a-f\d]{32,}(?![a-z\d])/i.test(view) || /\b\d{9,}\b/.test(view)) fail('OPAQUE_IDENTIFIER')
    if (/(?:\b[a-z]:[\\/]|\\\\[^\s\\]+\\)/i.test(view)) fail('PRIVATE_PATH')
  }
  return Object.freeze({status: 'PASS', bytes})
}

const beneath = (root, target) => {
  const part = relative(root, target)
  return part !== '' && part !== '..' && !part.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(part)
}
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs
async function rejectLinks(target) {
  let current = target
  for (;;) {
    const stat = await lstat(current)
    if (stat.isSymbolicLink()) fail('ARTIFACT_LINK')
    const parent = dirname(current)
    if (parent === current || current === parse(current).root) return
    current = parent
  }
}

// Explicit files only. No secret store, process environment, backup, or history is searched.
// Freeze writers first; changed files cause BLOCKED rather than a stale cleanliness claim.
export async function scanArtifacts({root, paths, knownSecrets = [], maxFileBytes = 65536, maxFiles = 100} = {}) {
  if (typeof root !== 'string' || !root || !Array.isArray(paths) || !paths.length ||
      paths.some(path => typeof path !== 'string' || !path) || !integer(maxFiles, 1000) || !maxFiles ||
      paths.length > maxFiles || !integer(maxFileBytes, 1048576) || maxFileBytes < 1 ||
      !Array.isArray(knownSecrets) || knownSecrets.some(value => typeof value !== 'string' || !value.length)) fail('INVALID_SAFETY_INPUT')
  const base = resolve(root)
  let total = 0
  try {
    await rejectLinks(base)
    const canonical = await realpath(base)
    if (!(await lstat(base)).isDirectory()) fail('ARTIFACT_OUTSIDE_ROOT')
    for (const entry of paths) {
      const target = resolve(base, entry)
      if (!beneath(base, target)) fail('ARTIFACT_OUTSIDE_ROOT')
      await rejectLinks(target)
      const before = await lstat(target)
      if (!before.isFile()) fail('ARTIFACT_NOT_FILE')
      if (before.nlink > 1) fail('ARTIFACT_LINK')
      if (before.size > maxFileBytes) fail('ARTIFACT_TOO_LARGE')
      if (!beneath(canonical, await realpath(target))) fail('ARTIFACT_OUTSIDE_ROOT')
      const handle = await open(target, 'r')
      try {
        if (!sameFile(before, await handle.stat())) fail('ARTIFACT_CHANGED')
        await rejectLinks(target)
        if (!beneath(canonical, await realpath(target))) fail('ARTIFACT_OUTSIDE_ROOT')
        // One bounded read prevents a growing file from allocating an unbounded buffer.
        const buffer = Buffer.alloc(maxFileBytes + 1)
        const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0)
        if (bytesRead > maxFileBytes) fail('ARTIFACT_TOO_LARGE')
        if (!sameFile(before, await handle.stat()) || !sameFile(before, await lstat(target))) fail('ARTIFACT_CHANGED')
        let text
        try { text = new TextDecoder('utf-8', {fatal: true}).decode(buffer.subarray(0, bytesRead)) }
        catch { fail('ARTIFACT_BINARY') }
        total += assertPublishableText(text, {knownSecrets, maxBytes: maxFileBytes}).bytes
      } finally { await handle.close() }
    }
    return Object.freeze({status: 'PASS', files: paths.length, bytes: total})
  } catch (error) {
    if (error instanceof SecretSafetyError) throw error
    throw new SecretSafetyError('ARTIFACT_IO_FAILED')
  }
}
