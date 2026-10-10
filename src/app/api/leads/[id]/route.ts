import { dispatchAssignmentPush } from '@/lib/assignmentDelivery'
import { NextRequest, NextResponse } from 'next/server'
import { notifyAssignment } from '@/lib/notifications'
import { entityWrite, entityWriteError, EntityWriteError, writeEntityCustomFields, readEntityCustomFields } from '@/lib/entityWrite'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizeLeadBody } from '@/lib/leads'
import { normalizePhones, phonesWithLegacy, primaryPhone } from '@/lib/phones'
import { findScopedLead, getDataAccessScope, leadWhereForScope } from '@/lib/apiScope'
import { leadAssignmentData } from '@/lib/leadAssignmentPolicy'

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

  const scope = await getDataAccessScope(user, organizationId)
  return prisma.$transaction(async tx => {
  const lead = await tx.lead.findFirst({
    where: leadWhereForScope(scope, organizationId, { id: params.id }),
    include: {
      assignedTo: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true } },
      phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
    },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...lead, phones: phonesWithLegacy(lead), customFieldValues: await readEntityCustomFields(tx, organizationId, 'lead', params.id) })
  }, { isolationLevel: 'RepeatableRead' })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const scope = await getDataAccessScope(user, organizationId)
  try {
  const body = await request.json()
  let assignmentIds: string[] = []
  return await entityWrite(request, 'lead', body, leadWhereForScope(scope, organizationId, { id: params.id }), async (tx, existing, claim) => {
  const normalized = normalizeLeadBody({ ...existing, ...body })
  const data: any = Object.fromEntries(Object.entries(normalized).filter(([key]) => Object.prototype.hasOwnProperty.call(body, key)))
  if ('firstName' in body || 'lastName' in body) data.fullName = normalized.fullName
  if (scope.restricted && ('assignedToId' in body || 'employeeId' in body)) data.assignedToId = scope.userId
  for (const key of ['deadlineAt','lastContactAt','nextContactAt']) if (data[key] instanceof Date && !Number.isFinite(data[key].getTime())) throw new EntityWriteError(400, 'Invalid date')
  if (data.assignedToId && !await tx.user.findFirst({ where: { id: data.assignedToId, organizationId }, select: { id: true } })) throw new EntityWriteError(400, 'User not found')
  const shouldUpdatePhones = Array.isArray(body.phones)
  const phones = shouldUpdatePhones ? normalizePhones(body.phones, data.phone) : []
  if (shouldUpdatePhones) data.phone = primaryPhone(phones, data.phone)
  if (body.status !== undefined && data.status && data.status !== existing.status) {
    const targetStatus = await tx.leadStatus.findFirst({
      where: { organizationId, name: data.status },
      select: { requireReason: true, reasons: true },
    })
    const reasons = Array.isArray(targetStatus?.reasons) ? targetStatus.reasons.map((item: any) => String(item)) : []
    if (targetStatus?.requireReason && !normalized.statusReason) {
      throw new EntityWriteError(400, 'Укажите причину смены статуса')
    }
    if (targetStatus?.requireReason && reasons.length && !reasons.includes(String(normalized.statusReason))) {
      throw new EntityWriteError(400, 'Выберите причину из списка')
    }
    if (!targetStatus?.requireReason) {
      data.statusReason = null
      data.statusReasonComment = null
    } else {
      data.statusReason = normalized.statusReason
      data.statusReasonComment = normalized.statusReasonComment
    }
  }
  if (body.employeeId !== undefined && data.employeeId && data.employeeId !== existing.employeeId) {
    const employee = await tx.employee.findFirst({
      where: { id: data.employeeId, organizationId, active: true },
      select: { id: true },
    })
    if (!employee) throw new EntityWriteError(400, 'Employee not found')
  }
  if (body.employeeId !== undefined && !scope.restricted) {
    Object.assign(data, leadAssignmentData(
      data.employeeId,
      data.employeeId ? (await tx.employee.findFirst({ where: { organizationId, id: data.employeeId }, select: { userId: true } }))?.userId : null,
    ))
  }
    if (data.assignedToId && !await tx.user.findFirst({ where: { organizationId, id: data.assignedToId }, select: { id: true } })) throw new EntityWriteError(400, 'User not found')
    const updated = await claim(data)
    assignmentIds = await notifyAssignment(tx, 'lead', updated, existing)
    await writeEntityCustomFields(tx, organizationId, 'lead', params.id, body.customFieldValues)
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
    if ((body.assignedToId !== undefined || body.employeeId !== undefined) && (data.assignedToId || null) !== (existing.assignedToId || null)) {
      const previousAssignedTo = existing.assignedToId ? await tx.user.findFirst({ where: { id: existing.assignedToId, organizationId }, select: { name: true } }) : null
      const assignedTo = data.assignedToId
        ? await tx.user.findFirst({ where: { id: data.assignedToId, organizationId }, select: { name: true } })
        : null
      await tx.leadContactHistory.create({
        data: {
          organizationId,
          leadId: params.id,
          authorId: user.id,
          contactAt: new Date(),
          note: `Ответственный изменен: ${previousAssignedTo?.name || '—'} -> ${assignedTo?.name || '—'}`,
        },
      })
    }
    if (body.nextContactAt !== undefined || body.nextContactNote !== undefined) {
      const previousAt = existing.nextContactAt ? new Date(existing.nextContactAt).getTime() : null
      const nextAt = updated.nextContactAt ? new Date(updated.nextContactAt).getTime() : null
      const previousNote = existing.nextContactNote || ''
      const nextNote = updated.nextContactNote || ''
      if (previousAt !== nextAt || previousNote !== nextNote) {
        await tx.leadContactHistory.create({
          data: {
            organizationId,
            leadId: params.id,
            authorId: user.id,
            contactAt: new Date(),
            note: 'Изменен следующий контакт',
            nextContactAt: updated.nextContactAt || null,
            nextContactNote: updated.nextContactNote || null,
          },
        })
      }
      await syncNextContactTask(tx, updated, organizationId, scope.restricted && scope.userId ? scope.userId : Number(user.id))
    }
    const lead = await tx.lead.findFirst({ where: { id: params.id, organizationId }, include: { assignedTo: { select: { id: true, name: true } }, employee: { select: { id: true, name: true } }, phones: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } } })
    return { ...lead, phones: phonesWithLegacy(lead) }
  }, async result => { if (assignmentIds.length) await dispatchAssignmentPush(organizationId, [result.id]) })
  } catch (error) { return entityWriteError(error) }
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
