import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings } from '@/lib/leadWebhook'

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
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      settings: true,
      leadWebhookLogs: {
        where: { status: 'message' },
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
        take: 1,
      },
    },
  })
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const settings = getLeadWebhookSettings(organization.settings)
  if (!settings.facebookMessagesEnabled) {
    return NextResponse.json({ enabled: false, latest: null })
  }

  const latest = organization.leadWebhookLogs[0]

  if (!latest) return NextResponse.json({ enabled: true, latest: null })

  return NextResponse.json({
    enabled: true,
    latest: {
      id: latest.id,
      source: latest.source,
      createdAt: latest.createdAt,
      leadId: latest.lead?.id || null,
      leadName: leadName(latest.lead),
    },
  })
}
