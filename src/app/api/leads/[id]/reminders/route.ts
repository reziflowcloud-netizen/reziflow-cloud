import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { findScopedLead, getDataAccessScope, taskWhereForScope } from '@/lib/apiScope'

export const dynamic = 'force-dynamic'

function leadName(lead: any) {
  return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || 'Лид'
}

function parseMeta(description?: string | null) {
  try {
    return JSON.parse(description || '{}')
  } catch {
    return {}
  }
}

function formatReminder(task: any) {
  const meta = parseMeta(task.description)
  return {
    ...task,
    reminderKind: meta.leadReminder?.kind || 'manual',
    reminderNote: meta.reminderNote || meta.leadReminder?.note || task.title,
    reminderAt: meta.reminderAt || task.dueDate,
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await findScopedLead(params.id, organizationId)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const scope = await getDataAccessScope(user, organizationId)

  const tasks = await prisma.task.findMany({
    where: taskWhereForScope(scope, organizationId, {
      description: { contains: `"leadId":"${params.id}"` },
    }),
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ dueDate: 'asc' }],
  })

  const reminders = tasks.map(formatReminder).filter((item: any) => item.reminderKind !== 'nextContact')
  if (lead.nextContactAt) {
    reminders.push({
      id: `${lead.id}:next-contact`,
      synthetic: true,
      reminderKind: 'nextContact',
      title: 'Следующий контакт',
      reminderNote: lead.nextContactNote || 'Следующий контакт',
      reminderAt: lead.nextContactAt,
      dueDate: lead.nextContactAt,
      status: 'todo',
      assignedTo: null,
    })
  }

  return NextResponse.json(reminders.sort((a: any, b: any) => new Date(a.reminderAt || a.dueDate).getTime() - new Date(b.reminderAt || b.dueDate).getTime()))
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await findScopedLead(params.id, organizationId)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const scope = await getDataAccessScope(user, organizationId)

  const body = await request.json().catch(() => ({}))
  const reminderAt = body.reminderAt ? new Date(body.reminderAt) : null
  const note = String(body.note || '').trim()
  if (!reminderAt || Number.isNaN(reminderAt.getTime())) return NextResponse.json({ error: 'Reminder date is required' }, { status: 400 })
  if (!note) return NextResponse.json({ error: 'Reminder note is required' }, { status: 400 })

  const meta = {
    reminderAt: reminderAt.toISOString(),
    reminderNote: note,
    leadReminder: {
      leadId: params.id,
      kind: 'manual',
      note,
    },
  }

  const task = await prisma.task.create({
    data: {
      organizationId,
      title: note,
      description: JSON.stringify(meta),
      priority: body.priority || 'Нормально',
      dueDate: reminderAt,
      clientName: leadName(lead),
      assignedToId: scope.restricted && scope.userId ? scope.userId : lead.assignedToId || user.id,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  })

  return NextResponse.json(formatReminder(task), { status: 201 })
}
