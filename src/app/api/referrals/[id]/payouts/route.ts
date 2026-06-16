import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/organizationProvisioning'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({}))
    const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null

    const partner = await (prisma as any).referralPartner.findUnique({ where: { id: params.id } })
    if (!partner) return NextResponse.json({ error: 'Партнер не найден' }, { status: 404 })

    const commissions = await (prisma as any).referralCommission.findMany({
      where: { partnerId: partner.id, status: 'pending' },
      orderBy: { earnedAt: 'asc' },
    })
    if (!commissions.length) {
      return NextResponse.json({ error: 'Нет открытых начислений для выплаты' }, { status: 400 })
    }

    const currency = commissions[0].currency || 'PLN'
    const amount = commissions.reduce((sum: number, item: any) => {
      if ((item.currency || 'PLN') !== currency) return sum
      return sum + Number(item.amount || 0)
    }, 0)
    const commissionIds = commissions
      .filter((item: any) => (item.currency || 'PLN') === currency)
      .map((item: any) => item.id)

    const payout = await prisma.$transaction(async tx => {
      const created = await (tx as any).referralPayout.create({
        data: {
          partnerId: partner.id,
          amount: Math.round(amount * 100) / 100,
          currency,
          status: 'paid',
          notes,
        },
      })
      await (tx as any).referralCommission.updateMany({
        where: { id: { in: commissionIds }, partnerId: partner.id },
        data: { status: 'paid', paidAt: new Date(), payoutId: created.id },
      })
      return created
    })

    return NextResponse.json({ payout, paidCommissionIds: commissionIds })
  } catch (error: any) {
    console.error('Referral payout create error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка выплаты комиссии' }, { status: 500 })
  }
}
