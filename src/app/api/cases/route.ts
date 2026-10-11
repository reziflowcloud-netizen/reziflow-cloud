// src/app/api/cases/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createCaseWithChecklist } from '@/lib/documentChecklist'
import { ChecklistError } from '@/lib/documentChecklistPolicy'
import { getOrganizationId, getUser } from '@/lib/auth'
import { caseWhereForScope, findScopedClient, getDataAccessScope } from '@/lib/apiScope'
import { assertBillingLimit, billingLimitResponsePayload, isBillableActiveCaseStatus, isBillingLimitError } from '@/lib/billing'
import { resolveUserIdForEmployee } from '@/lib/employeeSync'
import { SAFE_ASSIGNEE_SELECT } from '@/lib/security'
import { applyEmployeeStaffScope, resolveStaffScope, StaffScopeError } from '@/lib/staffScope'

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  let staffScope
  try {
    staffScope = await resolveStaffScope(request.nextUrl.searchParams.get('staffScope'), user, organizationId, scope)
  } catch (error) {
    if (error instanceof StaffScopeError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
  const scopedWhere = applyEmployeeStaffScope(caseWhereForScope(scope, organizationId), staffScope)
  const listView = request.nextUrl.searchParams.get('view') === 'list'
  try {
    if (listView) {
      const cases = await prisma.case.findMany({
        where: scopedWhere,
        select: {
          id: true,
          status: true,
          contractSigned: true,
          totalValue: true,
          totalPaid: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { firstName: true, lastName: true, phone: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          employee: { select: { id: true, name: true } },
          service: { select: { name: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(cases)
    }

    const cases = await prisma.case.findMany({
      where: scopedWhere,
      include: { client: true, assignedTo: { select: SAFE_ASSIGNEE_SELECT }, employee: true, service: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(cases)
  } catch (e: any) {
    const cases = await prisma.case.findMany({
      where: scopedWhere,
      include: { client: true, assignedTo: { select: SAFE_ASSIGNEE_SELECT }, employee: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(cases)
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  try {
    const body = await request.json()
    if (scope.restricted) {
      const scopedClient = await findScopedClient(body.clientId, organizationId, { id: true })
      if (!scopedClient) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const caseNumber = body.caseNumber?.trim() || null
    const status = body.status || 'Новый'
    const employeeId = body.employeeId ? parseInt(body.employeeId) : null
    const employeeUserId = !scope.restricted && employeeId
      ? await resolveUserIdForEmployee(organizationId, employeeId)
      : null
    if (isBillableActiveCaseStatus(status)) {
      await assertBillingLimit(organizationId, 'cases')
    }

    const client = await prisma.client.findFirst({ where: { id: body.clientId, organizationId }, select: { id: true } })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    const newCase = await prisma.$transaction(async tx => {
      const created = await createCaseWithChecklist(tx, {
        organizationId,
        caseNumber,
        clientId: body.clientId,
        status,
        stayPurpose: body.stayPurpose || null,
        stayType: body.stayType || null,
        contractType: body.contractType || null,
        totalValue: parseFloat(body.totalValue) || 0,
        assignedToId: scope.restricted && scope.userId ? scope.userId : body.assignedToId ? parseInt(body.assignedToId) : employeeUserId,
        employeeId,
        serviceId: body.serviceId ? parseInt(body.serviceId) : null,
        notes: body.notes || null,
      })
      await tx.statusHistory.create({ data: { caseId: created.id, toStatus: created.status, changedBy: user.name as string || 'System' } })
      return created
    })
    return NextResponse.json(newCase)
  } catch (e: any) {
    console.error(e)
    if (e instanceof ChecklistError) return NextResponse.json({ error: e.message }, { status: e.status })
    if (isBillingLimitError(e)) return NextResponse.json(billingLimitResponsePayload(e), { status: 402 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
