import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeReferralCode } from '@/lib/organizationProvisioning'

function summary(commissions: any[]) {
  return commissions.reduce((acc, item) => {
    const amount = Number(item.amount || 0)
    if (item.status === 'paid') acc.paid += amount
    else if (item.status !== 'canceled') acc.open += amount
    acc.total += amount
    return acc
  }, { total: 0, open: 0, paid: 0 })
}

export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get('code') || '')
  const token = request.nextUrl.searchParams.get('token') || ''

  if (!code || !token) return NextResponse.json({ error: 'Нужна ссылка партнера' }, { status: 400 })

  const partner = await (prisma as any).referralPartner.findUnique({
    where: { code },
    include: {
      attributions: {
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              name: true,
              status: true,
              plan: true,
              billingStatus: true,
              trialEndsAt: true,
              createdAt: true,
            },
          },
        },
      },
      commissions: {
        orderBy: { earnedAt: 'desc' },
        include: {
          organization: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!partner || partner.portalToken !== token || partner.status !== 'active') {
    return NextResponse.json({ error: 'Ссылка партнера недействительна' }, { status: 403 })
  }

  return NextResponse.json({
    partner: {
      name: partner.name,
      code: partner.code,
      commissionType: partner.commissionType,
      commissionValue: partner.commissionValue,
      commissionMonths: partner.commissionMonths,
      totals: summary(partner.commissions || []),
      attributions: partner.attributions,
      commissions: partner.commissions,
    },
  })
}
