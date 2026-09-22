import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { planStaffAssignmentReconciliation } = require('../src/lib/staffAssignmentReconciliation.js')
const workspace = resolve(import.meta.dirname, '..')

test('historical reconciliation uses Employee.userId and never guesses from names', () => {
  const organizationId = 'tenant-a'
  const records = [
    { id: 'correct', organizationId, employeeId: 1, assignedToId: 10, resolvedEmployeeId: 1, employeeOrganizationId: organizationId, linkedUserId: 10, resolvedUserId: 10, linkedUserOrganizationId: organizationId },
    { id: 'repair', organizationId, employeeId: 1, assignedToId: 20, resolvedEmployeeId: 1, employeeOrganizationId: organizationId, linkedUserId: 10, resolvedUserId: 10, linkedUserOrganizationId: organizationId },
    { id: 'unlinked', organizationId, employeeId: 2, assignedToId: 20, resolvedEmployeeId: 2, employeeOrganizationId: organizationId, linkedUserId: null, resolvedUserId: null, linkedUserOrganizationId: null },
    { id: 'cross-tenant', organizationId, employeeId: 3, assignedToId: 20, resolvedEmployeeId: 3, employeeOrganizationId: 'tenant-b', linkedUserId: 30, resolvedUserId: 30, linkedUserOrganizationId: 'tenant-b' },
    { id: 'invalid-user', organizationId, employeeId: 4, assignedToId: 20, resolvedEmployeeId: 4, employeeOrganizationId: organizationId, linkedUserId: 40, resolvedUserId: 40, linkedUserOrganizationId: 'tenant-b' },
  ]
  const plan = planStaffAssignmentReconciliation(records)
  assert.deepEqual(plan.counts, {
    mismatchesTotal: 4, eligibleRepair: 1, skippedNoLinkedUser: 1,
    skippedInvalidCrossTenant: 2, alreadyCorrect: 1,
  })
  assert.deepEqual(plan.updates, [{ id: 'repair', organizationId, employeeId: 1, previousAssignedToId: 20, targetUserId: 10 }])
})

test('explicit-link endpoint validates tenant, uniqueness, concurrency, and impact', async () => {
  const source = await readFile(resolve(workspace, 'src/app/api/employees/[id]/identity/route.ts'), 'utf8')
  assert.match(source, /isOrganizationAdmin/)
  assert.match(source, /where: \{ id: targetUserId, organizationId \}/)
  assert.match(source, /userId: targetUserId, id: \{ not: employeeId \}/)
  assert.match(source, /where: \{ id: employeeId, organizationId, userId: expectedUserId \}/)
  assert.match(source, /confirmImpact/)
  assert.match(source, /isolationLevel: 'Serializable'/)
  const employeesApi = await readFile(resolve(workspace, 'src/app/api/employees/route.ts'), 'utf8')
  assert.doesNotMatch(employeesApi, /ensureUserEmployees/)
})

test('unlinked full-access Mine is unavailable while restricted Mine retains assignedToId access', async () => {
  const source = await readFile(resolve(workspace, 'src/lib/staffScope.ts'), 'utf8')
  assert.match(source, /if \(!employee && !access\.restricted\)/)
  assert.match(source, /Link your CRM account to an Employee to use Mine/)
  assert.match(source, /assignedToFallback: !employee && access\.restricted/)
  assert.match(source, /assignedToId: scope\.userId/)
  assert.match(source, /Staff scope cannot expand access/)
  const ui = await readFile(resolve(workspace, 'src/components/StaffScopeControl.tsx'), 'utf8')
  assert.match(ui, /disabled=\{!restricted && !mineAvailable\}/)
  assert.match(ui, /title=\{!restricted && !mineAvailable \? copy\.link/)
})

test('unlinked routing employees are rejected server-side and disabled in editor', async () => {
  const backend = await readFile(resolve(workspace, 'src/app/api/lead-channel-routes/route.ts'), 'utf8')
  const ui = await readFile(resolve(workspace, 'src/app/settings/integrations/page.tsx'), 'utf8')
  assert.match(backend, /employees\.filter\(\(employee: any\) => employee\.userId\)/)
  assert.match(ui, /disabled=\{!employee\.userId\}/)
  assert.match(ui, /Спочатку прив’яжіть CRM-акаунт/)
})

test('reconciliation APPLY requires reviewed fingerprint and optimistic record guards', async () => {
  const script = await readFile(resolve(workspace, 'scripts/reconcile-staff-assignments.js'), 'utf8')
  assert.match(script, /SET TRANSACTION READ ONLY/)
  assert.match(script, /ALLOW_STAFF_RECONCILIATION_APPLY/)
  assert.match(script, /expected-summary/)
  assert.match(script, /assignedToId: item\.previousAssignedToId/)
  assert.match(script, /userId: item\.targetUserId/)
})
