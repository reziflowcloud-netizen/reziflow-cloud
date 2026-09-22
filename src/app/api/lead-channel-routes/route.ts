import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizeLeadSources } from '@/lib/leads'
import { getLeadWebhookSettings, settingsObject } from '@/lib/leadWebhook'
import { normalizeSourceKey } from '@/lib/leadRouting'
import { hasDuplicateRouteMembers } from '@/lib/leadRoutingPolicy'
import { staffScopeFilterEnabled } from '@/lib/staffScopeSettings'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

async function context(user: any) {
  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  if (!organization) return null
  const configured = normalizeLeadSources(settingsObject(organization.settings).leadSources)
    .filter(source => source.value !== 'manual')
  if (!configured.some(source => source.value === 'telegram')) {
    configured.push({ value: 'telegram', label: 'Telegram', order: configured.length, system: true })
  }
  return { organizationId, organizationSettings: organization.settings, channels: configured }
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ctx = await context(user)
  if (!ctx) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  const [routes, employees] = await Promise.all([
    (prisma as any).leadChannelRoute.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        sourceKey: true,
        members: {
          select: { employeeId: true, position: true },
          orderBy: [{ position: 'asc' }, { employeeId: 'asc' }],
        },
      },
      orderBy: { sourceKey: 'asc' },
    }),
    (prisma as any).employee.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      select: { id: true, name: true, userId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
  ])
  const allowedChannels = new Set(ctx.channels.map(channel => normalizeSourceKey(channel.value)))
  return NextResponse.json({
    channels: ctx.channels,
    routes: routes
      .filter((route: any) => allowedChannels.has(route.sourceKey))
      .map((route: any) => ({
        sourceKey: route.sourceKey,
        employeeIds: route.members.map((member: any) => member.employeeId),
      })),
    employees,
    staffScopeFilterEnabled: staffScopeFilterEnabled(ctx.organizationSettings),
  })
}

function normalizeRoutes(input: any[]) {
  const grouped = new Map<string, number[]>()
  for (const item of input) {
    const sourceKey = normalizeSourceKey(item?.sourceKey)
    const employeeIds = Array.isArray(item?.employeeIds)
      ? item.employeeIds.map(Number)
      : item?.employeeId !== undefined
        ? [Number(item.employeeId)]
        : []
    grouped.set(sourceKey, [...(grouped.get(sourceKey) || []), ...employeeIds])
  }
  return Array.from(grouped, ([sourceKey, employeeIds]) => ({ sourceKey, employeeIds }))
}

export async function PUT(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ctx = await context(user)
  if (!ctx) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const input = Array.isArray(body.routes) ? body.routes : []
  const routes = normalizeRoutes(input).filter(route => route.employeeIds.length)
  const allowedChannels = new Set(ctx.channels.map(channel => normalizeSourceKey(channel.value)))
  if (routes.some(route => !route.sourceKey || !allowedChannels.has(route.sourceKey))) {
    return NextResponse.json({ error: 'Unknown inbound channel' }, { status: 400 })
  }
  if (hasDuplicateRouteMembers(routes)) {
    return NextResponse.json({ error: 'An employee can appear only once in a channel route' }, { status: 409 })
  }

  const employeeIds = Array.from(new Set(routes.flatMap(route => route.employeeIds)))
  if (employeeIds.some(id => !Number.isInteger(id) || id <= 0)) {
    return NextResponse.json({ error: 'Invalid employee' }, { status: 400 })
  }
  const employees = employeeIds.length
    ? await (prisma as any).employee.findMany({
        where: { id: { in: employeeIds }, organizationId: ctx.organizationId, active: true },
        select: { id: true, userId: true },
      })
    : []
  const eligible = new Set(employees.filter((employee: any) => employee.userId).map((employee: any) => employee.id))
  if (employeeIds.some(id => !eligible.has(id))) {
    return NextResponse.json({ error: 'Employee must belong to this organization and be linked to a User' }, { status: 404 })
  }

  const incomingAssignment = body.assignment && typeof body.assignment === 'object' ? body.assignment : null
  const mode = String(incomingAssignment?.mode || '')
  if (incomingAssignment && !['off', 'single', 'round_robin'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid assignment mode' }, { status: 400 })
  }
  const assignmentUserId = incomingAssignment?.userId ? Number(incomingAssignment.userId) : null
  const assignmentUserIds = Array.isArray(incomingAssignment?.userIds)
    ? Array.from(new Set(incomingAssignment.userIds.map(Number).filter(Number.isInteger))) as number[]
    : []
  const requestedUserIds = Array.from(new Set([
    ...(assignmentUserId ? [assignmentUserId] : []),
    ...assignmentUserIds,
  ]))
  if (incomingAssignment && requestedUserIds.length) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: requestedUserIds }, organizationId: ctx.organizationId },
      select: { id: true },
    })
    const validUserIds = new Set(validUsers.map(item => item.id))
    if (requestedUserIds.some(id => !validUserIds.has(id))) {
      return NextResponse.json({ error: 'Assignment user must belong to this organization' }, { status: 404 })
    }
  }

  const currentSettings = settingsObject(ctx.organizationSettings)
  const currentWebhook = getLeadWebhookSettings(currentSettings)
  const nextStaffScopeFilterEnabled = typeof body.staffScopeFilterEnabled === 'boolean'
    ? body.staffScopeFilterEnabled
    : staffScopeFilterEnabled(currentSettings)

  await prisma.$transaction(async tx => {
    await (tx as any).leadChannelRoute.deleteMany({ where: { organizationId: ctx.organizationId } })
    for (const route of routes) {
      await (tx as any).leadChannelRoute.create({
        data: {
          organizationId: ctx.organizationId,
          sourceKey: route.sourceKey,
          nextPosition: 0,
          members: {
            create: route.employeeIds.map((employeeId, position) => ({
              employeeId,
              position,
            })),
          },
        },
      })
    }

    await tx.organization.update({
      where: { id: ctx.organizationId },
      data: {
        settings: {
          ...currentSettings,
          staffScopeFilterEnabled: nextStaffScopeFilterEnabled,
          ...(incomingAssignment ? {
            leadWebhookAssignmentMode: mode,
            leadWebhookAssignmentUserId: assignmentUserId,
            leadWebhookAssignmentUserIds: assignmentUserIds,
            leadWebhookAssignmentCursor: currentWebhook.leadWebhookAssignmentCursor || 0,
          } : {}),
        },
      },
    })
  })
  return NextResponse.json({ routes, staffScopeFilterEnabled: nextStaffScopeFilterEnabled })
}
