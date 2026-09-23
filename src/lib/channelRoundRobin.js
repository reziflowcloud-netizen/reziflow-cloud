function chooseNextRouteMember(members, nextPosition) {
  if (!members.length) return null
  return members.find(member => member.position >= nextPosition) || members[0]
}

async function takeNextChannelAssignmentInTransaction(client, organizationId, sourceKey) {
  const locked = await client.$queryRawUnsafe(
    'SELECT "id" FROM "LeadChannelRoute" WHERE "organizationId" = $1 AND "sourceKey" = $2 FOR UPDATE',
    organizationId,
    sourceKey,
  )
  const routeId = Array.isArray(locked) ? locked[0]?.id : null
  if (!routeId) return null

  const route = await client.leadChannelRoute.findUnique({
    where: { id: routeId },
    select: {
      id: true,
      nextPosition: true,
      members: {
        orderBy: [{ position: 'asc' }, { employeeId: 'asc' }],
        select: {
          position: true,
          employee: {
            select: {
              id: true,
              organizationId: true,
              active: true,
              userId: true,
              user: { select: { id: true } },
            },
          },
        },
      },
    },
  })
  if (!route) return null

  const eligible = route.members.filter(member => {
    const employee = member.employee
    return employee?.active
      && employee.organizationId === organizationId
      && employee.userId
      && employee.user?.id === employee.userId
  })
  const selected = chooseNextRouteMember(eligible, route.nextPosition)
  if (!selected) return null

  await client.leadChannelRoute.update({
    where: { id: route.id },
    data: { nextPosition: selected.position + 1 },
  })
  return { employeeId: selected.employee.id, assignedToId: selected.employee.user.id }
}

async function takeNextChannelAssignment(client, organizationId, sourceKey) {
  if (typeof client?.$transaction === 'function') {
    return client.$transaction(tx => takeNextChannelAssignmentInTransaction(tx, organizationId, sourceKey))
  }
  return takeNextChannelAssignmentInTransaction(client, organizationId, sourceKey)
}

module.exports = { chooseNextRouteMember, takeNextChannelAssignment }
