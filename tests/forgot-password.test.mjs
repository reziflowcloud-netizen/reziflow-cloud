import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import bcrypt from 'bcryptjs'

import { createPasswordResetService, FORGOT_PASSWORD_PUBLIC_RESULT } from '../src/lib/passwordResetService.ts'
import {
  hashPasswordResetToken,
  hashRateLimitIdentifier,
  isResetTokenUsable,
  sessionTokenMatches,
} from '../src/lib/passwordResetSecurity.ts'
import { createPasswordResetAuditEvent } from '../src/lib/passwordResetAudit.ts'
import { sendPasswordResetEmail } from '../src/lib/emailNotifications.ts'

const workspace = resolve(import.meta.dirname, '..')

function createStore() {
  const users = [
    { id: 1, email: 'admin@one.test', organizationId: 'org-one', password: '', sessionVersion: 0 },
    { id: 2, email: 'admin@two.test', organizationId: 'org-two', password: '', sessionVersion: 0 },
  ]
  const tokens = []
  const limits = new Map()
  let nextId = 1
  const passwordResetToken = {
    async updateMany({ where, data }) {
      let count = 0
      for (const token of tokens) {
        const matches = (!where.id || token.id === where.id)
          && (!where.userId || token.userId === where.userId)
          && (where.usedAt !== null || token.usedAt === null)
          && (!where.expiresAt?.gt || token.expiresAt > where.expiresAt.gt)
        if (matches) { Object.assign(token, data); count += 1 }
      }
      return { count }
    },
    async create({ data }) {
      const token = { id: `token-${nextId++}`, usedAt: null, createdAt: new Date(), ...data }
      tokens.push(token)
      return { id: token.id }
    },
    async findUnique({ where }) {
      const token = tokens.find(item => item.tokenHash === where.tokenHash)
      if (!token) return null
      const user = users.find(item => item.id === token.userId)
      return { ...token, user: user ? { id: user.id, organizationId: user.organizationId } : null }
    },
  }
  const db = {
    user: {
      async findUnique({ where }) { return users.find(user => user.email === where.email) || null },
      async update({ where, data }) {
        const user = users.find(item => item.id === where.id)
        if (!user) throw new Error('missing user')
        if (data.password) user.password = data.password
        if (data.sessionVersion?.increment) user.sessionVersion += data.sessionVersion.increment
        return user
      },
    },
    passwordResetToken,
    passwordResetRateLimit: {
      async upsert({ where, create }) {
        const key = `${where.keyHash_windowStart.keyHash}:${where.keyHash_windowStart.windowStart.toISOString()}`
        const count = (limits.get(key) || 0) + 1
        limits.set(key, count)
        return { ...create, requestCount: count }
      },
      async deleteMany() { return { count: 0 } },
    },
    async $transaction(callback) { return callback({ user: db.user, passwordResetToken }) },
  }
  return { db, users, tokens }
}

function harness(options = {}) {
  const store = createStore()
  const sent = []
  const audits = []
  let tokenCounter = 0
  const service = createPasswordResetService({
    db: store.db,
    now: () => options.now || new Date('2026-09-23T12:00:00.000Z'),
    createToken: () => options.rawToken || `raw-secret-token-${++tokenCounter}`,
    hashPassword: password => bcrypt.hash(password, 10),
    hashIdentifier: (kind, value) => `hash:${kind}:${value}`,
    sendEmail: async input => {
      sent.push(input)
      return options.deliveryFails ? { sent: false, skipped: false } : { sent: true, skipped: false }
    },
    audit: input => { audits.push(createPasswordResetAuditEvent({ ...input, timestamp: new Date('2026-09-23T12:00:00.000Z') })) },
  })
  return { ...store, service, sent, audits }
}

test('known email creates only a hashed 30-minute token and sends the raw link', async () => {
  const h = harness({ rawToken: 'raw-token-never-stored' })
  const result = await h.service.request({ email: '  ADMIN@One.Test ', language: 'uk', origin: 'https://example.test' })
  assert.deepEqual(result, FORGOT_PASSWORD_PUBLIC_RESULT)
  assert.equal(h.tokens.length, 1)
  assert.equal(h.tokens[0].tokenHash, hashPasswordResetToken('raw-token-never-stored'))
  assert.notEqual(h.tokens[0].tokenHash, 'raw-token-never-stored')
  assert.equal(h.tokens[0].expiresAt.toISOString(), '2026-09-23T12:30:00.000Z')
  assert.match(h.sent[0].resetUrl, /token=raw-token-never-stored/)
})

test('unknown and known emails return the same public result', async () => {
  const known = harness()
  const unknown = harness()
  const knownResult = await known.service.request({ email: 'admin@one.test', language: 'ru', origin: 'https://example.test' })
  const unknownResult = await unknown.service.request({ email: 'unknown@example.test', language: 'ru', origin: 'https://example.test' })
  assert.deepEqual(knownResult, unknownResult)
  assert.equal(unknown.sent.length, 0)
})

test('valid token atomically changes only its user password, increments session version, and is one-time', async () => {
  const h = harness({ rawToken: 'valid-token' })
  h.users[0].password = await bcrypt.hash('old-password', 10)
  await h.service.request({ email: 'admin@one.test', language: 'pl', origin: 'https://example.test' })
  const oldSecondPassword = h.users[1].password
  const first = await h.service.reset({ token: 'valid-token', password: 'new-secure-password' })
  assert.deepEqual(first, { success: true })
  assert.equal(await bcrypt.compare('new-secure-password', h.users[0].password), true)
  assert.equal(await bcrypt.compare('old-password', h.users[0].password), false)
  assert.equal(await bcrypt.compare('wrong-password', h.users[0].password), false)
  assert.match(h.users[0].password, /^\$2[aby]\$10\$/)
  assert.equal(h.users[0].sessionVersion, 1)
  assert.equal(h.users[1].password, oldSecondPassword)
  assert.deepEqual(await h.service.reset({ token: 'valid-token', password: 'another-password' }), { success: false, reason: 'invalid_or_expired' })
})

test('expired and malicious tokens fail safely', async () => {
  const h = harness({ rawToken: 'expires' })
  await h.service.request({ email: 'admin@one.test', language: 'ru', origin: 'https://example.test' })
  h.tokens[0].expiresAt = new Date('2026-09-23T11:59:59.000Z')
  assert.equal(isResetTokenUsable(h.tokens[0], new Date('2026-09-23T12:00:00.000Z')), false)
  assert.deepEqual(await h.service.reset({ token: 'expires', password: 'secure-password' }), { success: false, reason: 'invalid_or_expired' })
  assert.deepEqual(await h.service.reset({ token: '../../../etc/passwd', password: 'secure-password' }), { success: false, reason: 'invalid_or_expired' })
})

test('a new request invalidates the previous token', async () => {
  const h = harness()
  await h.service.request({ email: 'admin@one.test', language: 'ru', origin: 'https://example.test' })
  await h.service.request({ email: 'admin@one.test', language: 'ru', origin: 'https://example.test' })
  assert.equal(h.tokens.length, 2)
  assert.notEqual(h.tokens[0].usedAt, null)
  assert.equal(h.tokens[1].usedAt, null)
})

test('persistent email limiter returns the same generic result and stops additional delivery', async () => {
  const h = harness()
  for (let index = 0; index < 5; index += 1) {
    assert.deepEqual(await h.service.request({ email: 'admin@one.test', language: 'ru', origin: 'https://example.test' }), FORGOT_PASSWORD_PUBLIC_RESULT)
  }
  assert.equal(h.sent.length, 3)
})

test('real rate-limit keys are deterministic hashes that do not store raw email or IP', () => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'unit-test-rate-limit-secret'
  try {
    const emailHash = hashRateLimitIdentifier('email', 'person@example.test')
    const ipHash = hashRateLimitIdentifier('ip', '203.0.113.7')
    assert.match(emailHash, /^[a-f0-9]{64}$/)
    assert.match(ipHash, /^[a-f0-9]{64}$/)
    assert.doesNotMatch(emailHash, /person|example/i)
    assert.doesNotMatch(ipHash, /203|113/)
    assert.notEqual(emailHash, ipHash)
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})

test('delivery failure invalidates the token without changing the public response', async () => {
  const h = harness({ rawToken: 'failed-delivery-token', deliveryFails: true })
  const result = await h.service.request({ email: 'admin@one.test', language: 'ru', origin: 'https://example.test' })
  assert.deepEqual(result, FORGOT_PASSWORD_PUBLIC_RESULT)
  assert.notEqual(h.tokens[0].usedAt, null)
  assert.equal(h.audits.at(-1).event, 'password_reset_delivery_failed')
  assert.equal(JSON.stringify(h.audits).includes('failed-delivery-token'), false)
})

test('session version invalidates old JWT claims and accepts newly issued claims', () => {
  assert.equal(sessionTokenMatches({ id: 1, sessionVersion: 0 }, 1), false)
  assert.equal(sessionTokenMatches({ id: 1, sessionVersion: 1 }, 1), true)
  assert.equal(sessionTokenMatches({ id: 1 }, 0), true)
})

test('audit events contain no token, email, password, or URL', () => {
  const event = createPasswordResetAuditEvent({ event: 'password_reset_completed', userId: 1, organizationId: 'org-one', timestamp: new Date('2026-09-23T12:00:00.000Z') })
  assert.deepEqual(Object.keys(event).sort(), ['actor', 'event', 'organizationId', 'timestamp', 'userId'])
  for (const unsafeKey of ['token', 'email', 'password', 'passwordHash', 'resetUrl']) {
    assert.equal(unsafeKey in event, false)
  }
})

test('public API routes enforce same-origin and keep forgot responses generic', async () => {
  const forgotRoute = await readFile(resolve(workspace, 'src/app/api/auth/forgot-password/route.ts'), 'utf8')
  const resetRoute = await readFile(resolve(workspace, 'src/app/api/auth/reset-password/route.ts'), 'utf8')
  assert.match(forgotRoute, /isSameOriginRequest/)
  assert.match(forgotRoute, /FORGOT_PASSWORD_PUBLIC_RESULT/)
  assert.doesNotMatch(forgotRoute, /user not found|email not found/i)
  assert.match(resetRoute, /response\.cookies\.delete\('auth-token'\)/)
})

test('all real login and password-update paths carry or revoke session versions', async () => {
  const login = await readFile(resolve(workspace, 'src/app/api/auth/login/route.ts'), 'utf8')
  const registration = await readFile(resolve(workspace, 'src/app/api/auth/register/route.ts'), 'utf8')
  const userUpdate = await readFile(resolve(workspace, 'src/app/api/users/[id]/route.ts'), 'utf8')
  const adminReset = await readFile(resolve(workspace, 'src/app/api/organizations/[id]/route.ts'), 'utf8')
  const auth = await readFile(resolve(workspace, 'src/lib/auth.ts'), 'utf8')
  assert.match(login, /sessionVersion: user\.sessionVersion/)
  assert.match(registration, /sessionVersion:/)
  assert.match(userUpdate, /sessionVersion = \{ increment: 1 \}/)
  assert.match(adminReset, /sessionVersion = \{ increment: 1 \}/)
  assert.match(auth, /isSessionVersionCurrent/)
})

test('migration is additive and password-reset schema has required constraints', async () => {
  const migration = await readFile(resolve(workspace, 'prisma/migrations/20260923221500_secure_password_reset/migration.sql'), 'utf8')
  assert.match(migration, /ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0/)
  assert.match(migration, /CREATE TABLE "PasswordResetToken"/)
  assert.match(migration, /PasswordResetToken_tokenHash_key/)
  assert.match(migration, /ON DELETE CASCADE/)
  assert.match(migration, /CREATE TABLE "PasswordResetRateLimit"/)
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|RENAME/i)
})

test('RU, UA, and PL recovery copy and public pages are present', async () => {
  const copy = await readFile(resolve(workspace, 'src/lib/passwordResetI18n.ts'), 'utf8')
  const login = await readFile(resolve(workspace, 'src/app/login/page.tsx'), 'utf8')
  const middleware = await readFile(resolve(workspace, 'src/middleware.ts'), 'utf8')
  for (const language of ['ru:', 'uk:', 'pl:']) assert.match(copy, new RegExp(language))
  assert.match(copy, /Якщо обліковий запис із цією електронною адресою існує/)
  assert.match(login, /href="\/forgot-password"/)
  assert.match(middleware, /'\/forgot-password'/)
  assert.match(middleware, /'\/reset-password'/)
})

test('password reset email reuses Resend and contains no user or organization identifiers', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.RESEND_API_KEY
  let captured
  process.env.RESEND_API_KEY = 'unit-test-key'
  globalThis.fetch = async (url, options) => {
    captured = { url, options }
    return new Response('', { status: 200 })
  }
  try {
    const result = await sendPasswordResetEmail({
      to: 'recipient@example.test',
      resetUrl: 'https://example.test/reset-password?token=raw-test-token',
      language: 'uk',
    })
    assert.deepEqual(result, { sent: true, skipped: false })
    assert.equal(captured.url, 'https://api.resend.com/emails')
    const body = JSON.parse(captured.options.body)
    assert.deepEqual(body.to, ['recipient@example.test'])
    assert.match(body.text, /30 хвилин/)
    assert.match(body.text, /raw-test-token/)
    assert.equal('userId' in body, false)
    assert.equal('organizationId' in body, false)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  }
})
