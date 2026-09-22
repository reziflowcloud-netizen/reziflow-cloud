import assert from 'node:assert/strict'
import test from 'node:test'

import {
  leadAssignmentData,
  leadWhereForAccess,
} from '../src/lib/leadAssignmentPolicy.ts'
import employeeUserResolver from '../src/lib/employeeUserResolver.js'

const {
  planLeadResponsibleBackfill,
  planEmployeeUserIdentityBackfill,
  resolveUniqueUserIdForEmployeeName,
} = employeeUserResolver

const organizationA = 'organization-a'
const organizationB = 'organization-b'
const userA = 101
const userB = 202
const employeeA = 11
const employeeB = 22

function matchesWhere(lead, where) {
  return Object.entries(where).every(([key, value]) => lead[key] === value)
}

function visible(leads, scope, organizationId, extra = {}) {
  const where = leadWhereForAccess(scope, organizationId, extra)
  return leads.filter(lead => matchesWhere(lead, where))
}

function assignedLead(overrides = {}) {
  return {
    id: 'lead-a',
    organizationId: organizationA,
    ...leadAssignmentData(employeeA, userA),
    ...overrides,
  }
}

test('admin assignment to Employee A exposes the lead to linked restricted User A', () => {
  const lead = assignedLead()

  assert.equal(visible([lead], { restricted: true, userId: userA }, organizationA).length, 1)
})

test('restricted User B cannot see a lead assigned to Employee A', () => {
  const lead = assignedLead()

  assert.equal(visible([lead], { restricted: true, userId: userB }, organizationA).length, 0)
})

test('reassignment revokes A and grants B', () => {
  const lead = {
    id: 'lead-a',
    organizationId: organizationA,
    ...leadAssignmentData(employeeB, userB),
  }

  assert.equal(visible([lead], { restricted: true, userId: userA }, organizationA).length, 0)
  assert.equal(visible([lead], { restricted: true, userId: userB }, organizationA).length, 1)
})

test('unassignment clears both business responsibility and access ownership', () => {
  const lead = {
    id: 'lead-a',
    organizationId: organizationA,
    ...leadAssignmentData(null, null),
  }

  assert.deepEqual(
    { employeeId: lead.employeeId, assignedToId: lead.assignedToId },
    { employeeId: null, assignedToId: null },
  )
  assert.equal(visible([lead], { restricted: true, userId: userA }, organizationA).length, 0)
})

test('full-access admin continues to see organization leads', () => {
  const lead = assignedLead()

  assert.deepEqual(
    visible([lead], { restricted: false, userId: 1 }, organizationA).map(item => item.id),
    ['lead-a'],
  )
})

test('organization scope blocks cross-organization leads', () => {
  const leads = [
    assignedLead(),
    { id: 'lead-b', organizationId: organizationB, ...leadAssignmentData(employeeA, userA) },
  ]

  assert.deepEqual(
    visible(leads, { restricted: true, userId: userA }, organizationA).map(lead => lead.id),
    ['lead-a'],
  )
})

test('bulk assignment uses the same assignment pair as single assignment', () => {
  const leads = ['lead-a', 'lead-b', 'lead-c'].map(id => ({
    id,
    organizationId: organizationA,
    ...leadAssignmentData(employeeA, userA),
  }))

  assert.equal(visible(leads, { restricted: true, userId: userA }, organizationA).length, 3)
  assert.equal(visible(leads, { restricted: true, userId: userB }, organizationA).length, 0)
})

test('lead detail and list use the same restricted visibility predicate', () => {
  const leads = [
    { id: 'hot', organizationId: organizationA, status: 'active', urgency: 'hot', ...leadAssignmentData(employeeA, userA) },
    { id: 'cold', organizationId: organizationA, status: 'active', urgency: 'cold', ...leadAssignmentData(employeeB, userB) },
  ]
  const scope = { restricted: true, userId: userA }
  const list = visible(leads, scope, organizationA)
  const detail = visible(leads, scope, organizationA, { id: 'hot' })[0]

  assert.deepEqual(list.map(lead => lead.id), ['hot'])
  assert.equal(detail?.id, 'hot')
})

test('counts and filters use the same restricted visibility predicate', () => {
  const leads = [
    { id: 'hot', organizationId: organizationA, status: 'active', urgency: 'hot', ...leadAssignmentData(employeeA, userA) },
    { id: 'cold', organizationId: organizationA, status: 'active', urgency: 'cold', ...leadAssignmentData(employeeB, userB) },
  ]
  const scope = { restricted: true, userId: userA }
  const count = visible(leads, scope, organizationA).length
  const filtered = visible(leads, scope, organizationA, { status: 'active', urgency: 'hot' })

  assert.equal(count, 1)
  assert.deepEqual(filtered.map(lead => lead.id), ['hot'])
})

test('resolver fails closed when two users have the same normalized display name', () => {
  const users = [
    { id: userA, name: ' Employee A ', email: null },
    { id: userB, name: 'employee   a', email: null },
  ]

  assert.equal(resolveUniqueUserIdForEmployeeName('EMPLOYEE A', users), null)
})

test('backfill plans only same-organization records with an unambiguous mapping', () => {
  const plan = planLeadResponsibleBackfill({
    leads: [
      { id: 'eligible', employeeId: employeeA, assignedToId: null },
      { id: 'ambiguous', employeeId: employeeB, assignedToId: null },
      { id: 'missing', employeeId: 33, assignedToId: userA },
      { id: 'unassigned', employeeId: null, assignedToId: userA },
    ],
    employees: [
      { id: employeeA, name: 'Employee A' },
      { id: employeeB, name: 'Employee B' },
      { id: 33, name: 'Employee C' },
    ],
    users: [
      { id: userA, name: 'employee a', email: null },
      { id: userB, name: 'Employee B', email: null },
      { id: 303, name: ' employee   b ', email: null },
    ],
  })

  assert.deepEqual(plan.updates, [{
    leadId: 'eligible',
    employeeId: employeeA,
    previousAssignedToId: null,
    assignedToId: userA,
  }])
  assert.equal(plan.counts.ambiguousMapping, 1)
  assert.equal(plan.counts.noMatchingUser, 1)
  assert.equal(plan.counts.eligibleUpdates, 1)
})

test('identity backfill links only one-to-one matches inside the same organization', () => {
  const plan = planEmployeeUserIdentityBackfill({
    employees: [
      { id: 1, organizationId: 'a', name: 'Oksana', userId: null },
      { id: 2, organizationId: 'a', name: 'Marek', userId: null },
      { id: 3, organizationId: 'a', name: ' marek ', userId: null },
      { id: 4, organizationId: 'b', name: 'Oksana', userId: null },
    ],
    users: [
      { id: 11, organizationId: 'a', name: 'oksana', email: 'a@example.com' },
      { id: 22, organizationId: 'a', name: 'Marek', email: 'b@example.com' },
      { id: 44, organizationId: 'b', name: 'Other', email: 'other@example.com' },
    ],
  })

  assert.deepEqual(plan.updates, [{ employeeId: 1, userId: 11, organizationId: 'a' }])
  assert.equal(plan.counts.ambiguous, 2)
  assert.equal(plan.counts.missing, 1)
})
