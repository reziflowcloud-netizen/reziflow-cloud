import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function leadName(lead: any) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(' ').trim()
    || lead?.fullName
    || lead?.phone
    || lead?.email
    || null
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getOrganizationId(user)
  const latest = await (prisma as any).leadWebhookLog.findFirst({
    where: {
      organizationId,
      status: 'message',
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!latest) return NextResponse.json({ latest: null })

  return NextResponse.json({
    latest: {
      id: latest.id,
      source: latest.source,
      createdAt: latest.createdAt,
      leadId: latest.lead?.id || null,
      leadName: leadName(latest.lead),
    },
  })
}
