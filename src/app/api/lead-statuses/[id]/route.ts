import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function normalizeReasons(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)))
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const id = Number(params.id)
  const existing = await (prisma as any).leadStatus.findFirst({ where: { id, organizationId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const data: any = {}
  const nextName = body.name !== undefined ? String(body.name || '').trim() : existing.name
  if (!nextName) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
  if (body.name !== undefined) data.name = nextName
  if (body.color !== undefined) data.color = body.color || existing.color
  if (body.order !== undefined && Number.isFinite(Number(body.order))) data.order = Number(body.order)
  if (body.requireReason !== undefined) data.requireReason = Boolean(body.requireReason)
  if (body.reasons !== undefined) data.reasons = normalizeReasons(body.reasons)

  try {
    const status = await (prisma as any).$transaction(async (tx: any) => {
      const updated = await tx.leadStatus.update({ where: { id }, data })
      if (data.name && data.name !== existing.name) {
        await tx.lead.updateMany({
          where: { organizationId, status: existing.name },
          data: { status: data.name },
        })
      }
      if (data.requireReason === false) {
        await tx.lead.updateMany({
          where: { organizationId, status: updated.name },
          data: { statusReason: null, statusReasonComment: null },
        })
      }
      return updated
    })
    return NextResponse.json(status)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Такой статус уже существует' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Ошибка обновления статуса' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const id = Number(params.id)
  const existing = await (prisma as any).leadStatus.findFirst({ where: { id, organizationId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const count = await (prisma as any).lead.count({ where: { organizationId, status: existing.name } })
  if (count > 0) {
    return NextResponse.json({ error: 'Нельзя удалить статус, пока в нем есть лиды' }, { status: 400 })
  }

  await (prisma as any).leadStatus.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
