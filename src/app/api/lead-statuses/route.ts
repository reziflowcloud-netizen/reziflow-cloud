import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { DEFAULT_LEAD_STATUSES } from '@/lib/leads'

export const dynamic = 'force-dynamic'

function normalizeReasons(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)))
}

async function ensureLeadStatuses(organizationId: string) {
  const existing = await (prisma as any).leadStatus.findMany({
    where: { organizationId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })
  if (existing.length) return existing

  await (prisma as any).leadStatus.createMany({
    data: DEFAULT_LEAD_STATUSES.map(status => ({ ...status, organizationId })),
    skipDuplicates: true,
  })

  return (prisma as any).leadStatus.findMany({
    where: { organizationId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  return NextResponse.json(await ensureLeadStatuses(organizationId))
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await request.json()
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  try {
    const status = await (prisma as any).leadStatus.create({
      data: {
        organizationId,
        name,
        color: body.color || '#2563eb',
        order: Number.isFinite(Number(body.order)) ? Number(body.order) : 999,
        requireReason: Boolean(body.requireReason),
        reasons: normalizeReasons(body.reasons),
      },
    })
    return NextResponse.json(status)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Такой статус уже существует' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Ошибка создания статуса' }, { status: 500 })
  }
}
