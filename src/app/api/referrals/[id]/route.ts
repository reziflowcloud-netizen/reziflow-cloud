import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isSystemAdmin, normalizeReferralCode } from '@/lib/organizationProvisioning'
import { prisma } from '@/lib/prisma'

function cleanOptional(value: unknown) {
  const text = String(value || '').trim()
  return text || null
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    const code = normalizeReferralCode(String(body.code || name))
    const commissionType = String(body.commissionType || 'percentage')
    const commissionValue = Number(body.commissionValue || 0)
    const commissionMonths = Number(body.commissionMonths || 0)
    const status = ['active', 'paused', 'archived'].includes(String(body.status)) ? String(body.status) : 'active'

    if (!name) return NextResponse.json({ error: 'Укажите имя партнера' }, { status: 400 })
    if (!code) return NextResponse.json({ error: 'Укажите код ссылки' }, { status: 400 })
    if (!['percentage', 'fixed'].includes(commissionType)) {
      return NextResponse.json({ error: 'Неверный тип комиссии' }, { status: 400 })
    }
    if (!Number.isFinite(commissionValue) || commissionValue <= 0) {
      return NextResponse.json({ error: 'Комиссия должна быть больше нуля' }, { status: 400 })
    }
    if (!Number.isFinite(commissionMonths) || commissionMonths < 0) {
      return NextResponse.json({ error: 'Количество месяцев не может быть меньше нуля' }, { status: 400 })
    }

    const partner = await (prisma as any).referralPartner.findUnique({ where: { id: params.id } })
    if (!partner) return NextResponse.json({ error: 'Партнер не найден' }, { status: 404 })

    const duplicate = await (prisma as any).referralPartner.findFirst({
      where: { code, id: { not: params.id } },
      select: { id: true },
    })
    if (duplicate) return NextResponse.json({ error: 'Партнер с таким кодом уже есть' }, { status: 400 })

    const updated = await (prisma as any).referralPartner.update({
      where: { id: params.id },
      data: {
        name,
        code,
        status,
        contactEmail: cleanOptional(body.contactEmail)?.toLowerCase() || null,
        commissionType,
        commissionValue,
        commissionMonths: Math.round(commissionMonths),
        payoutDetails: cleanOptional(body.payoutDetails),
        notes: cleanOptional(body.notes),
      },
    })

    return NextResponse.json({ partner: updated })
  } catch (error: any) {
    console.error('Referral partner update error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка обновления партнера' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const partner = await (prisma as any).referralPartner.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            attributions: true,
            commissions: true,
            payouts: true,
          },
        },
      },
    })
    if (!partner) return NextResponse.json({ error: 'Партнер не найден' }, { status: 404 })

    const hasHistory = partner._count.attributions > 0 || partner._count.commissions > 0 || partner._count.payouts > 0
    if (hasHistory) {
      await (prisma as any).referralPartner.update({
        where: { id: params.id },
        data: { status: 'archived' },
      })
      return NextResponse.json({ archived: true })
    }

    await (prisma as any).referralPartner.delete({ where: { id: params.id } })
    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    console.error('Referral partner delete error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка удаления партнера' }, { status: 500 })
  }
}
