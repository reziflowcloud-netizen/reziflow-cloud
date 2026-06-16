import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'
import { prisma } from '@/lib/prisma'

function moneyNumber(value: unknown) {
  const amount = Number(String(value || '').replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const partner = await (prisma as any).referralPartner.findUnique({ where: { id: params.id } })
    if (!partner) return NextResponse.json({ error: 'Партнер не найден' }, { status: 404 })

    const organizationId = String(body.organizationId || '').trim()
    const amount = moneyNumber(body.amount)
    const baseAmount = moneyNumber(body.baseAmount) || amount || 0
    const currency = String(body.currency || 'PLN').trim().toUpperCase().slice(0, 8) || 'PLN'
    const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null

    if (!organizationId) return NextResponse.json({ error: 'Выберите организацию' }, { status: 400 })
    if (!amount) return NextResponse.json({ error: 'Укажите сумму комиссии' }, { status: 400 })

    const attribution = await (prisma as any).referralAttribution.findFirst({
      where: { partnerId: partner.id, organizationId },
      include: { organization: { select: { id: true, name: true } } },
    })
    if (!attribution) {
      return NextResponse.json({ error: 'Эта организация не привязана к партнеру' }, { status: 400 })
    }

    const commission = await (prisma as any).referralCommission.create({
      data: {
        partnerId: partner.id,
        organizationId,
        sourceType: 'manual',
        baseAmount,
        amount,
        currency,
        status: 'pending',
        notes,
      },
      include: {
        organization: { select: { id: true, name: true, slug: true, status: true, plan: true, billingStatus: true } },
      },
    })

    return NextResponse.json(commission)
  } catch (error: any) {
    console.error('Referral commission create error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка создания комиссии' }, { status: 500 })
  }
}
