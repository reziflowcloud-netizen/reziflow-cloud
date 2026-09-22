// employeeId is the business responsibility. Never infer identity from names.
function planStaffAssignmentReconciliation(records) {
  const counts = {
    mismatchesTotal: 0,
    eligibleRepair: 0,
    skippedNoLinkedUser: 0,
    skippedInvalidCrossTenant: 0,
    alreadyCorrect: 0,
  }
  const updates = []

  for (const record of records) {
    if (record.employeeId == null) continue
    const employeeValid = record.employeeOrganizationId != null
      && record.employeeOrganizationId === record.organizationId
      && Number(record.employeeId) === Number(record.resolvedEmployeeId)
    const linkedUserId = record.linkedUserId == null ? null : Number(record.linkedUserId)
    const userValid = linkedUserId == null || (
      record.linkedUserOrganizationId === record.organizationId
      && Number(record.resolvedUserId) === linkedUserId
    )
    if (employeeValid && userValid && record.assignedToId === linkedUserId) {
      counts.alreadyCorrect += 1
      continue
    }

    counts.mismatchesTotal += 1
    if (!employeeValid || !userValid) {
      counts.skippedInvalidCrossTenant += 1
      continue
    }
    if (linkedUserId == null) {
      counts.skippedNoLinkedUser += 1
      continue
    }
    counts.eligibleRepair += 1
    updates.push({
      id: String(record.id),
      organizationId: String(record.organizationId),
      employeeId: Number(record.employeeId),
      previousAssignedToId: record.assignedToId == null ? null : Number(record.assignedToId),
      targetUserId: linkedUserId,
    })
  }
  return { counts, updates }
}

module.exports = { planStaffAssignmentReconciliation }
