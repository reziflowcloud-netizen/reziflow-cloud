import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrganizationId, getUser } from '@/lib/auth'
import { getLeadWebhookSettings, settingsObject } from '@/lib/leadWebhook'
import { normalizeMetaApiVersion, subscribePageToMetaMessages } from '@/lib/metaOAuth'

export const dynamic = 'force-dynamic'

function canManage(user: any) {
  return user?.role === 'admin' || user?.role === 'owner'
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const pageId = String(body?.pageId || '').trim()
  if (!pageId) return NextResponse.json({ error: 'Choose a Facebook Page.' }, { status: 400 })

  const organizationId = getOrganizationId(user)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, settings: true },
  })
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const current = settingsObject(organization.settings)
  const settings = getLeadWebhookSettings(current)
  const pages = settings.metaOAuthPendingPages || []
  const selected = pages.find(page => page.id === pageId)
  if (!selected?.accessToken) {
    return NextResponse.json({ error: 'Selected Page token was not found. Please connect Meta again.' }, { status: 400 })
  }

  const instagram = selected.instagramBusinessAccount || selected.connectedInstagramAccount || null
  const version = normalizeMetaApiVersion(settings.facebookLeadApiVersion || 'v23.0')
  let subscriptionError = ''
  let subscribedAt = ''

  try {
    await subscribePageToMetaMessages(version, selected.id, selected.accessToken)
    subscribedAt = new Date().toISOString()
  } catch (caught: any) {
    subscriptionError = caught?.message || 'Meta accepted the connection, but page subscription failed.'
  }

  const updated = {
    ...current,
    facebookLeadEnabled: true,
    facebookMessagesEnabled: true,
    facebookLeadPageAccessToken: selected.accessToken,
    instagramMessagesPageAccessToken: '',
    instagramDirectAccessToken: '',
    facebookLeadApiVersion: version,
    metaOAuthConnected: true,
    metaOAuthConnectedAt: new Date().toISOString(),
    metaOAuthPageId: selected.id,
    metaOAuthPageName: selected.name,
    metaOAuthInstagramId: instagram?.id || '',
    metaOAuthInstagramUsername: instagram?.username || '',
    metaOAuthPendingPages: [],
    metaOAuthSubscriptionError: subscriptionError,
    metaOAuthSubscribedAt: subscribedAt,
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: { settings: updated },
  })

  return NextResponse.json({
    ok: true,
    slug: organization.slug,
    page: { id: selected.id, name: selected.name },
    instagram,
    subscriptionError,
    subscribedAt,
  })
}
