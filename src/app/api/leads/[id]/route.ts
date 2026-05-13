import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizeLeadBody } from '@/lib/leads'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const lead = await (prisma as any).lead.findFirst({
    where: { id: params.id, organizationId },
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const existing = await (prisma as any).lead.findFirst({
    where: { id: params.id, organizationId },
    include: { assignedTo: { select: { id: true, name: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const data = normalizeLeadBody({ ...existing, ...body })
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
  const lead = await (prisma as any).$transaction(async (tx: any) => {
    const updated = await tx.lead.update({
      where: { id: params.id },
      data,
    })
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
    }
    return updated
  })

  return NextResponse.json(lead)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)

  const existing = await (prisma as any).lead.findFirst({ where: { id: params.id, organizationId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma as any).lead.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
