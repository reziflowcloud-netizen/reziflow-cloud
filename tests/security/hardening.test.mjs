import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  isApprovedCloudinaryUrl,
  resolveLocalDocumentPath,
  serializeDocumentForBrowser,
  validateDocumentUpload,
} from '../../src/lib/documentSecurity.ts'
import { verifyMetaWebhookSignature } from '../../src/lib/metaWebhookSecurity.ts'
import { caseChildWhere } from '../../src/lib/nestedResourceScope.ts'
import { isSameOriginRequest, shouldEnforceSameOrigin } from '../../src/lib/requestSecurity.ts'
import { SAFE_ASSIGNEE_SELECT, isOrganizationAdmin } from '../../src/lib/security.ts'

const workspace = resolve(import.meta.dirname, '..', '..')

test('safe user projection excludes passwords, auth data and preferences', () => {
  assert.deepEqual(Object.keys(SAFE_ASSIGNEE_SELECT).sort(), ['avatarUrl', 'email', 'id', 'name'])
  assert.equal('password' in SAFE_ASSIGNEE_SELECT, false)
  assert.equal('preferences' in SAFE_ASSIGNEE_SELECT, false)
})

test('integration settings responses expose state and masks, never stored credentials', async () => {
  const webhookRoute = await readFile(resolve(workspace, 'src/app/api/lead-webhook-settings/route.ts'), 'utf8')
  const storageRoute = await readFile(resolve(workspace, 'src/app/api/storage-settings/route.ts'), 'utf8')
  const cloudinaryRoute = await readFile(resolve(workspace, 'src/app/api/cloudinary/route.ts'), 'utf8')
  const organizationSettingsRoute = await readFile(resolve(workspace, 'src/app/api/organization-settings/route.ts'), 'utf8')
  assert.match(webhookRoute, /verifyToken:\s*''/)
  assert.match(webhookRoute, /pageAccessToken:\s*''/)
  assert.match(webhookRoute, /keyConfigured:/)
  assert.doesNotMatch(webhookRoute, /key:\s*settings\.leadWebhookKey/)
  assert.doesNotMatch(storageRoute, /accessToken:\s*dropbox\.accessToken/)
  assert.doesNotMatch(cloudinaryRoute, /uploadPreset:/)
  assert.match(organizationSettingsRoute, /settings:\s*normalizeSettings\(nextSettings\)/)
})

test('browser document serialization never exposes provider identifiers or URLs', () => {
  const result = serializeDocumentForBrowser({
    id: 41,
    name: 'passport.pdf',
    url: 'https://res.cloudinary.com/legalhub/raw/upload/v1/private-id.pdf',
    publicId: 'private-id.pdf',
    storageId: '123',
    storagePath: 'raw',
    dropboxStorageId: 'dbid:test',
    dropboxPath: '/secret/passport.pdf',
    dropboxSyncError: 'provider diagnostic that must remain server-side',
  })
  assert.equal(result.url, '/api/documents/41/file')
  for (const key of ['publicId', 'storageId', 'storagePath', 'dropboxStorageId', 'dropboxPath', 'dropboxSyncError']) {
    assert.equal(key in result, false)
  }
})

test('nested child selectors always bind child id to the parent case id', () => {
  assert.deepEqual(caseChildWhere('case-a', 'payment-b'), { id: 'payment-b', caseId: 'case-a' })
  assert.deepEqual(caseChildWhere('case-a', 22), { id: 22, caseId: 'case-a' })
})

test('all nested case mutation routes use the shared parent-child selector', async () => {
  const paths = [
    'src/app/api/cases/[id]/payments/[paymentId]/route.ts',
    'src/app/api/cases/[id]/custom-dates/[dateId]/route.ts',
    'src/app/api/cases/[id]/doc-updates/[updateId]/route.ts',
    'src/app/api/cases/[id]/documents/[docId]/route.ts',
    'src/app/api/cases/[id]/comments/[docId]/route.ts',
  ]
  for (const path of paths) {
    const source = await readFile(resolve(workspace, path), 'utf8')
    assert.match(source, /caseChildWhere\(params\.id,/)
    assert.match(source, /findScopedCase\(params\.id, organizationId/)
  }
})

test('arbitrary, local, private and unexpected document URLs are rejected', () => {
  const cloud = 'legalhub-cloud'
  assert.equal(isApprovedCloudinaryUrl('https://res.cloudinary.com/legalhub-cloud/raw/upload/v1/doc.pdf', cloud), true)
  assert.equal(isApprovedCloudinaryUrl('http://res.cloudinary.com/legalhub-cloud/raw/upload/doc.pdf', cloud), false)
  assert.equal(isApprovedCloudinaryUrl('http://localhost:3000/secret', cloud), false)
  assert.equal(isApprovedCloudinaryUrl('http://169.254.169.254/latest/meta-data', cloud), false)
  assert.equal(isApprovedCloudinaryUrl('http://10.0.0.1/file', cloud), false)
  assert.equal(isApprovedCloudinaryUrl('file:///etc/passwd', cloud), false)
  assert.equal(isApprovedCloudinaryUrl('https://example.com/document.pdf', cloud), false)
})

test('document creation route rejects client-provided provider URLs', async () => {
  const source = await readFile(resolve(workspace, 'src/app/api/cases/[id]/documents/route.ts'), 'utf8')
  assert.match(source, /Direct document URLs are not accepted/)
  assert.doesNotMatch(source, /url:\s*body\.url/)
  assert.doesNotMatch(source, /publicId:\s*body\.publicId/)
})

test('local document paths reject traversal and absolute paths', () => {
  const root = resolve(workspace, 'public')
  assert.throws(() => resolveLocalDocumentPath(root, 'local:../.env'))
  assert.throws(() => resolveLocalDocumentPath(root, 'local:C:\\Windows\\system.ini'))
  assert.throws(() => resolveLocalDocumentPath(root, 'local:/etc/passwd'))
  assert.ok(resolveLocalDocumentPath(root, 'local:uploads/document.pdf').startsWith(root))
})

test('document validation rejects oversized and mismatched files', () => {
  const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])
  assert.throws(() => validateDocumentUpload({
    bytes: pdf,
    declaredMime: 'application/pdf',
    declaredSize: MAX_DOCUMENT_UPLOAD_BYTES + 1,
    name: 'document.pdf',
  }), /too large/i)
  assert.throws(() => validateDocumentUpload({ bytes: pdf, declaredMime: 'image/png', declaredSize: pdf.length, name: 'document.pdf' }), /MIME/i)
  assert.throws(() => validateDocumentUpload({ bytes: pdf, declaredMime: 'application/pdf', declaredSize: pdf.length, name: 'document.exe' }), /extension/i)
  assert.throws(() => validateDocumentUpload({ bytes: Uint8Array.from([1, 2, 3]), declaredMime: 'application/pdf', declaredSize: 3, name: 'document.pdf' }), /Unsupported/i)
})

test('document validation accepts supported PDF and PNG signatures', () => {
  const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(validateDocumentUpload({ bytes: pdf, declaredMime: 'application/pdf', declaredSize: pdf.length, name: 'a.pdf' }).resourceType, 'raw')
  assert.equal(validateDocumentUpload({ bytes: png, declaredMime: 'image/png', declaredSize: png.length, name: 'a.png' }).resourceType, 'image')
})

test('same-origin protection rejects cross-site browser mutations and exempts webhooks', () => {
  const same = new Request('https://legalhubcrm.com/api/cases/1', {
    method: 'PATCH',
    headers: { origin: 'https://legalhubcrm.com', host: 'legalhubcrm.com', 'sec-fetch-site': 'same-origin' },
  })
  const cross = new Request('https://legalhubcrm.com/api/cases/1', {
    method: 'PATCH',
    headers: { origin: 'https://evil.example', host: 'legalhubcrm.com', 'sec-fetch-site': 'cross-site' },
  })
  assert.equal(isSameOriginRequest(same), true)
  assert.equal(isSameOriginRequest(cross), false)
  assert.equal(shouldEnforceSameOrigin('/api/cases/1', 'PATCH'), true)
  assert.equal(shouldEnforceSameOrigin('/api/webhooks/meta/messages', 'POST'), false)
})

const metaSecret = 'unit-test-secret'
const metaBytes = body => new TextEncoder().encode(body)
const metaSignature = bytes => `sha256=${createHmac('sha256', metaSecret).update(bytes).digest('hex')}`

test('valid Meta sha256 signature is verified', () => {
  const body = metaBytes(JSON.stringify({ object: 'page', entry: [] }))
  assert.deepEqual(verifyMetaWebhookSignature(body, metaSignature(body), metaSecret), {
    verified: true,
    reason: 'verified',
  })
})

test('incorrect Meta signature reports digest mismatch', () => {
  const body = metaBytes(JSON.stringify({ object: 'page', entry: [] }))
  const differentBody = metaBytes(JSON.stringify({ object: 'page', entry: [{ id: 'different' }] }))
  assert.deepEqual(verifyMetaWebhookSignature(body, metaSignature(differentBody), metaSecret), {
    verified: false,
    reason: 'digest_mismatch',
  })
})

test('missing Meta signature header is distinguished', () => {
  const body = metaBytes('{}')
  assert.deepEqual(verifyMetaWebhookSignature(body, null, metaSecret), {
    verified: false,
    reason: 'missing_signature_header',
  })
})

test('malformed Meta signature header is distinguished', () => {
  const body = metaBytes('{}')
  assert.deepEqual(verifyMetaWebhookSignature(body, 'sha1=not-a-meta-signature', metaSecret), {
    verified: false,
    reason: 'malformed_signature_header',
  })
})

test('Unicode and emoji Meta payload is verified from exact raw bytes', () => {
  const body = metaBytes(JSON.stringify({ message: 'Привіт 👋', emoji: '🧑🏽‍💻' }))
  assert.deepEqual(verifyMetaWebhookSignature(body, metaSignature(body), metaSecret), {
    verified: true,
    reason: 'verified',
  })
})

test('invalid Meta signature remains fail closed', () => {
  const body = metaBytes('{}')
  const result = verifyMetaWebhookSignature(body, `sha256=${'0'.repeat(64)}`, metaSecret)
  assert.equal(result.verified, false)
  assert.equal(result.reason, 'digest_mismatch')
})

test('configuration writes require an organization admin role', () => {
  assert.equal(isOrganizationAdmin({ role: 'owner' }), true)
  assert.equal(isOrganizationAdmin({ role: 'admin' }), true)
  assert.equal(isOrganizationAdmin({ role: 'employee' }), false)
})

test('configuration mutation routes enforce backend role checks', async () => {
  const paths = [
    'src/app/api/statuses/route.ts',
    'src/app/api/statuses/[id]/route.ts',
    'src/app/api/lead-statuses/route.ts',
    'src/app/api/lead-statuses/[id]/route.ts',
    'src/app/api/employees/route.ts',
    'src/app/api/employees/[id]/route.ts',
    'src/app/api/services/route.ts',
    'src/app/api/services/[id]/route.ts',
    'src/app/api/task-priorities/route.ts',
    'src/app/api/task-priorities/[id]/route.ts',
    'src/app/api/case-options/route.ts',
    'src/app/api/case-options/[id]/route.ts',
  ]
  for (const path of paths) {
    const source = await readFile(resolve(workspace, path), 'utf8')
    assert.match(source, /isOrganizationAdmin\(user\)/)
  }
  const sequenceRoute = await readFile(resolve(workspace, 'src/app/api/fix-sequences/route.ts'), 'utf8')
  assert.match(sequenceRoute, /isSystemAdmin\(user\)/)
  assert.match(sequenceRoute, /export async function GET\(\)[\s\S]*status:\s*405/)
})

test('private file endpoint scopes database reads to the current organization', async () => {
  const source = await readFile(resolve(workspace, 'src/app/api/documents/[id]/file/route.ts'), 'utf8')
  assert.match(source, /case:\s*caseWhereForScope\(scope, organizationId\)/)
  assert.match(source, /cloudinary_authenticated/)
  assert.match(source, /redirect:\s*'manual'/)
})
