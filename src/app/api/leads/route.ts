import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizeLeadBody } from '@/lib/leads'
import { normalizePhones, phonesWithLegacy, primaryPhone } from '@/lib/phones'
import { getDataAccessScope, leadWhereForScope, taskWhereForScope } from '@/lib/apiScope'

export const dynamic = 'force-dynamic'

function parseTaskMeta(description?: string | null) {
  try {
    return JSON.parse(description || '{}')
  } catch {
    return {}
  }
}

function leadName(lead: any) {
  return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || 'Лид'
}

async function createNextContactTask(lead: any, organizationId: string, assignedToId?: number | null) {
  if (!lead.nextContactAt) return
  const note = lead.nextContactNote || 'Следующий контакт'
  await prisma.task.create({
    data: {
      organizationId,
      title: `Следующий контакт: ${leadName(lead)}`,
      description: JSON.stringify({
        reminderAt: new Date(lead.nextContactAt).toISOString(),
        reminderNote: note,
        leadReminder: {
          leadId: lead.id,
          kind: 'nextContact',
          note,
        },
      }),
      priority: 'Нормально',
      dueDate: new Date(lead.nextContactAt),
      clientName: leadName(lead),
      assignedToId: assignedToId || lead.assignedToId || null,
    },
  })
}

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const status = request.nextUrl.searchParams.get('status') || ''
  const source = request.nextUrl.searchParams.get('source') || ''

  const where: any = leadWhereForScope(scope, organizationId)
  if (status) where.status = status
  if (source) where.source = source

  const leads = await (prisma as any).lead.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true } },
      phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const leadIds = new Set(leads.map((lead: any) => lead.id))
  const tasks = await prisma.task.findMany({
    where: taskWhereForScope(scope, organizationId, {
      status: { not: 'done' },
      description: { contains: '"leadId":"' },
    }),
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { dueDate: 'asc' },
  })

  const remindersByLead: Record<string, any[]> = {}
  for (const task of tasks) {
    const meta = parseTaskMeta(task.description)
    const leadId = meta.leadReminder?.leadId
    if (!leadId || !leadIds.has(leadId)) continue
    if (meta.leadReminder?.kind === 'nextContact') continue
    remindersByLead[leadId] = [
      ...(remindersByLead[leadId] || []),
      {
        ...task,
        reminderKind: meta.leadReminder?.kind || 'manual',
        reminderNote: meta.reminderNote || meta.leadReminder?.note || task.title,
        reminderAt: meta.reminderAt || task.dueDate,
      },
    ]
  }

  return NextResponse.json(leads.map((lead: any) => ({
    ...lead,
    phones: phonesWithLegacy(lead),
    leadReminders: remindersByLead[lead.id] || [],
  })))
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const scope = await getDataAccessScope(user, organizationId)
  const body = await request.json()
  const data = normalizeLeadBody(body)
  if (scope.restricted && scope.userId) data.assignedToId = scope.userId
  if (!body.status) {
    const defaultStatus = await (prisma as any).leadStatus.findFirst({
      where: { organizationId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { name: true },
    })
    data.status = defaultStatus?.name || data.status
  }
  const phones = normalizePhones(body.phones, data.phone)
  data.phone = primaryPhone(phones, data.phone)

  if (!data.fullName && !data.phone && !data.email && !data.instagram && !data.facebook) {
    return NextResponse.json({ error: 'Укажите имя, телефон, email или профиль соцсети' }, { status: 400 })
  }

  const lead = await (prisma as any).lead.create({
    data: {
      organizationId,
      ...data,
      phones: phones.length ? { create: phones.map(phone => ({ organizationId, ...phone })) } : undefined,
    },
    include: { phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
  })
  await createNextContactTask(lead, organizationId, scope.restricted && scope.userId ? scope.userId : Number(user.id))

  return NextResponse.json(lead)
}
