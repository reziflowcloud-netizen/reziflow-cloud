import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { normalizeLeadBody } from '@/lib/leads'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const status = request.nextUrl.searchParams.get('status') || ''
  const source = request.nextUrl.searchParams.get('source') || ''

  const where: any = { organizationId }
  if (status) where.status = status
  if (source) where.source = source

  const leads = await (prisma as any).lead.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(leads)
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getOrganizationId(user)
  const body = await request.json()
  const data = normalizeLeadBody(body)

  if (!data.fullName && !data.phone && !data.email && !data.instagram && !data.facebook) {
    return NextResponse.json({ error: 'Укажите имя, телефон, email или профиль соцсети' }, { status: 400 })
  }

  const lead = await (prisma as any).lead.create({
    data: { organizationId, ...data },
  })

  return NextResponse.json(lead)
}
