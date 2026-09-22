import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizeLeadSources } from '@/lib/leads'
import { settingsObject } from '@/lib/leadWebhook'
import { normalizeSourceKey } from '@/lib/leadRouting'
import { hasDuplicateChannelKeys } from '@/lib/leadRoutingPolicy'

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
  return { organizationId, channels: configured }
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
      select: { id: true, sourceKey: true, employeeId: true },
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
    routes: routes.filter((route: any) => allowedChannels.has(route.sourceKey)),
    employees,
  })
}

export async function PUT(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ctx = await context(user)
  if (!ctx) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const input = Array.isArray(body.routes) ? body.routes : []
  const allowedChannels = new Set(ctx.channels.map(channel => normalizeSourceKey(channel.value)))
  const routes: Array<{ sourceKey: string; employeeId: number }> = input.map((route: any) => ({
    sourceKey: normalizeSourceKey(route?.sourceKey),
    employeeId: Number(route?.employeeId),
  }))
  if (routes.some(route => !route.sourceKey || !allowedChannels.has(route.sourceKey))) {
    return NextResponse.json({ error: 'Unknown inbound channel' }, { status: 400 })
  }
  if (hasDuplicateChannelKeys(routes)) {
    return NextResponse.json({ error: 'A channel can have only one default employee' }, { status: 409 })
  }
  const employeeIds = Array.from(new Set(routes.map(route => route.employeeId)))
  const employees = employeeIds.length
    ? await (prisma as any).employee.findMany({
        where: { id: { in: employeeIds }, organizationId: ctx.organizationId, active: true },
        select: { id: true, userId: true },
      })
    : []
  const eligible = new Set(employees.filter((employee: any) => employee.userId).map((employee: any) => employee.id))
  if (employeeIds.some(id => !Number.isInteger(id) || !eligible.has(id))) {
    return NextResponse.json({ error: 'Employee must belong to this organization and be linked to a User' }, { status: 404 })
  }

  await prisma.$transaction(async tx => {
    await (tx as any).leadChannelRoute.deleteMany({ where: { organizationId: ctx.organizationId } })
    if (routes.length) {
      await (tx as any).leadChannelRoute.createMany({
        data: routes.map(route => ({ organizationId: ctx.organizationId, ...route })),
      })
    }
  })
  return NextResponse.json({ routes })
}
