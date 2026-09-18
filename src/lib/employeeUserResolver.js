function normalizePersonName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function userDisplayName(user) {
  return String(user?.name || user?.email || '').trim()
}

function userIdsByNormalizedDisplayName(users) {
  const result = new Map()
  for (const user of users || []) {
    const key = normalizePersonName(userDisplayName(user))
    if (!key) continue
    result.set(key, [...(result.get(key) || []), Number(user.id)])
  }
  return result
}

function resolveUniqueUserIdForEmployeeName(employeeName, users) {
  const employeeKey = normalizePersonName(employeeName)
  if (!employeeKey) return null
  const matches = userIdsByNormalizedDisplayName(users).get(employeeKey) || []
  return matches.length === 1 ? matches[0] : null
}

function planLeadResponsibleBackfill({ leads, employees, users }) {
  const employeeById = new Map((employees || []).map(employee => [Number(employee.id), employee]))
  const userIdsByName = userIdsByNormalizedDisplayName(users)
  const updates = []
  const counts = {
    leadsWithEmployeeId: 0,
    assignedToIdNull: 0,
    assignedToIdMismatch: 0,
    uniqueMappingPossible: 0,
    ambiguousMapping: 0,
    noMatchingUser: 0,
    invalidEmployee: 0,
    eligibleUpdates: 0,
    alreadyCorrect: 0,
  }

  for (const lead of leads || []) {
    if (lead.employeeId == null) continue
    counts.leadsWithEmployeeId += 1
    if (lead.assignedToId == null) counts.assignedToIdNull += 1

    const employee = employeeById.get(Number(lead.employeeId))
    if (!employee) {
      counts.invalidEmployee += 1
      continue
    }

    const matches = userIdsByName.get(normalizePersonName(employee.name)) || []
    if (matches.length === 0) {
      counts.noMatchingUser += 1
      continue
    }
    if (matches.length > 1) {
      counts.ambiguousMapping += 1
      continue
    }

    counts.uniqueMappingPossible += 1
    const assignedToId = lead.assignedToId == null ? null : Number(lead.assignedToId)
    if (assignedToId === matches[0]) {
      counts.alreadyCorrect += 1
      continue
    }
    if (assignedToId != null) counts.assignedToIdMismatch += 1
    updates.push({
      leadId: String(lead.id),
      employeeId: Number(lead.employeeId),
      previousAssignedToId: assignedToId,
      assignedToId: matches[0],
    })
  }

  counts.eligibleUpdates = updates.length
  return { counts, updates }
}

function planEmployeeUserIdentityBackfill({ employees, users }) {
  const employeeGroups = new Map()
  const userGroups = new Map()
  const linkedUserIds = new Set()
  const keyFor = item => `${String(item.organizationId || '')}\u0000${normalizePersonName(item.name || item.email)}`

  for (const employee of employees || []) {
    const key = keyFor(employee)
    if (!employee.organizationId || !normalizePersonName(employee.name)) continue
    employeeGroups.set(key, [...(employeeGroups.get(key) || []), employee])
    if (employee.userId != null) linkedUserIds.add(Number(employee.userId))
  }
  for (const user of users || []) {
    const key = keyFor({ ...user, name: userDisplayName(user) })
    if (!user.organizationId || !normalizePersonName(userDisplayName(user))) continue
    userGroups.set(key, [...(userGroups.get(key) || []), user])
  }

  const updates = []
  const counts = { eligible: 0, alreadyLinked: 0, ambiguous: 0, missing: 0, reservedUser: 0 }
  for (const employee of employees || []) {
    if (employee.userId != null) {
      counts.alreadyLinked += 1
      continue
    }
    const key = keyFor(employee)
    const employeeMatches = employeeGroups.get(key) || []
    const userMatches = userGroups.get(key) || []
    if (employeeMatches.length !== 1 || userMatches.length > 1) {
      counts.ambiguous += 1
      continue
    }
    if (userMatches.length !== 1) {
      counts.missing += 1
      continue
    }
    const userId = Number(userMatches[0].id)
    if (linkedUserIds.has(userId)) {
      counts.reservedUser += 1
      continue
    }
    linkedUserIds.add(userId)
    updates.push({ employeeId: Number(employee.id), userId, organizationId: String(employee.organizationId) })
  }
  counts.eligible = updates.length
  return { counts, updates }
}

module.exports = {
  normalizePersonName,
  userDisplayName,
  resolveUniqueUserIdForEmployeeName,
  planLeadResponsibleBackfill,
  planEmployeeUserIdentityBackfill,
}
