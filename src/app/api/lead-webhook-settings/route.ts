import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { generateLeadWebhookKey, getLeadWebhookSettings, settingsObject } from '@/lib/leadWebhook'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

async function getOrganizationForUser(user: any) {
  const organizationId = getOrganizationId(user)
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, settings: true },
  })
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organization = await getOrganizationForUser(user)
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const current = settingsObject(organization.settings)
  let settings = getLeadWebhookSettings(current)

  if (!settings.leadWebhookKey) {
    settings = { ...settings, leadWebhookKey: generateLeadWebhookKey() }
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        settings: {
          ...current,
          leadWebhookEnabled: settings.leadWebhookEnabled !== false,
          leadWebhookKey: settings.leadWebhookKey,
        },
      },
    })
  }

  return NextResponse.json({
    slug: organization.slug,
    enabled: settings.leadWebhookEnabled !== false,
    key: settings.leadWebhookKey,
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const organization = await getOrganizationForUser(user)
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const current = settingsObject(organization.settings)
  const previous = getLeadWebhookSettings(current)
  const nextKey = body.regenerateKey ? generateLeadWebhookKey() : previous.leadWebhookKey || generateLeadWebhookKey()
  const nextEnabled = typeof body.enabled === 'boolean' ? body.enabled : previous.leadWebhookEnabled !== false

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      settings: {
        ...current,
        leadWebhookEnabled: nextEnabled,
        leadWebhookKey: nextKey,
      },
    },
  })

  return NextResponse.json({
    slug: organization.slug,
    enabled: nextEnabled,
    key: nextKey,
  })
}

