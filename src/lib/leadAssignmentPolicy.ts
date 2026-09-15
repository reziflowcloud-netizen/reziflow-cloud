export type LeadAssignmentData = {
  employeeId: number | null
  assignedToId: number | null
}

export type LeadVisibilityScope = {
  restricted: boolean
  userId: number | null
}

export function leadAssignmentData(
  employeeId?: number | null,
  linkedUserId?: number | null,
): LeadAssignmentData {
  return {
    employeeId: employeeId || null,
    assignedToId: employeeId ? linkedUserId || null : null,
  }
}

export function leadWhereForAccess(
  scope: LeadVisibilityScope,
  organizationId: string,
  extra: Record<string, any> = {},
) {
  return {
    organizationId,
    ...extra,
    ...(scope.restricted && scope.userId ? { assignedToId: scope.userId } : {}),
  }
}
