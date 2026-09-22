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

export function hasDuplicateChannelKeys(routes: Array<{ sourceKey: string }>) {
  return new Set(routes.map(route => route.sourceKey)).size !== routes.length
}
