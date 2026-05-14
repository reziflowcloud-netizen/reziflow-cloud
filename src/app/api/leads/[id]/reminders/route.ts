import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

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
    reminderNote: meta.reminderNote || meta.leadReminder?.note || task.title,
    reminderAt: meta.reminderAt || task.dueDate,
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tasks = await prisma.task.findMany({
    where: {
      organizationId,
      description: { contains: `"leadId":"${params.id}"` },
    },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ dueDate: 'asc' }],
  })

  return NextResponse.json(tasks.map(formatReminder))
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId } })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
      assignedToId: lead.assignedToId || user.id,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  })

  return NextResponse.json(formatReminder(task), { status: 201 })
}
