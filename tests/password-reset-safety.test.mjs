import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import bcrypt from 'bcryptjs'

import {
  assertAdminPasswordResetTarget,
  createAdminPasswordResetAuditEvent,
  hasOrganizationEditCredentialFields,
  resetOrganizationAdminPassword,
} from '../src/lib/adminPasswordReset.ts'
import { normalizeEmail } from '../src/lib/identity.ts'

const workspace = resolve(import.meta.dirname, '..')

const originalOrganization = { id: 'org-sl', name: 'SL', slug: 'sl' }
const temporaryOrganization = { id: 'org-sl-2', name: 'SL', slug: 'sl-2' }
const originalAdmin = { id: 283, organizationId: originalOrganization.id }
const temporaryAdmin = { id: 305, organizationId: temporaryOrganization.id }

test('password reset target accepts the exact organization slug and admin id', () => {
  assert.doesNotThrow(() => assertAdminPasswordResetTarget({
    requestedOrganizationId: originalOrganization.id,
    requestedOrganizationSlug: originalOrganization.slug,
    requestedUserId: originalAdmin.id,
    organization: originalOrganization,
    user: originalAdmin,
  }))
})

test('same display names do not permit a neighboring tenant reset', () => {
  assert.equal(originalOrganization.name, temporaryOrganization.name)
  assert.throws(() => assertAdminPasswordResetTarget({
    requestedOrganizationId: originalOrganization.id,
    requestedOrganizationSlug: originalOrganization.slug,
    requestedUserId: originalAdmin.id,
    organization: temporaryOrganization,
    user: temporaryAdmin,
  }), /Цель сброса пароля изменилась/)
})

test('stale slug or user id fails closed', () => {
  assert.throws(() => assertAdminPasswordResetTarget({
    requestedOrganizationId: originalOrganization.id,
    requestedOrganizationSlug: temporaryOrganization.slug,
    requestedUserId: originalAdmin.id,
    organization: originalOrganization,
    user: originalAdmin,
  }))
  assert.throws(() => assertAdminPasswordResetTarget({
    requestedOrganizationId: originalOrganization.id,
    requestedOrganizationSlug: originalOrganization.slug,
    requestedUserId: temporaryAdmin.id,
    organization: originalOrganization,
    user: originalAdmin,
  }))
})

test('bcrypt cost 10 supports login and rejects a wrong password', async () => {
  const password = 'temporary-test-password'
  const hash = await bcrypt.hash(password, 10)
  assert.equal(await bcrypt.compare(password, hash), true)
  assert.equal(await bcrypt.compare('wrong-password', hash), false)
  assert.match(hash, /^\$2[aby]\$10\$/)
})

test('email normalization is shared trim plus lowercase behavior', () => {
  assert.equal(normalizeEmail('  Admin.User+Tag@Example.COM  '), 'admin.user+tag@example.com')
  assert.equal(normalizeEmail(null), '')
})

test('admin reset audit event contains identifiers and timestamp only', () => {
  const event = createAdminPasswordResetAuditEvent({
    organizationId: originalOrganization.id,
    userId: originalAdmin.id,
    actorUserId: 1,
    timestamp: new Date('2026-09-23T12:00:00.000Z'),
  })
  assert.deepEqual(event, {
    event: 'password_reset_admin',
    organizationId: originalOrganization.id,
    userId: originalAdmin.id,
    actorUserId: 1,
    timestamp: '2026-09-23T12:00:00.000Z',
  })
  assert.equal('password' in event, false)
  assert.equal('email' in event, false)
})

test('ordinary organization edit rejects Chrome-style autofill and malicious credential fields', () => {
  assert.equal(hasOrganizationEditCredentialFields({
    plan: 'pro',
    billingLimits: { users: 10 },
    adminPassword: 'autofilled-password',
  }), true)
  for (const field of ['password', 'newPassword', 'passwordHash', 'sessionVersion']) {
    assert.equal(hasOrganizationEditCredentialFields({ [field]: 'malicious' }), true)
  }
  assert.equal(hasOrganizationEditCredentialFields({ PasswordHash: 'malicious' }), true)
  assert.equal(hasOrganizationEditCredentialFields({ adminPassword: '' }), true)
})

test('ordinary organization edits without credentials remain allowed', () => {
  for (const payload of [
    { name: 'Updated organization' },
    { plan: 'pro' },
    { status: 'trial', trialEndsAt: '2026-10-31' },
    { billingLimits: { users: 10, clients: 100 } },
    { adminName: 'Admin', adminEmail: 'admin@example.com' },
  ]) {
    assert.equal(hasOrganizationEditCredentialFields(payload), false)
  }
})

test('ordinary organization route has a backend credential guard and no password mutation path', async () => {
  const route = await readFile(resolve(workspace, 'src/app/api/organizations/[id]/route.ts'), 'utf8')
  const guardIndex = route.indexOf('hasOrganizationEditCredentialFields(body)')
  const transactionIndex = route.indexOf('prisma.$transaction')
  assert.ok(guardIndex >= 0 && transactionIndex > guardIndex)
  assert.doesNotMatch(route, /userData\.password/)
  assert.doesNotMatch(route, /sessionVersion/)
  assert.doesNotMatch(route, /body\.adminPassword|userData\.adminPassword/)
  assert.doesNotMatch(route, /bcrypt/)
})

test('dedicated reset changes only target password and increments session version', async () => {
  const updates = []
  const store = {
    organization: {
      findUnique: async () => originalOrganization,
    },
    user: {
      findUnique: async () => ({ ...originalAdmin, role: 'admin' }),
      update: async args => {
        updates.push(args)
        return { id: originalAdmin.id }
      },
    },
  }

  const result = await resetOrganizationAdminPassword({
    store,
    organizationId: originalOrganization.id,
    organizationSlug: originalOrganization.slug,
    userId: originalAdmin.id,
    newPassword: 'dedicated-reset-password',
  })

  assert.equal(result.userId, originalAdmin.id)
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0].where, { id: originalAdmin.id })
  assert.deepEqual(updates[0].data.sessionVersion, { increment: 1 })
  assert.deepEqual(Object.keys(updates[0].data).sort(), ['password', 'sessionVersion'])
  assert.equal(await bcrypt.compare('dedicated-reset-password', updates[0].data.password), true)
  assert.match(updates[0].data.password, /^\$2[aby]\$10\$/)
})

test('dedicated reset cannot cross organization boundaries', async () => {
  const updates = []
  const store = {
    organization: {
      findUnique: async () => originalOrganization,
    },
    user: {
      findUnique: async () => ({ ...temporaryAdmin, role: 'admin' }),
      update: async args => updates.push(args),
    },
  }

  await assert.rejects(resetOrganizationAdminPassword({
    store,
    organizationId: originalOrganization.id,
    organizationSlug: originalOrganization.slug,
    userId: temporaryAdmin.id,
    newPassword: 'must-not-be-used',
  }), /Цель сброса пароля изменилась/)
  assert.equal(updates.length, 0)
})

test('dedicated organization reset route is SuperAdmin-only and records the audit event', async () => {
  const route = await readFile(resolve(workspace, 'src/app/api/organizations/[id]/admin-password/route.ts'), 'utf8')
  assert.match(route, /isSystemAdmin\(actor\)/)
  assert.match(route, /resetOrganizationAdminPassword\(/)
  assert.match(route, /recordAdminPasswordResetAuditEvent\(/)
  assert.match(route, /newPassword !== confirmPassword/)
  assert.doesNotMatch(route, /console\.(?:log|info|warn|error)\([^)]*(?:newPassword|confirmPassword|passwordHash)/)
})

test('SuperAdmin UI isolates reset from ordinary edit and shows immutable target identity', async () => {
  const page = await readFile(resolve(workspace, 'src/app/settings/organizations/page.tsx'), 'utf8')
  assert.doesNotMatch(page, /editForm\.adminPassword/)
  assert.match(page, /\/admin-password`/)
  assert.match(page, /organizationSlug: target\.slug/)
  assert.match(page, /adminUserId: targetAdmin\.id/)
  assert.match(page, /slug: \{passwordResetTarget\.slug\}/)
  assert.match(page, /User ID: \{targetAdmin\?\.id/)
  assert.match(page, /Organization ID: \{passwordResetTarget\.id\}/)
  assert.equal((page.match(/autoComplete="new-password"/g) || []).length, 2)
  assert.match(page, /Пароль обновлён для: \{name\} \(slug: \{slug\}\)/)
})

test('Forgot Password and SuperAdmin authentication flows remain independent', async () => {
  const forgotRoute = await readFile(resolve(workspace, 'src/app/api/auth/forgot-password/route.ts'), 'utf8')
  const resetRoute = await readFile(resolve(workspace, 'src/app/api/auth/reset-password/route.ts'), 'utf8')
  const resetService = await readFile(resolve(workspace, 'src/lib/passwordResetService.ts'), 'utf8')
  const auth = await readFile(resolve(workspace, 'src/lib/auth.ts'), 'utf8')
  const provisioning = await readFile(resolve(workspace, 'src/lib/organizationProvisioning.ts'), 'utf8')
  assert.match(forgotRoute, /passwordResetService\.request/)
  assert.match(resetRoute, /passwordResetService\.reset/)
  assert.match(resetService, /sessionVersion/)
  assert.match(auth, /isSessionVersionCurrent/)
  assert.match(provisioning, /export function isSystemAdmin/)
})

test('registration, login and user create/edit use the shared normalizer', async () => {
  const paths = [
    'src/app/api/auth/register/route.ts',
    'src/app/api/auth/login/route.ts',
    'src/app/api/users/route.ts',
    'src/app/api/users/[id]/route.ts',
    'src/app/api/organizations/route.ts',
    'src/app/api/organizations/[id]/route.ts',
    'src/lib/organizationProvisioning.ts',
  ]
  for (const path of paths) {
    const source = await readFile(resolve(workspace, path), 'utf8')
    assert.match(source, /normalizeEmail/)
  }
})
