import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { isOrganizationAdmin } from '@/lib/security'
import { isConferenceDemoSession } from '@/lib/conferenceDemo'

type RouteContext = { params: { id: string } }

function authorized(user: unknown) {
  return isOrganizationAdmin(user) && !isConferenceDemoSession(user)
}

function employeeIdFrom(params: RouteContext['params']) {
  const id = Number(params.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function impact(client: any, organizationId: string, employeeId: number, currentUserId: number | null) {
  const [routingRules, leads, cases, currentUser] = await Promise.all([
    client.leadChannelRouteMember.count({ where: { organizationId, employeeId } }),
    client.lead.count({ where: { organizationId, employeeId } }),
    client.case.count({ where: { organizationId, employeeId } }),
    currentUserId
      ? client.user.findFirst({ where: { id: currentUserId, organizationId }, select: { restrictedAccess: true } })
      : Promise.resolve(null),
  ])
  return { routingRules, leads, cases, restrictedAccess: currentUser?.restrictedAccess === true }
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const employeeId = employeeIdFrom(params)
  if (!employeeId) return NextResponse.json({ error: 'Invalid employee' }, { status: 400 })
  const organizationId = getOrganizationId(user)
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: { id: true, userId: true },
  })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  return NextResponse.json({ employeeId, userId: employee.userId, impact: await impact(prisma, organizationId, employeeId, employee.userId) })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const employeeId = employeeIdFrom(params)
  if (!employeeId) return NextResponse.json({ error: 'Invalid employee' }, { status: 400 })
  const organizationId = getOrganizationId(user)
  const parsedBody = await request.json().catch(() => ({}))
  const body = parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody) ? parsedBody : {}
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedUserId') || !Object.prototype.hasOwnProperty.call(body, 'userId')) {
    return NextResponse.json({ error: 'Expected and target User IDs are required' }, { status: 400 })
  }
  const validUserId = (value: unknown) => value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0)
  if (!validUserId(body.expectedUserId) || !validUserId(body.userId)) {
    return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 })
  }
  const expectedUserId = body.expectedUserId as number | null
  const targetUserId = body.userId as number | null

  try {
    return await prisma.$transaction(async tx => {
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, organizationId },
        select: { id: true, name: true, active: true, userId: true },
      })
      if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
      if (employee.userId !== expectedUserId) {
        return NextResponse.json({ error: 'Employee link changed; refresh before saving' }, { status: 409 })
      }
      if (targetUserId === expectedUserId) return NextResponse.json(employee)

      const target = targetUserId === null ? null : await tx.user.findFirst({
        where: { id: targetUserId, organizationId },
        select: { id: true, restrictedAccess: true },
      })
      if (targetUserId !== null && !target) {
        return NextResponse.json({ error: 'CRM User not found in this organization' }, { status: 404 })
      }
      if (targetUserId !== null) {
        const linkedElsewhere = await tx.employee.findFirst({
          where: { userId: targetUserId, id: { not: employeeId } },
          select: { id: true },
        })
        if (linkedElsewhere) return NextResponse.json({ error: 'CRM User is already linked to another Employee' }, { status: 409 })
      }

      const affected = await impact(tx, organizationId, employeeId, employee.userId)
      const needsConfirmation = affected.routingRules > 0 || affected.leads > 0 || affected.cases > 0
        || affected.restrictedAccess || target?.restrictedAccess === true
      if (needsConfirmation && body.confirmImpact !== true) {
        return NextResponse.json({ error: 'Confirm the impact before changing this link', impact: affected }, { status: 409 })
      }

      const updated = await tx.employee.updateMany({
        where: { id: employeeId, organizationId, userId: expectedUserId },
        data: { userId: targetUserId },
      })
      if (updated.count !== 1) return NextResponse.json({ error: 'Employee link changed; refresh before saving' }, { status: 409 })
      return NextResponse.json({ ...employee, userId: targetUserId })
    }, { isolationLevel: 'Serializable' })
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'CRM User is already linked to another Employee' }, { status: 409 })
    if (error?.code === 'P2003') return NextResponse.json({ error: 'Cross-organization identity is not allowed' }, { status: 400 })
    if (error?.code === 'P2034') return NextResponse.json({ error: 'Identity changed concurrently; refresh and retry' }, { status: 409 })
    return NextResponse.json({ error: 'Could not update Employee identity' }, { status: 500 })
  }
}
