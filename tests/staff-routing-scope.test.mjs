import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'

import { chooseLeadAssignment, hasDuplicateRouteMembers } from '../src/lib/leadRoutingPolicy.ts'

const workspace = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const { chooseNextRouteMember } = require('../src/lib/channelRoundRobin.js')

test('lead routing precedence is external, channel, fallback, none', () => {
  const external = { employeeId: 1, assignedToId: 11 }
  const channel = { employeeId: 2, assignedToId: 22 }
  const fallback = { employeeId: 3, assignedToId: 33 }
  assert.deepEqual(chooseLeadAssignment({ external, channel, fallback }), { ...external, origin: 'external' })
  assert.deepEqual(chooseLeadAssignment({ channel, fallback }), { ...channel, origin: 'channel' })
  assert.deepEqual(chooseLeadAssignment({ fallback }), { ...fallback, origin: 'fallback' })
  assert.deepEqual(chooseLeadAssignment({}), { employeeId: null, assignedToId: null, origin: 'none' })
})

test('channel assignment fails closed unless Employee and User are both present', () => {
  assert.equal(chooseLeadAssignment({ channel: { employeeId: 2, assignedToId: null } }).origin, 'none')
  assert.equal(chooseLeadAssignment({ channel: { employeeId: null, assignedToId: 22 } }).origin, 'none')
})

test('a channel supports multiple unique ordered employees', () => {
  assert.equal(hasDuplicateRouteMembers([{ sourceKey: 'facebook', employeeIds: [1, 2, 3] }]), false)
  assert.equal(hasDuplicateRouteMembers([{ sourceKey: 'facebook', employeeIds: [1, 2, 1] }]), true)
})

test('round robin order is deterministic for one, two, and three members', () => {
  const members = [1, 2, 3].map((employeeId, position) => ({ employeeId, position }))
  const sequence = count => Array.from({ length: count }, (_, index) => chooseNextRouteMember(members, index % members.length)?.employeeId)
  assert.deepEqual(Array.from({ length: 4 }, () => chooseNextRouteMember(members.slice(0, 1), 0)?.employeeId), [1, 1, 1, 1])
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => chooseNextRouteMember(members.slice(0, 2), index % 2)?.employeeId), [1, 2, 1, 2, 1, 2])
  assert.deepEqual(sequence(7), [1, 2, 3, 1, 2, 3, 1])
})

test('staff scope always composes with access scope and validates tenant employee ids', async () => {
  const source = await readFile(resolve(workspace, 'src/lib/staffScope.ts'), 'utf8')
  assert.match(source, /AND:\s*\[\s*baseWhere,/)
  assert.match(source, /where:\s*\{ id: employeeId, organizationId, active: true \}/)
  assert.match(source, /Staff scope cannot expand access/)
})

test('all list and filtered bulk endpoints resolve the same server-backed staff scope', async () => {
  for (const path of [
    'src/app/api/leads/route.ts',
    'src/app/api/cases/route.ts',
    'src/app/api/tasks/route.ts',
    'src/app/api/leads/bulk/route.ts',
    'src/app/api/cases/bulk/route.ts',
  ]) {
    const source = await readFile(resolve(workspace, path), 'utf8')
    assert.match(source, /resolveStaffScope/)
  }
  const bulkBuilder = await readFile(resolve(workspace, 'src/lib/bulkActions.ts'), 'utf8')
  assert.match(bulkBuilder, /if \(and\.length\) where\.AND = and\s+return staffScope \? applyEmployeeStaffScope\(where, staffScope\) : where/)
})

test('automatic inbound lead creators use centralized routing while manual creation does not', async () => {
  const inboundPaths = [
    'src/lib/leadWebhookHandler.ts',
    'src/app/api/webhooks/meta/leads/[slug]/route.ts',
    'src/app/api/webhooks/meta/messages/[slug]/route.ts',
    'src/app/api/webhooks/telegram/leads/[slug]/[key]/route.ts',
  ]
  for (const path of inboundPaths) {
    const source = await readFile(resolve(workspace, path), 'utf8')
    assert.match(source, /resolveInboundLeadAssignment/)
  }
  const manual = await readFile(resolve(workspace, 'src/app/api/leads/route.ts'), 'utf8')
  assert.doesNotMatch(manual, /resolveInboundLeadAssignment/)

  const metaAds = await readFile(resolve(workspace, 'src/app/api/webhooks/meta/leads/[slug]/route.ts'), 'utf8')
  assert.match(metaAds, /sourceKey:\s*'target'/)
  const metaMessages = await readFile(resolve(workspace, 'src/app/api/webhooks/meta/messages/[slug]/route.ts'), 'utf8')
  assert.match(metaMessages, /sourceKey:\s*channel/)
})

test('one shared StaffScopeControl is used by all four product modules', async () => {
  for (const path of ['src/app/leads/page.tsx', 'src/app/cases/page.tsx', 'src/app/tasks/page.tsx', 'src/app/calendar/page.tsx']) {
    const source = await readFile(resolve(workspace, path), 'utf8')
    assert.match(source, /StaffScopeControl/)
  }
})

test('channel cursor is database-backed, locked, and only reached after explicit assignment', async () => {
  const roundRobin = await readFile(resolve(workspace, 'src/lib/channelRoundRobin.js'), 'utf8')
  const routing = await readFile(resolve(workspace, 'src/lib/leadRouting.ts'), 'utf8')
  assert.match(roundRobin, /FOR UPDATE/)
  assert.match(roundRobin, /nextPosition: selected\.position \+ 1/)
  assert.match(routing, /if \(explicit\) return/)
  assert.match(routing, /channel !== 'manual'/)
  assert.ok(routing.indexOf('if (explicit) return') < routing.indexOf('const channelAssignment = await takeNextChannelAssignment'))
})

test('V2 migration preserves every V1 route as position zero', async () => {
  const migration = await readFile(resolve(workspace, 'prisma/migrations/20260922140000_staff_routing_v2/migration.sql'), 'utf8')
  assert.match(migration, /INSERT INTO "LeadChannelRouteMember"/)
  assert.match(migration, /FROM "LeadChannelRoute"/)
  assert.match(migration, /CREATE TRIGGER "LeadChannelRoute_seed_legacy_member"/)
  assert.doesNotMatch(migration, /DROP (?:COLUMN|CONSTRAINT) "(?:employeeId|LeadChannelRoute_employeeId_fkey)"/)
})

test('disabled staff filter resolves full access to ALL without widening restricted access', async () => {
  const scope = await readFile(resolve(workspace, 'src/lib/staffScope.ts'), 'utf8')
  const control = await readFile(resolve(workspace, 'src/components/StaffScopeControl.tsx'), 'utf8')
  assert.match(scope, /if \(!access\.restricted\)/)
  assert.match(scope, /if \(!staffScopeFilterEnabled\(organization\?\.settings\)\) return \{ kind: 'all' \}/)
  assert.match(scope, /if \(access\.restricted && requested !== 'mine'\)/)
  assert.match(control, /if \(controlVisible !== true\) return null/)
})
