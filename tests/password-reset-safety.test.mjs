import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import bcrypt from 'bcryptjs'

import {
  assertAdminPasswordResetTarget,
  createAdminPasswordResetAuditEvent,
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

test('organization reset route scopes admin lookup and validates immutable target identifiers', async () => {
  const route = await readFile(resolve(workspace, 'src/app/api/organizations/[id]/route.ts'), 'utf8')
  assert.match(route, /where:\s*\{ organizationId: params\.id, role: 'admin' \}/)
  assert.match(route, /assertAdminPasswordResetTarget\(/)
  assert.match(route, /requestedOrganizationSlug/)
  assert.match(route, /requestedAdminUserId/)
  assert.match(route, /recordAdminPasswordResetAuditEvent\(/)
})

test('SuperAdmin UI shows immutable reset target and explicit success identity', async () => {
  const page = await readFile(resolve(workspace, 'src/app/settings/organizations/page.tsx'), 'utf8')
  assert.match(page, /organizationSlug: targetOrganization\?\.slug/)
  assert.match(page, /adminUserId: targetAdmin\?\.id/)
  assert.match(page, /slug: \{org\.slug\}/)
  assert.match(page, /User ID: \{primaryAdmin\?\.id/)
  assert.match(page, /Пароль обновлён для: \{name\} \(slug: \{slug\}\)/)
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
