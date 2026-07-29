// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { caseWhereForScope, getDataAccessScope, taskWhereForScope } from '@/lib/apiScope'
import {
  getCaseImportantDateTaskRef,
  shouldRetirePersonalAppearTask,
} from '@/lib/caseImportantDateTasks'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const tasks = await prisma.task.findMany({ where: taskWhereForScope(scope, organizationId), include: { assignedTo: true }, orderBy: { createdAt: 'desc' } })
  const taskRefs = tasks.map(task => getCaseImportantDateTaskRef(task.description))
  const personalAppearCaseIds = Array.from(new Set(
    taskRefs
      .filter(ref => ref?.kind === 'personalAppearDate')
      .map(ref => ref?.caseId)
      .filter((caseId): caseId is string => !!caseId)
  ))

  const personalAppearCases = personalAppearCaseIds.length
    ? await prisma.case.findMany({
        where: caseWhereForScope(scope, organizationId, { id: { in: personalAppearCaseIds } }),
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
