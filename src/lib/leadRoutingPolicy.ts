export type AssignmentCandidate = {
  employeeId: number | null
  assignedToId: number | null
}

export function chooseLeadAssignment(candidates: {
  external?: AssignmentCandidate | null
  channel?: AssignmentCandidate | null
  fallback?: AssignmentCandidate | null
}) {
  if (candidates.external?.assignedToId) return { ...candidates.external, origin: 'external' as const }
  if (candidates.channel?.employeeId && candidates.channel.assignedToId) return { ...candidates.channel, origin: 'channel' as const }
  if (candidates.fallback?.assignedToId) return { ...candidates.fallback, origin: 'fallback' as const }
  return { employeeId: null, assignedToId: null, origin: 'none' as const }
}

export function hasDuplicateRouteMembers(routes: Array<{ sourceKey: string; employeeIds: number[] }>) {
  return routes.some(route => new Set(route.employeeIds).size !== route.employeeIds.length)
}

export function chooseNextRouteMember<T extends { position: number }>(members: T[], nextPosition: number) {
  if (!members.length) return null
  return members.find(member => member.position >= nextPosition) || members[0]
}
