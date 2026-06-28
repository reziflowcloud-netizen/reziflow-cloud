import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizeLeadBody } from '@/lib/leads'
import { normalizePhones, phonesWithLegacy, primaryPhone } from '@/lib/phones'
import { findScopedLead, getDataAccessScope, leadWhereForScope } from '@/lib/apiScope'

export const dynamic = 'force-dynamic'

function leadName(lead: any) {
  return lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.phone || 'Лид'
}

async function syncNextContactTask(tx: any, lead: any, organizationId: string, assignedToId?: number | null) {
  const existingTask = await tx.task.findFirst({
    where: {
      organizationId,
      description: { contains: `"leadId":"${lead.id}","kind":"nextContact"` },
    },
  })

  if (!lead.nextContactAt) {
    if (existingTask) {
      await tx.task.update({ where: { id: existingTask.id }, data: { status: 'done' } })
    }
    return
  }

  const note = lead.nextContactNote || 'Следующий контакт'
  const meta = {
    reminderAt: new Date(lead.nextContactAt).toISOString(),
    reminderNote: note,
    leadReminder: {
      leadId: lead.id,
      kind: 'nextContact',
      note,
    },
  }
  const data = {
    organizationId,
    title: `Следующий контакт: ${leadName(lead)}`,
    description: JSON.stringify(meta),
    priority: 'Нормально',
    status: 'todo',
    dueDate: new Date(lead.nextContactAt),
    clientName: leadName(lead),
    assignedToId: assignedToId || lead.assignedToId || null,
  }

  if (existingTask) {
    await tx.task.update({ where: { id: existingTask.id }, data })
  } else {
    await tx.task.create({ data })
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({
    where: leadWhereForScope(await getDataAccessScope(user, organizationId), organizationId, { id: params.id }),
    include: {
      assignedTo: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true } },
      phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
    },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...lead, phones: phonesWithLegacy(lead) })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const scope = await getDataAccessScope(user, organizationId)
  const existing = await (prisma as any).lead.findFirst({
    where: leadWhereForScope(scope, organizationId, { id: params.id }),
    include: {
      assignedTo: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true } },
      phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const data = normalizeLeadBody({ ...existing, ...body })
  if (scope.restricted && scope.userId) data.assignedToId = scope.userId
  const shouldUpdatePhones = Array.isArray(body.phones)
  const phones = shouldUpdatePhones ? normalizePhones(body.phones, data.phone) : []
  if (shouldUpdatePhones) data.phone = primaryPhone(phones, data.phone)
  if (body.status !== undefined && data.status && data.status !== existing.status) {
    const targetStatus = await (prisma as any).leadStatus.findFirst({
      where: { organizationId, name: data.status },
      select: { requireReason: true, reasons: true },
    })
    const reasons = Array.isArray(targetStatus?.reasons) ? targetStatus.reasons.map((item: any) => String(item)) : []
    if (targetStatus?.requireReason && !data.statusReason) {
      return NextResponse.json({ error: 'Укажите причину смены статуса', requireReason: true, reasons }, { status: 400 })
    }
    if (targetStatus?.requireReason && reasons.length && !reasons.includes(String(data.statusReason))) {
      return NextResponse.json({ error: 'Выберите причину из списка', requireReason: true, reasons }, { status: 400 })
    }
    if (!targetStatus?.requireReason) {
      data.statusReason = null
      data.statusReasonComment = null
    }
  }
  if (body.employeeId !== undefined && data.employeeId && data.employeeId !== existing.employeeId) {
    const employee = await (prisma as any).employee.findFirst({
      where: { id: data.employeeId, organizationId, active: true },
      select: { id: true },
    })
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 400 })
  }
  const lead = await (prisma as any).$transaction(async (tx: any) => {
    const updated = await tx.lead.update({
      where: { id: params.id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      },
    })
    if (shouldUpdatePhones) {
      await tx.leadPhone.deleteMany({ where: { leadId: params.id, organizationId } })
      if (phones.length) {
        await tx.leadPhone.createMany({
          data: phones.map(phone => ({ organizationId, leadId: params.id, ...phone })),
        })
      }
    }
    if (body.status !== undefined && data.status && data.status !== existing.status) {
      await tx.leadContactHistory.create({
        data: {
          organizationId,
          leadId: params.id,
          authorId: user.id,
          contactAt: new Date(),
          note: `Статус изменен: ${existing.status || '—'} -> ${data.status}`,
        },
      })
      if (data.statusReason) {
        await tx.leadContactHistory.create({
          data: {
            organizationId,
            leadId: params.id,
            authorId: user.id,
            contactAt: new Date(),
            note: [
              `Причина статуса: ${data.statusReason}`,
              data.statusReasonComment ? `Комментарий: ${data.statusReasonComment}` : '',
            ].filter(Boolean).join('. '),
          },
        })
      }
    }
    if (body.assignedToId !== undefined && (data.assignedToId || null) !== (existing.assignedToId || null)) {
      const assignedTo = data.assignedToId
        ? await tx.user.findFirst({ where: { id: data.assignedToId, organizationId }, select: { name: true } })
        : null
      await tx.leadContactHistory.create({
        data: {
          organizationId,
          leadId: params.id,
          authorId: user.id,
          contactAt: new Date(),
          note: `Ответственный изменен: ${existing.assignedTo?.name || '—'} -> ${assignedTo?.name || '—'}`,
        },
      })
    }
    if (body.nextContactAt !== undefined || body.nextContactNote !== undefined) {
      const previousAt = existing.nextContactAt ? new Date(existing.nextContactAt).getTime() : null
      const nextAt = data.nextContactAt ? new Date(data.nextContactAt).getTime() : null
      const previousNote = existing.nextContactNote || ''
      const nextNote = data.nextContactNote || ''
      if (previousAt !== nextAt || previousNote !== nextNote) {
        await tx.leadContactHistory.create({
          data: {
            organizationId,
            leadId: params.id,
            authorId: user.id,
            contactAt: new Date(),
            note: 'Изменен следующий контакт',
            nextContactAt: data.nextContactAt || null,
            nextContactNote: data.nextContactNote || null,
          },
        })
      }
      await syncNextContactTask(tx, updated, organizationId, scope.restricted && scope.userId ? scope.userId : Number(user.id))
    }
    return shouldUpdatePhones
      ? await tx.lead.findUnique({
          where: { id: params.id },
          include: {
            assignedTo: { select: { id: true, name: true } },
            employee: { select: { id: true, name: true } },
            phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
          },
        })
      : updated
  })

  return NextResponse.json({ ...lead, phones: phonesWithLegacy(lead) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const existing = await findScopedLead(params.id, organizationId, { id: true })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma as any).lead.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
