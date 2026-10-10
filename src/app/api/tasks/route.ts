import { dispatchAssignmentPush } from '@/lib/assignmentDelivery'
import { createTaskOnce, TaskCreateConflict } from '@/lib/taskCreate'
import { assignmentEventsEnabled } from '@/lib/notificationEventGate'
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
import { notifyAssignment } from '@/lib/notifications'
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
  const assignedToId = scope.restricted && scope.userId ? scope.userId : body.assignedToId ? parseInt(body.assignedToId) : null
  if (assignedToId && !await prisma.user.findFirst({ where: { id: assignedToId, organizationId }, select: { id: true } })) return NextResponse.json({ error: 'User not found' }, { status: 400 })
  const key = request.headers.get('X-LegalHub-Create-Request')
  if (assignedToId && assignmentEventsEnabled(organizationId) && !key) return NextResponse.json({ error: 'Create request identity required; reload CRM' }, { status: 428 })
  if (key !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return NextResponse.json({ error: 'Invalid create key' }, { status: 400 })
  let assignmentIds: string[] = []
  let replay = false
  try {
    const task = await prisma.$transaction(async tx => {
      const created = await createTaskOnce(tx, organizationId, Number(user.id), key, {
        organizationId,
        title: body.title,
        description: body.description || null,
        priority: body.priority || 'Нормально',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        clientName: body.clientName || null,
        assignedToId,
      })
      replay = created.replay === true
      if (!replay) assignmentIds = await notifyAssignment(tx, 'task', created)
      delete created.replay
      return created
    })
    if (assignmentIds.length || replay) await dispatchAssignmentPush(organizationId, [task.id])
    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof TaskCreateConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    throw error
  }
}
