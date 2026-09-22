import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { chooseLeadAssignment, hasDuplicateChannelKeys } from '../src/lib/leadRoutingPolicy.ts'

const workspace = resolve(import.meta.dirname, '..')

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

test('one source key cannot be assigned twice', () => {
  assert.equal(hasDuplicateChannelKeys([{ sourceKey: 'facebook' }, { sourceKey: 'instagram' }]), false)
  assert.equal(hasDuplicateChannelKeys([{ sourceKey: 'facebook' }, { sourceKey: 'facebook' }]), true)
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
