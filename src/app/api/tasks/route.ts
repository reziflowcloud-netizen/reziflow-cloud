// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { caseWhereForScope, getDataAccessScope, taskWhereForScope } from '@/lib/apiScope'
import {
  getCaseImportantDateTaskRef,
  shouldRetirePersonalAppearTask,
} from '@/lib/caseImportantDateTasks'
import { SAFE_ASSIGNEE_SELECT } from '@/lib/security'
import { applyEmployeeStaffScope, applyUserStaffScope, resolveStaffScope, StaffScopeError } from '@/lib/staffScope'

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
  const tasks = await prisma.task.findMany({
    where: applyUserStaffScope(taskWhereForScope(scope, organizationId), staffScope),
    include: { assignedTo: { select: SAFE_ASSIGNEE_SELECT } },
    orderBy: { createdAt: 'desc' },
  })
  const taskRefs = tasks.map(task => getCaseImportantDateTaskRef(task.description))
  const personalAppearCaseIds = Array.from(new Set(
    taskRefs
      .filter(ref => ref?.kind === 'personalAppearDate')
      .map(ref => ref?.caseId)
      .filter((caseId): caseId is string => !!caseId)
  ))

  const personalAppearCases = personalAppearCaseIds.length
    ? await prisma.case.findMany({
        where: applyEmployeeStaffScope(caseWhereForScope(scope, organizationId, { id: { in: personalAppearCaseIds } }), staffScope),
        select: {
          id: true,
          personalAppearDate: true,
          statusHistory: {
            where: { fromStatus: { not: null } },
            select: { fromStatus: true, changedAt: true },
          },
        },
      })
    : []
  const retiredPersonalAppearCaseIds = new Set(
    personalAppearCases
      .filter(caseRecord => shouldRetirePersonalAppearTask(
        caseRecord.personalAppearDate,
        caseRecord.statusHistory
      ))
      .map(caseRecord => caseRecord.id)
  )

  return NextResponse.json(tasks.filter((_, index) => {
    const ref = taskRefs[index]
    if (ref?.kind === 'filingDate') return false
    if (ref?.kind === 'personalAppearDate' && retiredPersonalAppearCaseIds.has(ref.caseId)) return false
    return true
  }))
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const body = await request.json()
  const task = await prisma.task.create({
    data: {
      organizationId,
      title: body.title,
      description: body.description || null,
      priority: body.priority || 'Нормально',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      clientName: body.clientName || null,
      assignedToId: scope.restricted && scope.userId ? scope.userId : body.assignedToId ? parseInt(body.assignedToId) : null,
    }
  })
  return NextResponse.json(task)
}
