import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { isSystemAdmin, normalizeReferralCode } from '@/lib/organizationProvisioning'
import { prisma } from '@/lib/prisma'

function appUrl(origin?: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  return (configuredUrl || origin || 'https://legalhubcrm.com').replace(/\/$/, '')
}

function buildUrls(code: string, portalToken?: string | null, origin?: string) {
  const base = appUrl(origin)
  return {
    signupUrl: `${base}/register?ref=${encodeURIComponent(code)}`,
    portalUrl: portalToken ? `${base}/partner?code=${encodeURIComponent(code)}&token=${encodeURIComponent(portalToken)}` : null,
  }
}

function withSummary(partner: any, origin?: string) {
  const totals = (partner.commissions || []).reduce((acc: any, item: any) => {
    const amount = Number(item.amount || 0)
    if (item.status === 'paid') acc.paid += amount
    else if (item.status === 'canceled') acc.canceled += amount
    else acc.open += amount
    acc.total += amount
    return acc
  }, { total: 0, open: 0, paid: 0, canceled: 0 })

  return {
    ...partner,
    ...buildUrls(partner.code, partner.portalToken, origin),
    totals,
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const partners = await (prisma as any).referralPartner.findMany({
    where: { status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
    include: {
      attributions: {
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              plan: true,
              billingStatus: true,
              trialEndsAt: true,
              currentPeriodEndsAt: true,
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
              id: true,
              name: true,
              slug: true,
              status: true,
              plan: true,
              billingStatus: true,
            },
          },
        },
      },
      payouts: { orderBy: { paidAt: 'desc' } },
    },
  })

  return NextResponse.json({ partners: partners.map((partner: any) => withSummary(partner, request.nextUrl.origin)) })
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isSystemAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    const code = normalizeReferralCode(String(body.code || name))
    const commissionType = String(body.commissionType || 'percentage')
    const commissionValue = Number(body.commissionValue || 10)
    const commissionMonths = Number(body.commissionMonths || 12)
    const contactEmail = body.contactEmail ? String(body.contactEmail).trim().toLowerCase() : null
    const notes = body.notes ? String(body.notes).trim() : null
    const payoutDetails = body.payoutDetails ? String(body.payoutDetails).trim() : null

    if (!name) return NextResponse.json({ error: 'Укажите имя партнера' }, { status: 400 })
    if (!code) return NextResponse.json({ error: 'Укажите латинский код для ссылки' }, { status: 400 })
    if (!['percentage', 'fixed'].includes(commissionType)) {
      return NextResponse.json({ error: 'Неверный тип комиссии' }, { status: 400 })
    }
    if (!Number.isFinite(commissionValue) || commissionValue <= 0) {
      return NextResponse.json({ error: 'Комиссия должна быть больше нуля' }, { status: 400 })
    }

    const existing = await (prisma as any).referralPartner.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: 'Партнер с таким кодом уже есть' }, { status: 400 })

    const partner = await (prisma as any).referralPartner.create({
      data: {
        name,
        code,
        contactEmail,
        commissionType,
        commissionValue,
        commissionMonths,
        portalToken: randomBytes(24).toString('hex'),
        payoutDetails,
        notes,
      },
      include: {
        attributions: { include: { organization: true } },
        commissions: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                plan: true,
                billingStatus: true,
              },
            },
          },
        },
        payouts: true,
      },
    })

    return NextResponse.json(withSummary(partner, request.nextUrl.origin))
  } catch (error: any) {
    console.error('Referral partner create error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка создания партнера' }, { status: 500 })
  }
}
